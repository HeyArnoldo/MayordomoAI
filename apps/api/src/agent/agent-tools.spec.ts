import { HttpStatus } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { buildAgentTools, type AgentToolsContext } from './agent-tools';

/**
 * Covers the central tool-error localization path: an AppException thrown by a
 * service INSIDE a tool's execute() must surface to the LLM as a localized
 * message (via toolErrorMessage), not the English dev message. Pre-migration
 * Spanish users regressed when service throws bypassed the helper.
 */

// Minimal i18n stub that mimics the errors namespace resolution for the two
// codes exercised here, so we can assert es vs en without booting i18next.
const ES: Record<string, string> = {
  'errors:transaction.box_inactive': 'La caja está inactiva',
  'errors:box.allocation_must_sum_100': 'Los porcentajes deben sumar 100 (suman {{total}})',
};
const EN: Record<string, string> = {
  'errors:transaction.box_inactive': 'The box is inactive',
  'errors:box.allocation_must_sum_100': 'Percentages must add up to 100 (they add up to {{total}})',
};
const makeI18n = () => ({
  t: jest.fn((locale: string, key: string) => (locale === 'en' ? EN[key] : ES[key]) ?? key),
});

const makeAudits = () => ({
  create: jest.fn((x: unknown) => x),
  save: jest.fn(async (x: unknown) => x),
});

function makeCtx(overrides: Partial<AgentToolsContext>): AgentToolsContext {
  return {
    userId: 'u1',
    conversationId: null,
    boxes: {} as never,
    transactions: {} as never,
    recurring: {} as never,
    users: {} as never,
    audits: makeAudits() as never,
    locale: 'es',
    currency: 'PEN',
    ...overrides,
  };
}

describe('buildAgentTools — central service-thrown error localization', () => {
  describe('registerTransaction when the service throws an AppException', () => {
    it('returns the localized es message for an es user', async () => {
      const i18n = makeI18n();
      const transactions = {
        create: jest
          .fn()
          .mockRejectedValue(
            new AppException(
              'transaction.box_inactive',
              HttpStatus.BAD_REQUEST,
              'The box is inactive',
            ),
          ),
      };
      const boxes = {
        findAll: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Comida', active: true }]),
        withBalances: jest.fn().mockResolvedValue([]),
      };
      const ctx = makeCtx({
        locale: 'es',
        i18n,
        transactions: transactions as never,
        boxes: boxes as never,
      });
      const tools = buildAgentTools(ctx);

      const result = (await tools.registerTransaction.execute!(
        { type: 'expense', boxName: 'Comida', amount: 10, userConfirmed: false },
        {} as never,
      )) as { error?: string };

      expect(result.error).toBe('La caja está inactiva');
    });

    it('returns the localized en message for an en user', async () => {
      const i18n = makeI18n();
      const transactions = {
        create: jest
          .fn()
          .mockRejectedValue(
            new AppException(
              'transaction.box_inactive',
              HttpStatus.BAD_REQUEST,
              'The box is inactive',
            ),
          ),
      };
      const boxes = {
        findAll: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Food', active: true }]),
        withBalances: jest.fn().mockResolvedValue([]),
      };
      const ctx = makeCtx({
        locale: 'en',
        i18n,
        transactions: transactions as never,
        boxes: boxes as never,
      });
      const tools = buildAgentTools(ctx);

      const result = (await tools.registerTransaction.execute!(
        { type: 'expense', boxName: 'Food', amount: 10, userConfirmed: false },
        {} as never,
      )) as { error?: string };

      expect(result.error).toBe('The box is inactive');
    });
  });

  describe('when no i18n is present in context', () => {
    it('re-throws the service error (legacy behavior, no localization)', async () => {
      const transactions = {
        create: jest
          .fn()
          .mockRejectedValue(
            new AppException(
              'transaction.box_inactive',
              HttpStatus.BAD_REQUEST,
              'The box is inactive',
            ),
          ),
      };
      const boxes = {
        findAll: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Comida', active: true }]),
        withBalances: jest.fn().mockResolvedValue([]),
      };
      const ctx = makeCtx({
        locale: 'es',
        i18n: undefined,
        transactions: transactions as never,
        boxes: boxes as never,
      });
      const tools = buildAgentTools(ctx);

      await expect(
        tools.registerTransaction.execute!(
          { type: 'expense', boxName: 'Comida', amount: 10, userConfirmed: false },
          {} as never,
        ),
      ).rejects.toBeInstanceOf(AppException);
    });
  });
});
