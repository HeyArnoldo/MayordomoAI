import { WhatsappService, EvolutionWebhookPayload } from './whatsapp.service';
import * as aiConfig from '../agent/ai.config';

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

const makeRecurring = () => ({});

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
});
