import { HttpStatus } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { AgentService } from './agent.service';
import * as aiConfig from './ai.config';

// Mock the `ai` SDK at module level (non-configurable exports require jest.mock).
jest.mock('ai', () => ({
  generateText: jest.fn(),
  streamText: jest.fn(),
  stepCountIs: jest.fn(),
  convertToModelMessages: jest.fn(),
  // tool() is used by buildAgentTools; return an identity so run() doesn't crash.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: (def: any) => def,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const aiMock = require('ai') as {
  generateText: jest.Mock;
  streamText: jest.Mock;
};

// ── Stubs ────────────────────────────────────────────────────────────────────

const makeAiUsageService = () => ({ record: jest.fn() });

const makeI18n = () => ({
  t: jest.fn().mockReturnValue('translated'),
});

const makeOnboarding = () => ({
  isOnboarding: jest.fn().mockResolvedValue(false),
  confirmOnboarding: jest.fn().mockResolvedValue(undefined),
});

function makeService(): AgentService {
  return new AgentService(
    {} as never,
    {} as never,
    makeAiUsageService() as never,
    {} as never,
    makeOnboarding() as never,
    { save: jest.fn(), create: jest.fn() } as never,
    makeI18n() as never,
  );
}

// ── T-2.9a: run() throws AppException when AI is disabled ────────────────────

describe('AgentService.run', () => {
  let service: AgentService;

  beforeEach(() => {
    service = makeService();
    jest.spyOn(aiConfig, 'isAiEnabled').mockReturnValue(false);
  });

  afterEach(() => jest.restoreAllMocks());

  it('throws AppException with code agent.ai_credentials_missing', () => {
    expect(() => service.run('u1', null, [], undefined, undefined)).toThrow(
      expect.objectContaining({ code: 'agent.ai_credentials_missing' }),
    );
  });

  it('thrown exception has SERVICE_UNAVAILABLE status', () => {
    let caught: { getStatus: () => number } | undefined;
    try {
      service.run('u1', null, [], undefined, undefined);
    } catch (e) {
      caught = e as typeof caught;
    }
    expect(caught?.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('throws AppException (not a plain ServiceUnavailableException)', () => {
    let caught: unknown;
    try {
      service.run('u1', null, [], undefined, undefined);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppException);
  });
});

// ── T-2.9b: suggestTitle locale-conditional system prompt ────────────────────

describe('AgentService.suggestTitle', () => {
  let service: AgentService;

  beforeEach(() => {
    service = makeService();
    jest.spyOn(aiConfig, 'isAiEnabled').mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(aiConfig, 'parserModel').mockReturnValue('model' as any);
    jest.spyOn(aiConfig, 'parserModelName').mockReturnValue('model');
    aiMock.generateText.mockResolvedValue({
      text: 'Title',
      usage: { inputTokens: 5, outputTokens: 3 },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('uses a Spanish system prompt when locale is es', async () => {
    await service.suggestTitle('u1', 'gasté en taxi', 'Registré el gasto', 'es');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const system: string = aiMock.generateText.mock.calls[0][0].system as string;
    expect(system).toMatch(/español/i);
    expect(system).not.toMatch(/english/i);
  });

  it('uses an English system prompt when locale is en', async () => {
    await service.suggestTitle('u1', 'taxi ride', 'Expense logged', 'en');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const system: string = aiMock.generateText.mock.calls[0][0].system as string;
    expect(system).toMatch(/english/i);
    expect(system).not.toMatch(/español/i);
  });

  it('defaults to Spanish when no locale is provided', async () => {
    await service.suggestTitle('u1', 'gasté en taxi', 'Registré el gasto');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const system: string = aiMock.generateText.mock.calls[0][0].system as string;
    expect(system).toMatch(/español/i);
  });

  it('returns null when AI is disabled', async () => {
    jest.spyOn(aiConfig, 'isAiEnabled').mockReturnValue(false);
    const result = await service.suggestTitle('u1', 'text', 'response');
    expect(result).toBeNull();
  });

  it('trims and strips surrounding quotes from the title', async () => {
    aiMock.generateText.mockResolvedValueOnce({
      text: '"My title"',
      usage: { inputTokens: 5, outputTokens: 3 },
    });
    const result = await service.suggestTitle('u1', 'text', 'response');
    expect(result).toBe('My title');
  });
});

// ── G1: buildSystemPrompt — receipt/vision hint ───────────────────────────────
// These tests check that a DEDICATED image/receipt block exists in the prompt,
// not just coincidental presence of shared words from other rules.

describe('AgentService.buildSystemPrompt — receipt hint', () => {
  let service: AgentService;

  beforeEach(() => {
    service = makeService();
  });

  it('English prompt contains a receipt-analysis block that mentions image, amount, merchant, and date together', () => {
    const prompt = service.buildSystemPrompt('en', 'USD');
    // The receipt block must contain all four concepts in a contiguous section.
    // Find the line(s) that mention "image" and check the surrounding context
    // contains amount/merchant/date guidance.
    const lines = prompt.split('\n');
    const receiptLineIdx = lines.findIndex((l) => /image/i.test(l) && /receipt/i.test(l));
    expect(receiptLineIdx).toBeGreaterThanOrEqual(0);
    // The same line or nearby lines must mention the data we want to extract.
    const block = lines.slice(Math.max(0, receiptLineIdx - 1), receiptLineIdx + 4).join('\n');
    expect(block).toMatch(/amount/i);
    expect(block).toMatch(/merchant/i);
    expect(block).toMatch(/date/i);
  });

  it('Spanish prompt contains a receipt-analysis block that mentions imagen, monto, comercio, and fecha together', () => {
    const prompt = service.buildSystemPrompt('es', 'PEN');
    const lines = prompt.split('\n');
    const receiptLineIdx = lines.findIndex((l) => /imagen/i.test(l) && /recib/i.test(l));
    expect(receiptLineIdx).toBeGreaterThanOrEqual(0);
    const block = lines.slice(Math.max(0, receiptLineIdx - 1), receiptLineIdx + 4).join('\n');
    expect(block).toMatch(/monto/i);
    expect(block).toMatch(/comercio/i);
    expect(block).toMatch(/fecha/i);
  });

  it('English receipt block instructs to PROPOSE (not silently register) and ask confirmation', () => {
    const prompt = service.buildSystemPrompt('en', 'USD');
    const lines = prompt.split('\n');
    const receiptLineIdx = lines.findIndex((l) => /image/i.test(l) && /receipt/i.test(l));
    const block = lines.slice(Math.max(0, receiptLineIdx - 1), receiptLineIdx + 4).join('\n');
    expect(block).toMatch(/propose|suggest/i);
    // Must include confirmation requirement
    expect(block).toMatch(/confirm/i);
  });

  it('Spanish receipt block instructs to PROPOSE not auto-register', () => {
    const prompt = service.buildSystemPrompt('es', 'PEN');
    const lines = prompt.split('\n');
    const receiptLineIdx = lines.findIndex((l) => /imagen/i.test(l) && /recib/i.test(l));
    const block = lines.slice(Math.max(0, receiptLineIdx - 1), receiptLineIdx + 4).join('\n');
    expect(block).toMatch(/propón|propone|sugiere/i);
  });
});

// ── T-2.9c: locale passthrough — run() forwards locale to buildSystemPrompt ──

describe('AgentService.run locale passthrough', () => {
  let service: AgentService;

  beforeEach(() => {
    service = makeService();
    jest.spyOn(aiConfig, 'isAiEnabled').mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(aiConfig, 'agentModel').mockReturnValue('model' as any);
    jest.spyOn(aiConfig, 'agentModelName').mockReturnValue('model');
    aiMock.streamText.mockReturnValue({ onFinish: undefined });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('forwards en locale to buildSystemPrompt', () => {
    const spy = jest.spyOn(service, 'buildSystemPrompt');
    service.run('u1', null, [], undefined, 'User', 'en', 'USD');
    expect(spy).toHaveBeenCalledWith('en', 'USD', 'User');
  });

  it('defaults to es locale when not provided', () => {
    const spy = jest.spyOn(service, 'buildSystemPrompt');
    service.run('u1', null, [], undefined, 'User');
    expect(spy).toHaveBeenCalledWith('es', 'PEN', 'User');
  });
});
