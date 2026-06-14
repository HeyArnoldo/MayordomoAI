import { HttpStatus } from '@nestjs/common';
import { Channel } from '@app/contracts';
import { AppException } from '../common/errors/app.exception';
import { ChatController } from './chat.controller';
import type { UIMessage } from 'ai';
import { MAX_IMAGE_BYTES, MAX_IMAGES } from '../agent/media.constants';

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
