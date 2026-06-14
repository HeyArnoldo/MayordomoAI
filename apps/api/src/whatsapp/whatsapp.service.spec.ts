import { WhatsappService, EvolutionWebhookPayload } from './whatsapp.service';
import * as aiConfig from '../agent/ai.config';
import { MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES } from '../agent/media.constants';
import { DocumentExtractionError } from '../agent/document.extract';

// Mock extractDocumentText so WhatsApp tests don't touch real parsers
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

// Ensure isAiEnabled returns true for all tests in this suite
jest.spyOn(aiConfig, 'isAiEnabled').mockReturnValue(true);

// ── Helpers ──────────────────────────────────────────────────────────────────

// Small valid base64 payload (decodes to 2 bytes — well within MAX_IMAGE_BYTES)
const SMALL_BASE64 = 'abc=';

function makeImagePayload(
  opts: { caption?: string; mimetype?: string; base64InPayload?: string } = {},
): EvolutionWebhookPayload {
  return {
    event: 'messages.upsert',
    data: {
      key: { remoteJid: '51999999999@s.whatsapp.net', fromMe: false, id: 'msg-img-001' },
      pushName: 'Test User',
      message: {
        imageMessage: {
          caption: opts.caption,
          mimetype: opts.mimetype ?? 'image/jpeg',
        },
        // When base64 is inline in the payload
        ...(opts.base64InPayload ? { base64: opts.base64InPayload } : {}),
      },
      messageType: 'imageMessage',
    },
  };
}

// ── Stubs ─────────────────────────────────────────────────────────────────────

const makePhones = (user: object) => ({
  findOne: jest.fn().mockResolvedValue({ e164: '+51999999999', user }),
});

const makeUser = (overrides: object = {}) => ({
  id: 'u1',
  name: 'Test User',
  language: 'es' as const,
  currency: 'PEN',
  status: 'active',
  ...overrides,
});

const makeEvolution = (base64Return: string | null = SMALL_BASE64) => ({
  enabled: jest.fn().mockReturnValue(true),
  sendText: jest.fn().mockResolvedValue(undefined),
  getBase64: jest.fn().mockResolvedValue(base64Return),
});

const makeAgentService = (textReply = 'agent reply') => ({
  run: jest.fn().mockReturnValue({ text: Promise.resolve(textReply) }),
  buildSystemPrompt: jest.fn().mockReturnValue('system'),
});

const makeConversations = () => ({
  ensureWhatsAppThread: jest.fn().mockResolvedValue({ id: 'thread-1' }),
  appendMessage: jest.fn().mockResolvedValue(undefined),
  listMessages: jest.fn().mockResolvedValue([]),
});

const makeInboundLog = () => ({
  exists: jest.fn().mockResolvedValue(false),
  save: jest.fn().mockResolvedValue(undefined),
  create: jest.fn().mockImplementation((v: unknown) => v),
});

const makeI18n = () => ({
  t: jest.fn().mockImplementation((_lang: string, key: string) => `i18n:${key}`),
});

const makeBoxes = () => ({
  findAll: jest.fn().mockResolvedValue([]),
  withBalances: jest.fn().mockResolvedValue([]),
});

const makeTransactions = () => ({
  create: jest.fn().mockResolvedValue({ split: [] }),
});

const makeTranscription = () => ({
  transcribe: jest.fn().mockResolvedValue(null),
});

function makeService(
  overrides: {
    evolution?: ReturnType<typeof makeEvolution>;
    agent?: ReturnType<typeof makeAgentService>;
    conversations?: ReturnType<typeof makeConversations>;
    phones?: ReturnType<typeof makePhones>;
    user?: object;
  } = {},
) {
  const user = overrides.user ?? makeUser();
  const phones = overrides.phones ?? makePhones(user);
  const evolution = overrides.evolution ?? makeEvolution();
  const agent = overrides.agent ?? makeAgentService();
  const conversations = overrides.conversations ?? makeConversations();
  const inboundLog = makeInboundLog();
  const i18n = makeI18n();
  const boxes = makeBoxes();
  const transactions = makeTransactions();
  const transcription = makeTranscription();

  const service = new WhatsappService(
    inboundLog as never,
    phones as never,
    boxes as never,
    transactions as never,
    agent as never,
    conversations as never,
    evolution as never,
    transcription as never,
    i18n as never,
  );

  return { service, evolution, agent, conversations, i18n, inboundLog };
}

// ── F1: imageMessage branch ───────────────────────────────────────────────────

describe('WhatsappService.processInbound — imageMessage branch', () => {
  describe('when an image with caption arrives', () => {
    it('calls getBase64 to retrieve the binary', async () => {
      const { service, evolution } = makeService();
      const payload = makeImagePayload({ caption: 'Mi recibo del taxi' });

      await service.processInbound(payload);

      expect(evolution.getBase64).toHaveBeenCalledWith('msg-img-001');
    });

    it('calls agent.run with an image part and a text part (caption)', async () => {
      const { service, agent } = makeService();
      const payload = makeImagePayload({ caption: 'Mi recibo del taxi' });

      await service.processInbound(payload);

      expect(agent.run).toHaveBeenCalled();
      const runArgs = agent.run.mock.calls[0];
      const messages: Array<{ role: string; content: unknown }> = runArgs[2];
      // Last message must be the current user turn with image + text parts
      const lastMsg = messages.at(-1);
      expect(lastMsg?.role).toBe('user');
      expect(Array.isArray(lastMsg?.content)).toBe(true);
      const parts = lastMsg?.content as Array<{ type: string }>;
      expect(parts.some((p) => p.type === 'image')).toBe(true);
      expect(parts.some((p) => p.type === 'text')).toBe(true);
    });

    it('sends the agent reply back via evolution.sendText', async () => {
      const { service, evolution } = makeService({
        agent: makeAgentService('Great receipt!'),
      });
      const payload = makeImagePayload({ caption: 'test' });

      await service.processInbound(payload);

      expect(evolution.sendText).toHaveBeenCalledWith('+51999999999', 'Great receipt!');
    });
  });

  describe('when an image WITHOUT caption arrives', () => {
    it('calls agent.run with only the image part (no text part)', async () => {
      const { service, agent } = makeService();
      const payload = makeImagePayload({ caption: undefined });

      await service.processInbound(payload);

      expect(agent.run).toHaveBeenCalled();
      const runArgs = agent.run.mock.calls[0];
      const messages: Array<{ role: string; content: unknown }> = runArgs[2];
      const lastMsg = messages.at(-1);
      const parts = lastMsg?.content as Array<{ type: string; text?: string }>;
      expect(Array.isArray(parts)).toBe(true);
      expect(parts.some((p) => p.type === 'image')).toBe(true);
      // No empty text parts
      const textParts = parts.filter((p) => p.type === 'text');
      // Either no text parts at all, or the text part is empty string — but NOT a non-empty caption
      if (textParts.length > 0) {
        textParts.forEach((tp) => expect(tp.text).toBeFalsy());
      }
    });

    it('sends the agent reply back', async () => {
      const { service, evolution } = makeService({
        agent: makeAgentService('I see a receipt.'),
      });
      const payload = makeImagePayload();

      await service.processInbound(payload);

      expect(evolution.sendText).toHaveBeenCalledWith('+51999999999', 'I see a receipt.');
    });
  });

  describe('when getBase64 returns null', () => {
    it('does NOT call agent.run', async () => {
      const { service, agent } = makeService({
        evolution: makeEvolution(null),
      });
      const payload = makeImagePayload({ caption: 'test' });

      await service.processInbound(payload);

      expect(agent.run).not.toHaveBeenCalled();
    });

    it('sends the imageNotUnderstood fallback to the user', async () => {
      const { service, evolution, i18n } = makeService({
        evolution: makeEvolution(null),
      });
      const payload = makeImagePayload({ caption: 'test' });

      await service.processInbound(payload);

      expect(i18n.t).toHaveBeenCalledWith(expect.anything(), 'whatsapp.imageNotUnderstood');
      expect(evolution.sendText).toHaveBeenCalledWith(
        '+51999999999',
        'i18n:whatsapp.imageNotUnderstood',
      );
    });
  });

  describe('when getBase64 throws an error', () => {
    it('does NOT call agent.run', async () => {
      const evolution = makeEvolution();
      evolution.getBase64.mockRejectedValue(new Error('Evolution timeout'));
      const { service, agent } = makeService({ evolution });
      const payload = makeImagePayload({ caption: 'test' });

      await service.processInbound(payload);

      expect(agent.run).not.toHaveBeenCalled();
    });

    it('sends the imageNotUnderstood fallback to the user', async () => {
      const evolution = makeEvolution();
      evolution.getBase64.mockRejectedValue(new Error('Evolution timeout'));
      const { service, i18n } = makeService({ evolution });
      const payload = makeImagePayload({ caption: 'test' });

      await service.processInbound(payload);

      expect(i18n.t).toHaveBeenCalledWith(expect.anything(), 'whatsapp.imageNotUnderstood');
      expect(evolution.sendText).toHaveBeenCalledWith(
        '+51999999999',
        'i18n:whatsapp.imageNotUnderstood',
      );
    });

    it('logs the error for observability', async () => {
      const evolution = makeEvolution();
      evolution.getBase64.mockRejectedValue(new Error('Evolution timeout'));
      const { service } = makeService({ evolution });
      const payload = makeImagePayload({ caption: 'test' });
      const loggerSpy = jest
        .spyOn((service as unknown as { logger: { error: jest.Mock } }).logger, 'error')
        .mockImplementation(() => {});

      await service.processInbound(payload);

      expect(loggerSpy).toHaveBeenCalled();
      loggerSpy.mockRestore();
    });
  });

  describe('when the image exceeds MAX_IMAGE_BYTES', () => {
    it('sends imageTooLarge and does NOT call agent.run', async () => {
      // Build a raw base64 string that decodes to more than MAX_IMAGE_BYTES.
      // base64Bytes(s) = floor(len * 3 / 4) - padding.
      // Using len = MAX_IMAGE_BYTES * 2 (no padding) gives decoded = MAX_IMAGE_BYTES * 1.5 > MAX_IMAGE_BYTES.
      const oversizedBase64 = 'A'.repeat(MAX_IMAGE_BYTES * 2);
      const evolution = makeEvolution(oversizedBase64);
      const { service, agent, i18n } = makeService({ evolution });
      const payload = makeImagePayload({ caption: 'big image' });

      await expect(service.processInbound(payload)).resolves.toBeUndefined();

      expect(i18n.t).toHaveBeenCalledWith(expect.anything(), 'whatsapp.imageTooLarge');
      expect(evolution.sendText).toHaveBeenCalledWith(
        '+51999999999',
        'i18n:whatsapp.imageTooLarge',
      );
      expect(agent.run).not.toHaveBeenCalled();
    });
  });

  describe('when there is prior conversation history', () => {
    it('passes prior turns + one multimodal current turn to agent.run (no duplicate caption row)', async () => {
      const caption = 'here is my receipt';

      // Simulate what the real flow produces: appendMessage is called before listMessages,
      // so listMessages returns prior turns PLUS the just-appended caption row.
      const priorMessages = [
        { role: 'assistant', content: 'How can I help?' },
        { role: 'user', content: 'I want to log an expense' },
      ];
      const captionRow = { role: 'user', content: caption };
      const allMessages = [...priorMessages, captionRow];

      const conversations = makeConversations();
      conversations.listMessages.mockResolvedValue(allMessages);

      const { service, agent } = makeService({ conversations });
      const payload = makeImagePayload({ caption });

      await service.processInbound(payload);

      expect(agent.run).toHaveBeenCalled();
      const messages: Array<{ role: string; content: unknown }> = agent.run.mock.calls[0][2];

      // Should have prior turns count + exactly 1 current multimodal turn
      expect(messages).toHaveLength(priorMessages.length + 1);

      // Prior turns should be text-only (strings), not arrays
      for (let i = 0; i < priorMessages.length; i++) {
        expect(messages[i].role).toBe(priorMessages[i].role);
        expect(messages[i].content).toBe(priorMessages[i].content);
      }

      // Last message must be the multimodal current turn (not the plain caption row)
      const lastMsg = messages.at(-1)!;
      expect(lastMsg.role).toBe('user');
      expect(Array.isArray(lastMsg.content)).toBe(true);
      const parts = lastMsg.content as Array<{ type: string; text?: string }>;
      expect(parts.some((p) => p.type === 'image')).toBe(true);
      expect(parts.some((p) => p.type === 'text' && p.text === caption)).toBe(true);

      // No extra plain-text caption row should be present
      const plainCaptionRows = messages.filter(
        (m) => !Array.isArray(m.content) && m.content === caption,
      );
      expect(plainCaptionRows).toHaveLength(0);
    });
  });
});

// ── F2: documentMessage branch ────────────────────────────────────────────────

function makeDocumentPayload(
  opts: {
    caption?: string;
    mimetype?: string;
    fileName?: string;
    base64InPayload?: string;
  } = {},
): EvolutionWebhookPayload {
  return {
    event: 'messages.upsert',
    data: {
      key: { remoteJid: '51999999999@s.whatsapp.net', fromMe: false, id: 'msg-doc-001' },
      pushName: 'Test User',
      message: {
        documentMessage: {
          caption: opts.caption,
          mimetype: opts.mimetype ?? 'application/pdf',
          fileName: opts.fileName ?? 'report.pdf',
        },
        ...(opts.base64InPayload ? { base64: opts.base64InPayload } : {}),
      },
      messageType: 'documentMessage',
    },
  };
}

describe('WhatsappService.processInbound — documentMessage branch', () => {
  beforeEach(() => {
    // Default: successful extraction returning enough text
    (extractDocumentText as jest.Mock).mockResolvedValue({
      text: 'This is the extracted document text with enough content to pass the low-text threshold.',
      pageCount: 2,
      truncated: false,
    });
    (isLowText as jest.Mock).mockReturnValue(false);
  });

  describe('when a document with caption arrives and extraction succeeds', () => {
    it('calls getBase64 to retrieve the binary', async () => {
      const { service, evolution } = makeService();
      const payload = makeDocumentPayload({ caption: 'My bank statement' });

      await service.processInbound(payload);

      expect(evolution.getBase64).toHaveBeenCalledWith('msg-doc-001');
    });

    it('calls extractDocumentText with the decoded buffer', async () => {
      const { service } = makeService();
      const payload = makeDocumentPayload({ caption: 'analyze this' });

      await service.processInbound(payload);

      expect(extractDocumentText).toHaveBeenCalledWith(expect.any(Buffer), 'application/pdf');
    });

    it('calls agent.run with text-only content (no ImagePart)', async () => {
      const EXTRACTED = 'EXTRACTED_DOC_BODY';
      (extractDocumentText as jest.Mock).mockResolvedValueOnce({
        text: EXTRACTED,
        pageCount: 1,
        truncated: false,
      });
      const { service, agent } = makeService();
      const payload = makeDocumentPayload({ caption: 'analyze this' });

      await service.processInbound(payload);

      expect(agent.run).toHaveBeenCalled();
      const runArgs = agent.run.mock.calls[0];
      const messages: Array<{ role: string; content: unknown }> = runArgs[2];
      const lastMsg = messages.at(-1);
      expect(lastMsg?.role).toBe('user');
      const content = lastMsg?.content;
      // Content must be text-only — no image part
      if (Array.isArray(content)) {
        const hasImagePart = content.some((p: { type: string }) => p.type === 'image');
        expect(hasImagePart).toBe(false);
        // The extracted document body must appear in one of the text parts
        const combinedText = content
          .filter((p: { type: string; text?: string }) => p.type === 'text')
          .map((p: { type: string; text?: string }) => p.text ?? '')
          .join('\n');
        expect(combinedText).toContain(EXTRACTED);
      } else {
        // String content must also carry the extracted text
        expect(String(content)).toContain(EXTRACTED);
      }
    });

    it('sends the agent reply back via evolution.sendText', async () => {
      const { service, evolution } = makeService({
        agent: makeAgentService('Great, I analyzed the document!'),
      });
      const payload = makeDocumentPayload({ caption: 'analyze this' });

      await service.processInbound(payload);

      expect(evolution.sendText).toHaveBeenCalledWith(
        '+51999999999',
        'Great, I analyzed the document!',
      );
    });

    it('persists user turn with caption as content and document mediaContext', async () => {
      const { service, conversations } = makeService();
      const payload = makeDocumentPayload({ caption: 'my bank statement', fileName: 'bank.pdf' });

      await service.processInbound(payload);

      expect(conversations.appendMessage).toHaveBeenCalled();
      const userTurnCall = conversations.appendMessage.mock.calls[0];
      const content = userTurnCall[2];
      const mediaCtx = userTurnCall[5];
      expect(content).toBe('my bank statement');
      expect(Array.isArray(mediaCtx)).toBe(true);
      expect(mediaCtx[0]).toMatchObject({ type: 'document' });
    });
  });

  describe('when a document WITHOUT caption arrives', () => {
    it('calls agent.run (caption becomes empty but doc is still processed)', async () => {
      const { service, agent } = makeService();
      const payload = makeDocumentPayload({ caption: undefined, fileName: 'statement.pdf' });

      await service.processInbound(payload);

      expect(agent.run).toHaveBeenCalled();
    });

    it('persists [document: fileName] placeholder as content when no caption', async () => {
      const { service, conversations } = makeService();
      const payload = makeDocumentPayload({ caption: undefined, fileName: 'statement.pdf' });

      await service.processInbound(payload);

      const userTurnCall = conversations.appendMessage.mock.calls[0];
      const content = userTurnCall[2];
      expect(content).toMatch(/\[document:/);
    });
  });

  describe('when getBase64 returns null', () => {
    it('does NOT call agent.run', async () => {
      const { service, agent } = makeService({
        evolution: makeEvolution(null),
      });
      const payload = makeDocumentPayload({ caption: 'test doc' });

      await service.processInbound(payload);

      expect(agent.run).not.toHaveBeenCalled();
    });

    it('sends the documentNotUnderstood fallback to the user', async () => {
      const { service, evolution, i18n } = makeService({
        evolution: makeEvolution(null),
      });
      const payload = makeDocumentPayload({ caption: 'test doc' });

      await service.processInbound(payload);

      expect(i18n.t).toHaveBeenCalledWith(expect.anything(), 'whatsapp.documentNotUnderstood');
      expect(evolution.sendText).toHaveBeenCalledWith(
        '+51999999999',
        'i18n:whatsapp.documentNotUnderstood',
      );
    });
  });

  describe('when getBase64 throws an error', () => {
    it('does NOT call agent.run', async () => {
      const evolution = makeEvolution();
      evolution.getBase64.mockRejectedValue(new Error('Evolution network error'));
      const { service, agent } = makeService({ evolution });
      const payload = makeDocumentPayload({ caption: 'test doc' });

      await service.processInbound(payload);

      expect(agent.run).not.toHaveBeenCalled();
    });

    it('sends the documentNotUnderstood fallback to the user', async () => {
      const evolution = makeEvolution();
      evolution.getBase64.mockRejectedValue(new Error('Evolution network error'));
      const { service, i18n } = makeService({ evolution });
      const payload = makeDocumentPayload({ caption: 'test doc' });

      await service.processInbound(payload);

      expect(i18n.t).toHaveBeenCalledWith(expect.anything(), 'whatsapp.documentNotUnderstood');
    });

    it('logs the error for observability', async () => {
      const evolution = makeEvolution();
      evolution.getBase64.mockRejectedValue(new Error('Evolution network error'));
      const { service } = makeService({ evolution });
      const payload = makeDocumentPayload({ caption: 'test doc' });
      const loggerSpy = jest
        .spyOn((service as unknown as { logger: { error: jest.Mock } }).logger, 'error')
        .mockImplementation(() => {});

      await service.processInbound(payload);

      expect(loggerSpy).toHaveBeenCalled();
      loggerSpy.mockRestore();
    });
  });

  describe('when the document exceeds MAX_DOCUMENT_BYTES', () => {
    it('sends documentTooLarge and does NOT call agent.run', async () => {
      // Build a raw base64 string that decodes to more than MAX_DOCUMENT_BYTES.
      const oversizedBase64 = 'A'.repeat(MAX_DOCUMENT_BYTES * 2);
      const evolution = makeEvolution(oversizedBase64);
      const { service, agent, i18n } = makeService({ evolution });
      const payload = makeDocumentPayload({ caption: 'big doc' });

      await expect(service.processInbound(payload)).resolves.toBeUndefined();

      expect(i18n.t).toHaveBeenCalledWith(expect.anything(), 'whatsapp.documentTooLarge');
      expect(evolution.sendText).toHaveBeenCalledWith(
        '+51999999999',
        'i18n:whatsapp.documentTooLarge',
      );
      expect(agent.run).not.toHaveBeenCalled();
    });
  });

  describe('when isLowText returns true (scanned/image-only document)', () => {
    it('sends documentNoText and does NOT call agent.run', async () => {
      (isLowText as jest.Mock).mockReturnValue(true);
      const { service, agent, i18n, evolution } = makeService();
      const payload = makeDocumentPayload({ caption: 'scanned pdf' });

      await service.processInbound(payload);

      expect(i18n.t).toHaveBeenCalledWith(expect.anything(), 'whatsapp.documentNoText');
      expect(evolution.sendText).toHaveBeenCalledWith(
        '+51999999999',
        'i18n:whatsapp.documentNoText',
      );
      expect(agent.run).not.toHaveBeenCalled();
    });
  });

  describe('when extractDocumentText throws DocumentExtractionError', () => {
    it('sends documentNotUnderstood and does NOT call agent.run', async () => {
      (extractDocumentText as jest.Mock).mockRejectedValue(
        new DocumentExtractionError('corrupt PDF'),
      );
      const { service, agent, i18n, evolution } = makeService();
      const payload = makeDocumentPayload({ caption: 'bad pdf' });

      await service.processInbound(payload);

      expect(i18n.t).toHaveBeenCalledWith(expect.anything(), 'whatsapp.documentNotUnderstood');
      expect(evolution.sendText).toHaveBeenCalledWith(
        '+51999999999',
        'i18n:whatsapp.documentNotUnderstood',
      );
      expect(agent.run).not.toHaveBeenCalled();
    });
  });

  describe('when the document has an unsupported MIME type', () => {
    it('sends documentNotUnderstood and does NOT call agent.run', async () => {
      // application/zip is not in the allowed MIME list — validateDocument should throw
      const { service, agent, i18n, evolution } = makeService();
      const payload = makeDocumentPayload({
        caption: 'here is my zip',
        mimetype: 'application/zip',
        fileName: 'archive.zip',
      });

      await service.processInbound(payload);

      expect(i18n.t).toHaveBeenCalledWith(expect.anything(), 'whatsapp.documentNotUnderstood');
      expect(evolution.sendText).toHaveBeenCalledWith(
        '+51999999999',
        'i18n:whatsapp.documentNotUnderstood',
      );
      expect(agent.run).not.toHaveBeenCalled();
    });
  });

  describe('when AI is disabled', () => {
    it('sends aiDisabled fallback and does NOT call agent.run', async () => {
      jest.spyOn(aiConfig, 'isAiEnabled').mockReturnValueOnce(false);
      const { service, agent, i18n } = makeService();
      const payload = makeDocumentPayload({ caption: 'doc when ai off' });

      await service.processInbound(payload);

      expect(i18n.t).toHaveBeenCalledWith(expect.anything(), 'whatsapp.aiDisabled');
      expect(agent.run).not.toHaveBeenCalled();
    });
  });
});
