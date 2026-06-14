import { WhatsappService, EvolutionWebhookPayload } from './whatsapp.service';
import * as aiConfig from '../agent/ai.config';
import { MAX_IMAGE_BYTES } from '../agent/media.constants';

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
