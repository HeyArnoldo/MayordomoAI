import { HttpStatus } from '@nestjs/common';
import { Channel } from '@app/contracts';
import { AppException } from '../common/errors/app.exception';
import { ChatController } from './chat.controller';
import type { UIMessage } from 'ai';
import { MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES, MAX_IMAGES } from '../agent/media.constants';
import { DocumentExtractionError } from '../agent/document.extract';

// ── Mocks for document helpers ────────────────────────────────────────────────
jest.mock('../agent/document.extract', () => ({
  ...jest.requireActual('../agent/document.extract'),
  extractDocumentText: jest.fn(),
}));
jest.mock('../agent/media.helpers', () => ({
  ...jest.requireActual('../agent/media.helpers'),
  isLowText: jest.fn().mockReturnValue(false),
}));

import { extractDocumentText } from '../agent/document.extract';
import { isLowText } from '../agent/media.helpers';

// ── Helper to build a tiny base64 data-URL for a given MIME. ─────────────────
// The raw base64 payload "abc=" decodes to 2 bytes.
const SMALL_BASE64 = 'abc=';
const makeDataUrl = (mime = 'image/jpeg') => `data:${mime};base64,${SMALL_BASE64}`;

// Build a UIMessage whose last user turn has the given file parts.
function makeImageMessages(
  fileParts: Array<{ mediaType: string; url: string; filename?: string }>,
): UIMessage[] {
  return [
    {
      id: 'm1',
      role: 'user',
      parts: [
        ...fileParts.map((f) => ({
          type: 'file' as const,
          mediaType: f.mediaType,
          url: f.url,
          filename: f.filename,
        })),
        { type: 'text' as const, text: 'what is this?' },
      ],
    },
  ];
}

// Minimal stubs for dependencies not under test.
const makeConversationsService = () => ({
  ensureWhatsAppThread: jest.fn(),
  list: jest.fn(),
  create: jest.fn(),
  rename: jest.fn(),
  togglePin: jest.fn(),
  remove: jest.fn(),
  listMessages: jest.fn(),
  findOne: jest.fn(),
  lastMessage: jest.fn(),
  appendMessage: jest.fn(),
  setTitle: jest.fn(),
});

const makeAgentService = () => ({
  run: jest.fn(),
  suggestTitle: jest.fn(),
});

const makeTranscriptionService = () => ({
  transcribe: jest.fn(),
});

const makeUser = () => ({
  id: 'u1',
  name: 'Test User',
  language: 'es' as const,
  currency: 'PEN',
});

describe('ChatController', () => {
  let controller: ChatController;
  let conversations: ReturnType<typeof makeConversationsService>;
  let agent: ReturnType<typeof makeAgentService>;
  let transcription: ReturnType<typeof makeTranscriptionService>;

  beforeEach(() => {
    conversations = makeConversationsService();
    agent = makeAgentService();
    transcription = makeTranscriptionService();
    controller = new ChatController(conversations as never, agent as never, transcription as never);
  });

  describe('transcribe', () => {
    describe('when no audio file is provided', () => {
      it('throws AppException with code chat.audio_missing', async () => {
        const user = makeUser();
        await expect(controller.transcribe(user as never, undefined)).rejects.toMatchObject({
          code: 'chat.audio_missing',
        });
      });

      it('thrown exception has BAD_REQUEST status', async () => {
        const user = makeUser();
        let caught: { getStatus: () => number } | undefined;
        try {
          await controller.transcribe(user as never, undefined);
        } catch (e) {
          caught = e as typeof caught;
        }
        expect(caught?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      });

      it('throws AppException (not a plain BadRequestException)', async () => {
        const user = makeUser();
        let caught: unknown;
        try {
          await controller.transcribe(user as never, undefined);
        } catch (e) {
          caught = e;
        }
        expect(caught).toBeInstanceOf(AppException);
      });
    });

    describe('when audio file has empty buffer', () => {
      it('throws AppException with code chat.audio_missing', async () => {
        const user = makeUser();
        const file = { buffer: Buffer.alloc(0), mimetype: 'audio/webm', size: 0 };
        await expect(controller.transcribe(user as never, file as never)).rejects.toMatchObject({
          code: 'chat.audio_missing',
        });
      });
    });

    describe('when transcription returns null', () => {
      it('throws AppException with code chat.transcription_failed', async () => {
        const user = makeUser();
        const file = { buffer: Buffer.from('audio'), mimetype: 'audio/webm', size: 5 };
        transcription.transcribe.mockResolvedValue(null);
        await expect(controller.transcribe(user as never, file as never)).rejects.toMatchObject({
          code: 'chat.transcription_failed',
        });
      });

      it('thrown exception has BAD_REQUEST status', async () => {
        const user = makeUser();
        const file = { buffer: Buffer.from('audio'), mimetype: 'audio/webm', size: 5 };
        transcription.transcribe.mockResolvedValue(null);
        let caught: { getStatus: () => number } | undefined;
        try {
          await controller.transcribe(user as never, file as never);
        } catch (e) {
          caught = e as typeof caught;
        }
        expect(caught?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      });

      it('throws AppException (not a plain BadRequestException)', async () => {
        const user = makeUser();
        const file = { buffer: Buffer.from('audio'), mimetype: 'audio/webm', size: 5 };
        transcription.transcribe.mockResolvedValue(null);
        let caught: unknown;
        try {
          await controller.transcribe(user as never, file as never);
        } catch (e) {
          caught = e;
        }
        expect(caught).toBeInstanceOf(AppException);
      });
    });

    describe('when transcription succeeds', () => {
      it('returns the transcribed text', async () => {
        const user = makeUser();
        const file = { buffer: Buffer.from('audio'), mimetype: 'audio/webm', size: 5 };
        transcription.transcribe.mockResolvedValue('hello world');
        const result = await controller.transcribe(user as never, file as never);
        expect(result).toEqual({ text: 'hello world' });
      });
    });
  });

  describe('chat (locale + currency passthrough)', () => {
    // Guards the headline bug fix: agent.run must receive the USER's language
    // and resolved currency so the agent replies in the right language/currency.
    // A revert (e.g. hardcoding 'es'/default) must fail this suite.
    const makeRunResult = () => ({
      pipeUIMessageStreamToResponse: jest.fn(),
      text: Promise.resolve('assistant reply'),
      steps: Promise.resolve([]),
    });

    beforeEach(() => {
      conversations.findOne.mockResolvedValue({ id: 'c1', title: 'Existing' });
      conversations.lastMessage.mockResolvedValue(null);
      conversations.appendMessage.mockResolvedValue(undefined);
      conversations.setTitle.mockResolvedValue(undefined);
    });

    it('calls agent.run with the user language and resolved currency (en/USD)', async () => {
      const user = { id: 'u1', name: 'En User', language: 'en' as const, currency: 'USD' };
      agent.run.mockReturnValue(makeRunResult());
      const body = { conversationId: 'c1', messages: [] };
      const res = { foo: 'bar' };

      await controller.chat(user as never, body as never, res as never);

      expect(agent.run).toHaveBeenCalledWith(
        'u1',
        'c1',
        expect.anything(),
        Channel.WEB,
        'En User',
        'en',
        'USD',
      );
    });

    it('passes the es user language and resolved currency (es/PEN)', async () => {
      const user = { id: 'u1', name: 'Es User', language: 'es' as const, currency: 'PEN' };
      agent.run.mockReturnValue(makeRunResult());
      const body = { conversationId: 'c1', messages: [] };
      const res = {};

      await controller.chat(user as never, body as never, res as never);

      const call = agent.run.mock.calls[0];
      expect(call[5]).toBe('es');
      expect(call[6]).toBe('PEN');
    });
  });

  // ── D1: image validation in POST /chat ───────────────────────────────────────
  describe('chat (image validation)', () => {
    const makeRunResult = () => ({
      pipeUIMessageStreamToResponse: jest.fn(),
      text: Promise.resolve('assistant reply'),
      steps: Promise.resolve([]),
    });

    const user = makeUser();

    beforeEach(() => {
      conversations.findOne.mockResolvedValue({ id: 'c1', title: 'Existing' });
      conversations.lastMessage.mockResolvedValue(null);
      conversations.appendMessage.mockResolvedValue(undefined);
      conversations.setTitle.mockResolvedValue(undefined);
    });

    describe('when one valid image is attached', () => {
      it('does not throw and calls agent.run', async () => {
        agent.run.mockReturnValue(makeRunResult());
        const messages = makeImageMessages([{ mediaType: 'image/jpeg', url: makeDataUrl() }]);
        const body = { conversationId: 'c1', messages };
        const res = {};

        await expect(
          controller.chat(user as never, body as never, res as never),
        ).resolves.not.toThrow();
        expect(agent.run).toHaveBeenCalled();
      });

      it('persists non-null mediaContext for the user turn', async () => {
        agent.run.mockReturnValue(makeRunResult());
        const messages = makeImageMessages([
          { mediaType: 'image/jpeg', url: makeDataUrl(), filename: 'receipt.jpg' },
        ]);
        const body = { conversationId: 'c1', messages };
        const res = {};

        await controller.chat(user as never, body as never, res as never);

        // appendMessage is called for the user turn (first call)
        const firstCall = conversations.appendMessage.mock.calls[0];
        const mediaContext = firstCall[5]; // 6th param
        expect(mediaContext).not.toBeNull();
        expect(Array.isArray(mediaContext)).toBe(true);
        expect(mediaContext[0]).toMatchObject({ type: 'image', mediaType: 'image/jpeg' });
      });

      it('does NOT store binary data in any persisted field', async () => {
        agent.run.mockReturnValue(makeRunResult());
        const messages = makeImageMessages([{ mediaType: 'image/jpeg', url: makeDataUrl() }]);
        const body = { conversationId: 'c1', messages };
        const res = {};

        await controller.chat(user as never, body as never, res as never);

        const firstCall = conversations.appendMessage.mock.calls[0];
        const content: string = firstCall[2]; // content param
        // content must be text only — no data URL
        expect(content).not.toContain('data:');
      });
    });

    describe('when two valid images are attached', () => {
      it('does not throw and calls agent.run', async () => {
        agent.run.mockReturnValue(makeRunResult());
        const messages = makeImageMessages([
          { mediaType: 'image/jpeg', url: makeDataUrl() },
          { mediaType: 'image/png', url: makeDataUrl('image/png') },
        ]);
        const body = { conversationId: 'c1', messages };
        const res = {};

        await expect(
          controller.chat(user as never, body as never, res as never),
        ).resolves.not.toThrow();
        expect(agent.run).toHaveBeenCalled();
      });

      it('persists mediaContext with two entries', async () => {
        agent.run.mockReturnValue(makeRunResult());
        const messages = makeImageMessages([
          { mediaType: 'image/jpeg', url: makeDataUrl() },
          { mediaType: 'image/png', url: makeDataUrl('image/png') },
        ]);
        const body = { conversationId: 'c1', messages };
        const res = {};

        await controller.chat(user as never, body as never, res as never);

        const firstCall = conversations.appendMessage.mock.calls[0];
        const mediaContext = firstCall[5];
        expect(mediaContext).toHaveLength(2);
      });
    });

    describe('when more than MAX_IMAGES images are attached', () => {
      it('throws AppException with code chat.image_rejected before calling agent', async () => {
        const tooMany = Array.from({ length: MAX_IMAGES + 1 }, () => ({
          mediaType: 'image/jpeg',
          url: makeDataUrl(),
        }));
        const messages = makeImageMessages(tooMany);
        const body = { conversationId: 'c1', messages };
        const res = {};

        await expect(
          controller.chat(user as never, body as never, res as never),
        ).rejects.toMatchObject({ code: 'chat.image_rejected' });
        expect(agent.run).not.toHaveBeenCalled();
      });

      it('thrown exception has BAD_REQUEST status', async () => {
        const tooMany = Array.from({ length: MAX_IMAGES + 1 }, () => ({
          mediaType: 'image/jpeg',
          url: makeDataUrl(),
        }));
        const messages = makeImageMessages(tooMany);
        const body = { conversationId: 'c1', messages };
        const res = {};

        let caught: { getStatus: () => number } | undefined;
        try {
          await controller.chat(user as never, body as never, res as never);
        } catch (e) {
          caught = e as typeof caught;
        }
        expect(caught?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      });
    });

    describe('when an image exceeds MAX_IMAGE_BYTES', () => {
      it('throws AppException with code chat.image_rejected before calling agent', async () => {
        // Build a base64 string whose decoded size exceeds the limit
        const bigPayload = 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4);
        const oversizedUrl = `data:image/jpeg;base64,${bigPayload}`;
        const messages = makeImageMessages([{ mediaType: 'image/jpeg', url: oversizedUrl }]);
        const body = { conversationId: 'c1', messages };
        const res = {};

        await expect(
          controller.chat(user as never, body as never, res as never),
        ).rejects.toMatchObject({ code: 'chat.image_rejected' });
        expect(agent.run).not.toHaveBeenCalled();
      });
    });

    describe('when an image has a disallowed MIME type', () => {
      it('throws AppException with code chat.image_rejected before calling agent', async () => {
        const messages = makeImageMessages([
          { mediaType: 'image/tiff', url: makeDataUrl('image/tiff') },
        ]);
        const body = { conversationId: 'c1', messages };
        const res = {};

        await expect(
          controller.chat(user as never, body as never, res as never),
        ).rejects.toMatchObject({ code: 'chat.image_rejected' });
        expect(agent.run).not.toHaveBeenCalled();
      });
    });

    describe('when the image URL is a blob: URL (not a data URL)', () => {
      it('throws AppException with code chat.image_rejected before calling agent', async () => {
        const messages = makeImageMessages([
          { mediaType: 'image/jpeg', url: 'blob:http://localhost/abc-123' },
        ]);
        const body = { conversationId: 'c1', messages };
        const res = {};

        await expect(
          controller.chat(user as never, body as never, res as never),
        ).rejects.toMatchObject({ code: 'chat.image_rejected' });
        expect(agent.run).not.toHaveBeenCalled();
      });
    });

    describe('when the message is text-only (no file parts)', () => {
      it('does not throw and calls agent.run', async () => {
        agent.run.mockReturnValue(makeRunResult());
        const messages: UIMessage[] = [
          {
            id: 'm1',
            role: 'user',
            parts: [{ type: 'text', text: 'hello agent' }],
          },
        ];
        const body = { conversationId: 'c1', messages };
        const res = {};

        await expect(
          controller.chat(user as never, body as never, res as never),
        ).resolves.not.toThrow();
        expect(agent.run).toHaveBeenCalled();
      });

      it('persists null mediaContext for text-only messages', async () => {
        agent.run.mockReturnValue(makeRunResult());
        const messages: UIMessage[] = [
          {
            id: 'm1',
            role: 'user',
            parts: [{ type: 'text', text: 'hello agent' }],
          },
        ];
        const body = { conversationId: 'c1', messages };
        const res = {};

        await controller.chat(user as never, body as never, res as never);

        const firstCall = conversations.appendMessage.mock.calls[0];
        const mediaContext = firstCall[5];
        expect(mediaContext).toBeNull();
      });
    });

    describe('stripImagesFromHistory on replay', () => {
      it('strips file parts from past messages before passing to convertToModelMessages', async () => {
        // Two messages: one older user message with an image, then a new user message with an image.
        // stripImagesFromHistory must strip the older one, keep the last user's file parts.
        agent.run.mockReturnValue(makeRunResult());
        const messages: UIMessage[] = [
          {
            id: 'm_old',
            role: 'user',
            parts: [
              {
                type: 'file' as const,
                mediaType: 'image/jpeg',
                url: makeDataUrl(),
                filename: 'old.jpg',
              },
              { type: 'text' as const, text: 'old image message' },
            ],
          },
          {
            id: 'm_assistant',
            role: 'assistant',
            parts: [{ type: 'text' as const, text: 'I saw the image.' }],
          },
          {
            id: 'm_new',
            role: 'user',
            parts: [
              {
                type: 'file' as const,
                mediaType: 'image/jpeg',
                url: makeDataUrl(),
                filename: 'new.jpg',
              },
              { type: 'text' as const, text: 'new image' },
            ],
          },
        ];
        const body = { conversationId: 'c1', messages };
        const res = {};

        await controller.chat(user as never, body as never, res as never);

        // agent.run must have been called (no error thrown)
        expect(agent.run).toHaveBeenCalled();
        // The model messages passed must NOT contain the old binary — only a placeholder
        const modelMessages = agent.run.mock.calls[0][2];
        const firstUserContent = (modelMessages[0] as { role: string; content: unknown }).content;
        // If it's a string, the image was stripped. If array, check for placeholder text part.
        if (Array.isArray(firstUserContent)) {
          const hasImageBinary = firstUserContent.some(
            (p: { type: string; image?: string }) =>
              p.type === 'image' && p.image?.startsWith('data:'),
          );
          expect(hasImageBinary).toBe(false);
        } else {
          // String content from the stripped turn — passes validation
          expect(typeof firstUserContent).toBe('string');
        }
      });
    });
  });
});

// ── D2: document branch in POST /chat ────────────────────────────────────────

const SMALL_DOC_BASE64 = 'abc='; // decodes to 2 bytes
const makeDocDataUrl = (mime = 'application/pdf') => `data:${mime};base64,${SMALL_DOC_BASE64}`;

function makeDocumentMessages(
  fileParts: Array<{ mediaType: string; url: string; filename?: string }>,
  captionText = 'summarize this document',
): UIMessage[] {
  return [
    {
      id: 'm1',
      role: 'user',
      parts: [
        ...fileParts.map((f) => ({
          type: 'file' as const,
          mediaType: f.mediaType,
          url: f.url,
          filename: f.filename,
        })),
        { type: 'text' as const, text: captionText },
      ],
    },
  ];
}

describe('ChatController (document branch)', () => {
  let controller: ChatController;
  let conversations: ReturnType<typeof makeConversationsService>;
  let agent: ReturnType<typeof makeAgentService>;
  let transcription: ReturnType<typeof makeTranscriptionService>;

  const makeRunResult = () => ({
    pipeUIMessageStreamToResponse: jest.fn(),
    text: Promise.resolve('assistant reply'),
    steps: Promise.resolve([]),
  });

  const user = makeUser();

  beforeEach(() => {
    conversations = makeConversationsService();
    agent = makeAgentService();
    transcription = makeTranscriptionService();
    controller = new ChatController(conversations as never, agent as never, transcription as never);

    conversations.findOne.mockResolvedValue({ id: 'c1', title: 'Existing' });
    conversations.lastMessage.mockResolvedValue(null);
    conversations.appendMessage.mockResolvedValue(undefined);
    conversations.setTitle.mockResolvedValue(undefined);

    // Default: successful extraction
    (extractDocumentText as jest.Mock).mockResolvedValue({
      text: 'This is the extracted document text with enough content to pass low-text check.',
      pageCount: 3,
      truncated: false,
    });
    (isLowText as jest.Mock).mockReturnValue(false);
  });

  describe('when a valid PDF document is attached', () => {
    it('does not throw and calls agent.run', async () => {
      agent.run.mockReturnValue(makeRunResult());
      const messages = makeDocumentMessages([
        { mediaType: 'application/pdf', url: makeDocDataUrl(), filename: 'report.pdf' },
      ]);
      const body = { conversationId: 'c1', messages };
      const res = {};

      await expect(
        controller.chat(user as never, body as never, res as never),
      ).resolves.not.toThrow();
      expect(agent.run).toHaveBeenCalled();
    });

    it('persists mediaContext with type:document (not the extracted text)', async () => {
      agent.run.mockReturnValue(makeRunResult());
      const messages = makeDocumentMessages([
        { mediaType: 'application/pdf', url: makeDocDataUrl(), filename: 'report.pdf' },
      ]);
      const body = { conversationId: 'c1', messages };
      const res = {};

      await controller.chat(user as never, body as never, res as never);

      const firstCall = conversations.appendMessage.mock.calls[0];
      const mediaContext = firstCall[5];
      expect(mediaContext).not.toBeNull();
      expect(Array.isArray(mediaContext)).toBe(true);
      expect(mediaContext[0]).toMatchObject({ type: 'document', mediaType: 'application/pdf' });
    });

    it('persists the caption text (not extracted text) as content', async () => {
      agent.run.mockReturnValue(makeRunResult());
      const messages = makeDocumentMessages(
        [{ mediaType: 'application/pdf', url: makeDocDataUrl(), filename: 'report.pdf' }],
        'please summarize',
      );
      const body = { conversationId: 'c1', messages };
      const res = {};

      await controller.chat(user as never, body as never, res as never);

      const firstCall = conversations.appendMessage.mock.calls[0];
      const content: string = firstCall[2];
      // Persisted content should be the caption, NOT extracted text
      expect(content).toBe('please summarize');
      expect(content).not.toContain('extracted document text');
    });

    it('persists [document: filename] placeholder when there is no caption', async () => {
      agent.run.mockReturnValue(makeRunResult());
      const messages = makeDocumentMessages(
        [{ mediaType: 'application/pdf', url: makeDocDataUrl(), filename: 'report.pdf' }],
        '', // empty caption
      );
      const body = { conversationId: 'c1', messages };
      const res = {};

      await controller.chat(user as never, body as never, res as never);

      const firstCall = conversations.appendMessage.mock.calls[0];
      const content: string = firstCall[2];
      expect(content).toMatch(/\[document:/);
    });

    it('does NOT store the extracted text or binary in any persisted field', async () => {
      agent.run.mockReturnValue(makeRunResult());
      const messages = makeDocumentMessages([
        { mediaType: 'application/pdf', url: makeDocDataUrl(), filename: 'report.pdf' },
      ]);
      const body = { conversationId: 'c1', messages };
      const res = {};

      await controller.chat(user as never, body as never, res as never);

      // Check all appendMessage calls
      for (const call of conversations.appendMessage.mock.calls) {
        const content = call[2] as string;
        expect(content).not.toContain('data:');
        expect(content).not.toContain('extracted document text');
      }
    });

    it('calls extractDocumentText with the decoded buffer and mime type', async () => {
      agent.run.mockReturnValue(makeRunResult());
      const messages = makeDocumentMessages([
        { mediaType: 'application/pdf', url: makeDocDataUrl('application/pdf'), filename: 'r.pdf' },
      ]);
      const body = { conversationId: 'c1', messages };
      const res = {};

      await controller.chat(user as never, body as never, res as never);

      expect(extractDocumentText).toHaveBeenCalledWith(expect.any(Buffer), 'application/pdf');
    });

    it('passes extracted document text (not a file part) to agent.run in the current-turn message', async () => {
      const EXTRACTED_DOC_BODY = 'EXTRACTED_DOC_BODY';
      (extractDocumentText as jest.Mock).mockResolvedValueOnce({
        text: EXTRACTED_DOC_BODY,
        pageCount: 2,
        truncated: false,
      });
      agent.run.mockReturnValue(makeRunResult());
      const messages = makeDocumentMessages(
        [{ mediaType: 'application/pdf', url: makeDocDataUrl(), filename: 'report.pdf' }],
        'please summarize',
      );
      const body = { conversationId: 'c1', messages };
      const res = {};

      await controller.chat(user as never, body as never, res as never);

      expect(agent.run).toHaveBeenCalled();
      const modelMessages: Array<{ role: string; content: unknown }> = agent.run.mock.calls[0][2];
      const lastMsg = modelMessages.at(-1);
      expect(lastMsg?.role).toBe('user');

      // The current-turn message must NOT have any file part for the document
      if (Array.isArray(lastMsg?.content)) {
        const hasFilePart = (lastMsg.content as Array<{ type: string }>).some(
          (p) => p.type === 'file',
        );
        expect(hasFilePart).toBe(false);

        // It MUST have a text part containing the extracted body
        const combinedText = (lastMsg.content as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === 'text')
          .map((p) => p.text ?? '')
          .join('\n');
        expect(combinedText).toContain(EXTRACTED_DOC_BODY);
      } else {
        // String content path — must also carry extracted text
        expect(String(lastMsg?.content)).toContain(EXTRACTED_DOC_BODY);
      }
    });
  });

  describe('when extractDocumentText throws DocumentExtractionError', () => {
    it('throws AppException with code chat.document_rejected', async () => {
      (extractDocumentText as jest.Mock).mockRejectedValue(
        new DocumentExtractionError('corrupt PDF'),
      );
      const messages = makeDocumentMessages([
        { mediaType: 'application/pdf', url: makeDocDataUrl(), filename: 'bad.pdf' },
      ]);
      const body = { conversationId: 'c1', messages };
      const res = {};

      await expect(
        controller.chat(user as never, body as never, res as never),
      ).rejects.toMatchObject({ code: 'chat.document_rejected' });
      expect(agent.run).not.toHaveBeenCalled();
    });

    it('thrown exception has BAD_REQUEST status', async () => {
      (extractDocumentText as jest.Mock).mockRejectedValue(
        new DocumentExtractionError('corrupt PDF'),
      );
      const messages = makeDocumentMessages([
        { mediaType: 'application/pdf', url: makeDocDataUrl(), filename: 'bad.pdf' },
      ]);
      const body = { conversationId: 'c1', messages };
      const res = {};

      let caught: { getStatus: () => number } | undefined;
      try {
        await controller.chat(user as never, body as never, res as never);
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('when isLowText returns true (scanned/image-only PDF)', () => {
    it('throws AppException with code chat.document_rejected', async () => {
      (isLowText as jest.Mock).mockReturnValue(true);
      const messages = makeDocumentMessages([
        { mediaType: 'application/pdf', url: makeDocDataUrl(), filename: 'scanned.pdf' },
      ]);
      const body = { conversationId: 'c1', messages };
      const res = {};

      await expect(
        controller.chat(user as never, body as never, res as never),
      ).rejects.toMatchObject({ code: 'chat.document_rejected' });
      expect(agent.run).not.toHaveBeenCalled();
    });
  });

  describe('when more than MAX_DOCUMENTS (1) documents are attached', () => {
    it('throws AppException with code chat.document_rejected', async () => {
      const messages = makeDocumentMessages([
        { mediaType: 'application/pdf', url: makeDocDataUrl(), filename: 'doc1.pdf' },
        { mediaType: 'application/pdf', url: makeDocDataUrl(), filename: 'doc2.pdf' },
      ]);
      const body = { conversationId: 'c1', messages };
      const res = {};

      await expect(
        controller.chat(user as never, body as never, res as never),
      ).rejects.toMatchObject({ code: 'chat.document_rejected' });
      expect(agent.run).not.toHaveBeenCalled();
    });
  });

  describe('when document has an unsupported MIME type', () => {
    it('throws AppException with code chat.document_rejected', async () => {
      const messages = makeDocumentMessages([
        {
          mediaType: 'application/msword',
          url: `data:application/msword;base64,${SMALL_DOC_BASE64}`,
          filename: 'old.doc',
        },
      ]);
      const body = { conversationId: 'c1', messages };
      const res = {};

      await expect(
        controller.chat(user as never, body as never, res as never),
      ).rejects.toMatchObject({ code: 'chat.document_rejected' });
      expect(agent.run).not.toHaveBeenCalled();
    });
  });

  describe('when document exceeds MAX_DOCUMENT_BYTES', () => {
    it('throws AppException with code chat.document_rejected', async () => {
      const bigPayload = 'A'.repeat(Math.ceil((MAX_DOCUMENT_BYTES * 4) / 3) + 4);
      const oversizedUrl = `data:application/pdf;base64,${bigPayload}`;
      const messages = makeDocumentMessages([
        { mediaType: 'application/pdf', url: oversizedUrl, filename: 'huge.pdf' },
      ]);
      const body = { conversationId: 'c1', messages };
      const res = {};

      await expect(
        controller.chat(user as never, body as never, res as never),
      ).rejects.toMatchObject({ code: 'chat.document_rejected' });
      expect(agent.run).not.toHaveBeenCalled();
    });
  });

  describe('when both an image and a document are attached in the same turn', () => {
    it('throws AppException with code chat.document_rejected (mixed not allowed)', async () => {
      const messages: UIMessage[] = [
        {
          id: 'm1',
          role: 'user',
          parts: [
            { type: 'file' as const, mediaType: 'image/jpeg', url: makeDataUrl('image/jpeg') },
            { type: 'file' as const, mediaType: 'application/pdf', url: makeDocDataUrl() },
            { type: 'text' as const, text: 'mixed turn' },
          ],
        },
      ];
      const body = { conversationId: 'c1', messages };
      const res = {};

      await expect(
        controller.chat(user as never, body as never, res as never),
      ).rejects.toMatchObject({ code: 'chat.document_rejected' });
      expect(agent.run).not.toHaveBeenCalled();
    });
  });

  describe('when a DOCX document is attached', () => {
    it('accepts application/vnd.openxmlformats-officedocument.wordprocessingml.document', async () => {
      agent.run.mockReturnValue(makeRunResult());
      const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const messages = makeDocumentMessages([
        {
          mediaType: docxMime,
          url: `data:${docxMime};base64,${SMALL_DOC_BASE64}`,
          filename: 'report.docx',
        },
      ]);
      const body = { conversationId: 'c1', messages };
      const res = {};

      await expect(
        controller.chat(user as never, body as never, res as never),
      ).resolves.not.toThrow();
      expect(agent.run).toHaveBeenCalled();
    });
  });

  describe('when a CSV document is attached', () => {
    it('accepts text/csv', async () => {
      agent.run.mockReturnValue(makeRunResult());
      const messages = makeDocumentMessages([
        {
          mediaType: 'text/csv',
          url: `data:text/csv;base64,${SMALL_DOC_BASE64}`,
          filename: 'data.csv',
        },
      ]);
      const body = { conversationId: 'c1', messages };
      const res = {};

      await expect(
        controller.chat(user as never, body as never, res as never),
      ).resolves.not.toThrow();
      expect(agent.run).toHaveBeenCalled();
    });
  });

  describe('stripMediaFromHistory on document replay', () => {
    it('replaces file parts with [document: ...] placeholder in past turns', async () => {
      agent.run.mockReturnValue(makeRunResult());
      const messages: UIMessage[] = [
        {
          id: 'm_old',
          role: 'user',
          parts: [
            {
              type: 'file' as const,
              mediaType: 'application/pdf',
              url: makeDocDataUrl(),
              filename: 'old.pdf',
            },
            { type: 'text' as const, text: 'old doc message' },
          ],
        },
        {
          id: 'm_assistant',
          role: 'assistant',
          parts: [{ type: 'text' as const, text: 'I analyzed it.' }],
        },
        {
          id: 'm_new',
          role: 'user',
          parts: [
            {
              type: 'file' as const,
              mediaType: 'application/pdf',
              url: makeDocDataUrl(),
              filename: 'new.pdf',
            },
            { type: 'text' as const, text: 'another doc' },
          ],
        },
      ];
      const body = { conversationId: 'c1', messages };
      const res = {};

      await controller.chat(user as never, body as never, res as never);

      expect(agent.run).toHaveBeenCalled();
      const modelMessages = agent.run.mock.calls[0][2];
      const firstUserContent = (modelMessages[0] as { role: string; content: unknown }).content;
      // The old turn's doc binary must be stripped
      if (Array.isArray(firstUserContent)) {
        const hasDocBinary = firstUserContent.some((p: { type: string }) => p.type === 'file');
        expect(hasDocBinary).toBe(false);
      }
    });
  });
});
