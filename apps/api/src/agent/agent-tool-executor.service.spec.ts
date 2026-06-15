import { HttpStatus, Logger } from '@nestjs/common';
import { TransactionType } from '@app/contracts';
import { AppException } from '../common/errors/app.exception';
import { AgentToolExecutorService } from './agent-tool-executor.service';
import type { ToolExecCtx } from './agent-tool-executor.service';

// ---------------------------------------------------------------------------
// Minimal stubs
// ---------------------------------------------------------------------------

const makeAudits = () => ({
  create: jest.fn((x: unknown) => x),
  save: jest.fn(async (x: unknown) => x),
});

const makeI18n = () => ({
  t: jest.fn((locale: string, key: string) => {
    const map: Record<string, Record<string, string>> = {
      es: { 'errors:transaction.box_inactive': 'La caja está inactiva' },
      en: { 'errors:transaction.box_inactive': 'The box is inactive' },
    };
    return map[locale]?.[key] ?? key;
  }),
});

const makeCtx = (overrides?: Partial<ToolExecCtx>): ToolExecCtx => ({
  userId: 'user-1',
  conversationId: null,
  locale: 'es',
  currency: 'PEN',
  ...overrides,
});

function makeService(deps?: {
  boxes?: unknown;
  transactions?: unknown;
  users?: unknown;
  audits?: unknown;
}) {
  return new AgentToolExecutorService(
    (deps?.boxes ?? {
      withBalances: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([]),
    }) as never,
    (deps?.transactions ?? {
      create: jest.fn(),
      list: jest.fn().mockResolvedValue([]),
    }) as never,
    (deps?.users ?? {}) as never,
    (deps?.audits ?? makeAudits()) as never,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentToolExecutorService', () => {
  // Silence the expected server-side error logs that fire whenever a tool run
  // throws a non-AppException error in these specs (they assert on the returned
  // value, not on log output).
  let loggerErrorSpy: jest.SpyInstance;
  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  // ── Confirmation threshold (registerTransaction) ────────────────────────
  describe('registerTransaction — confirmation guard', () => {
    it('expense < threshold (50): persists immediately, no needsConfirmation', async () => {
      const tx = {
        id: 'tx-1',
        type: 'expense',
        amount: 50,
        boxId: 'b1',
        date: '2026-06-01',
        note: null,
        status: 'confirmed',
        source: 'pwa',
        split: null,
        voice: false,
        currency: 'PEN',
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      const boxes = {
        findAll: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Comida', active: true }]),
        withBalances: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Comida' }]),
      };
      const transactions = {
        create: jest.fn().mockResolvedValue(tx),
      };
      const audits = makeAudits();
      const svc = makeService({ boxes, transactions, audits });
      const ctx = makeCtx({ i18n: makeI18n() });

      const result = (await svc.registerTransaction(ctx, {
        type: TransactionType.EXPENSE,
        boxName: 'Comida',
        amount: 50,
        userConfirmed: false,
      })) as Record<string, unknown>;

      expect(result.needsConfirmation).toBeUndefined();
      expect(transactions.create).toHaveBeenCalledTimes(1);
      expect(audits.save).toHaveBeenCalledTimes(1);
    });

    it('expense at threshold (100) without confirmation: does NOT persist, returns needsConfirmation', async () => {
      const transactions = { create: jest.fn() };
      const boxes = {
        findAll: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Comida', active: true }]),
        withBalances: jest.fn().mockResolvedValue([]),
      };
      const audits = makeAudits();
      const svc = makeService({ boxes, transactions, audits });
      const ctx = makeCtx({ locale: 'es', i18n: makeI18n() });

      const result = (await svc.registerTransaction(ctx, {
        type: TransactionType.EXPENSE,
        boxName: 'Comida',
        amount: 100,
        userConfirmed: false,
      })) as Record<string, unknown>;

      expect(result.needsConfirmation).toBe(true);
      expect(transactions.create).not.toHaveBeenCalled();
      expect(audits.save).toHaveBeenCalledTimes(1);
    });

    it('expense at threshold (100) with userConfirmed=true: persists', async () => {
      const tx = {
        id: 'tx-2',
        type: 'expense',
        amount: 100,
        boxId: 'b1',
        date: '2026-06-01',
        note: null,
        status: 'confirmed',
        source: 'pwa',
        split: null,
        voice: false,
        currency: 'PEN',
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      const boxes = {
        findAll: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Comida', active: true }]),
        withBalances: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Comida', allocated: 500 }]),
      };
      const transactions = { create: jest.fn().mockResolvedValue(tx) };
      const audits = makeAudits();
      const svc = makeService({ boxes, transactions, audits });
      const ctx = makeCtx({ i18n: makeI18n() });

      const result = (await svc.registerTransaction(ctx, {
        type: TransactionType.EXPENSE,
        boxName: 'Comida',
        amount: 100,
        userConfirmed: true,
      })) as Record<string, unknown>;

      expect(result.needsConfirmation).toBeUndefined();
      expect(transactions.create).toHaveBeenCalledTimes(1);
    });

    it('income at high amount (500): persists without confirmation guard', async () => {
      const tx = {
        id: 'tx-3',
        type: 'income',
        amount: 500,
        boxId: null,
        date: '2026-06-01',
        note: null,
        status: 'confirmed',
        source: 'pwa',
        split: null,
        voice: false,
        currency: 'PEN',
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      const transactions = { create: jest.fn().mockResolvedValue(tx) };
      const boxes = {
        findAll: jest.fn().mockResolvedValue([]),
        withBalances: jest.fn().mockResolvedValue([]),
      };
      const audits = makeAudits();
      const svc = makeService({ boxes, transactions, audits });
      const ctx = makeCtx({ i18n: makeI18n() });

      const result = (await svc.registerTransaction(ctx, {
        type: TransactionType.INCOME,
        amount: 500,
        userConfirmed: false,
      })) as Record<string, unknown>;

      expect(result.needsConfirmation).toBeUndefined();
      expect(transactions.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── Audit writes ────────────────────────────────────────────────────────
  describe('audit behavior', () => {
    it('writes audit on successful getBoxBalances call', async () => {
      const audits = makeAudits();
      const boxes = { withBalances: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Comida' }]) };
      const svc = makeService({ boxes, audits });
      const ctx = makeCtx({ i18n: makeI18n() });

      await svc.getBoxBalances(ctx);

      expect(audits.create).toHaveBeenCalledTimes(1);
      expect(audits.save).toHaveBeenCalledTimes(1);
    });

    it('writes audit on tool failure (with i18n)', async () => {
      const audits = makeAudits();
      const boxes = {
        withBalances: jest
          .fn()
          .mockRejectedValue(
            new AppException('transaction.box_inactive', HttpStatus.BAD_REQUEST, 'inactive'),
          ),
      };
      const i18n = makeI18n();
      const svc = makeService({ boxes, audits });
      const ctx = makeCtx({ i18n });

      const result = (await svc.getBoxBalances(ctx)) as Record<string, unknown>;

      expect(result.error).toBeDefined();
      expect(audits.save).toHaveBeenCalledTimes(1);
    });
  });

  // ── i18n error translation ───────────────────────────────────────────────
  describe('i18n error handling', () => {
    it('with i18n: returns localized { error } on AppException', async () => {
      const audits = makeAudits();
      const i18n = makeI18n();
      const boxes = {
        withBalances: jest
          .fn()
          .mockRejectedValue(
            new AppException('transaction.box_inactive', HttpStatus.BAD_REQUEST, 'inactive'),
          ),
      };
      const svc = makeService({ boxes, audits });
      const ctx = makeCtx({ locale: 'es', i18n });

      const result = (await svc.getBoxBalances(ctx)) as Record<string, unknown>;

      expect(result.error).toBe('La caja está inactiva');
    });

    it('without i18n: re-throws the error (legacy behavior)', async () => {
      const audits = makeAudits();
      const boxes = {
        withBalances: jest
          .fn()
          .mockRejectedValue(
            new AppException('transaction.box_inactive', HttpStatus.BAD_REQUEST, 'inactive'),
          ),
      };
      const svc = makeService({ boxes, audits });
      const ctx = makeCtx({ i18n: undefined });

      await expect(svc.getBoxBalances(ctx)).rejects.toBeInstanceOf(AppException);
    });

    it('does NOT leak the raw message of a non-AppException error to the caller', async () => {
      const audits = makeAudits();
      const i18n = {
        t: jest.fn().mockReturnValue('Ocurrió un error inesperado'),
      };
      const boxes = {
        withBalances: jest.fn().mockRejectedValue(new Error('sensitive db detail')),
      };
      const svc = makeService({ boxes, audits });
      const ctx = makeCtx({ locale: 'es', i18n });

      const result = (await svc.getBoxBalances(ctx)) as Record<string, unknown>;

      expect(result.error).toBe('Ocurrió un error inesperado');
      expect(String(result.error)).not.toContain('sensitive db detail');
      expect(i18n.t).toHaveBeenCalledWith('es', 'errors:common.unexpected', undefined);
      // The real error is logged server-side, never returned to the caller.
      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });

  // ── getBoxBalances happy path ────────────────────────────────────────────
  describe('getBoxBalances', () => {
    it('returns box balances from boxes.withBalances', async () => {
      const balances = [{ id: 'b1', name: 'Comida', balance: 100 }];
      const boxes = { withBalances: jest.fn().mockResolvedValue(balances) };
      const audits = makeAudits();
      const svc = makeService({ boxes, audits });
      const ctx = makeCtx({ i18n: makeI18n() });

      const result = await svc.getBoxBalances(ctx);

      expect(result).toEqual(balances);
      expect(boxes.withBalances).toHaveBeenCalledWith('user-1');
    });
  });

  // ── queryTransactions ───────────────────────────────────────────────────
  describe('queryTransactions', () => {
    it('returns error with availableBoxes and hint when box not found', async () => {
      const boxes = {
        findAll: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Comida', active: true }]),
        withBalances: jest.fn().mockResolvedValue([]),
      };
      const transactions = { list: jest.fn().mockResolvedValue([]) };
      const audits = makeAudits();
      const svc = makeService({ boxes, transactions, audits });
      const ctx = makeCtx({ locale: 'es', i18n: makeI18n() });

      const result = (await svc.queryTransactions(ctx, {
        groupBy: 'none',
        orderBy: 'date',
        limit: 10,
        boxNames: ['NonExistent'],
      })) as Record<string, unknown>;

      expect(result.error).toBeDefined();
      expect(result.availableBoxes).toBeDefined();
      expect(result.hint).toBeDefined();
    });

    it('returns grouped aggregation shape when groupBy=box', async () => {
      const boxes = {
        findAll: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Comida', active: true }]),
        withBalances: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Comida', allocated: 200 }]),
      };
      // Return a raw transaction-like object that toTransactionDto can handle.
      // toTransactionDto expects an entity with .amount as a string (from TypeORM numeric column).
      const rawTx = {
        id: 't1',
        type: 'expense',
        amount: '50',
        boxId: 'b1',
        date: '2026-06-01',
        note: null,
        status: 'confirmed',
        source: 'pwa',
        split: null,
        voice: false,
        currency: 'PEN',
        occurredAt: new Date(),
        createdAt: new Date(),
      };
      const transactions = {
        list: jest.fn().mockResolvedValue([rawTx]),
      };
      const audits = makeAudits();
      const svc = makeService({ boxes, transactions, audits });
      const ctx = makeCtx({ i18n: makeI18n() });

      const result = (await svc.queryTransactions(ctx, {
        groupBy: 'box',
        orderBy: 'date',
        limit: 10,
      })) as Record<string, unknown>;

      expect(result.groups).toBeDefined();
      expect(Array.isArray(result.groups)).toBe(true);
      const groups = result.groups as Array<Record<string, unknown>>;
      expect(groups[0]).toHaveProperty('group');
      expect(groups[0]).toHaveProperty('total');
      expect(groups[0]).toHaveProperty('count');
      expect(groups[0]).toHaveProperty('avg');
    });
  });
});
