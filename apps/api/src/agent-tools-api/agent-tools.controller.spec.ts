import {
  getBoxBalancesSchema,
  queryTransactionsSchema,
  registerTransactionSchema,
  toResponse,
} from '@app/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AgentToolsController } from './agent-tools.controller';
import type { ToolExecCtx } from '../agent/agent-tool-executor.service';
import { TransactionType } from '@app/contracts';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

const makeCtx = (): ToolExecCtx => ({
  userId: 'demo-user-id',
  conversationId: null,
  locale: 'es',
  currency: 'PEN',
});

const makeCtxService = (ctx?: Partial<ToolExecCtx>) => ({
  build: jest.fn().mockResolvedValue({ ...makeCtx(), ...ctx }),
});

const makeExecutor = (overrides?: {
  getBoxBalances?: jest.Mock;
  queryTransactions?: jest.Mock;
  registerTransaction?: jest.Mock;
}) => ({
  getBoxBalances: overrides?.getBoxBalances ?? jest.fn().mockResolvedValue([{ id: 'b1' }]),
  queryTransactions:
    overrides?.queryTransactions ??
    jest.fn().mockResolvedValue({ matches: [], count: 0, total: 0 }),
  registerTransaction:
    overrides?.registerTransaction ??
    jest.fn().mockResolvedValue({ registered: {}, boxBalance: null }),
});

function makeController(
  executor?: ReturnType<typeof makeExecutor>,
  ctxService?: ReturnType<typeof makeCtxService>,
) {
  return new AgentToolsController(
    (executor ?? makeExecutor()) as never,
    (ctxService ?? makeCtxService()) as never,
  );
}

const fakeReq = {} as never;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentToolsController', () => {
  // ── getBoxBalances ───────────────────────────────────────────────────────
  describe('POST get-box-balances', () => {
    it('delegates to executor.getBoxBalances and maps to CommonToolResponse', async () => {
      const balances = [{ id: 'b1', name: 'Comida', balance: 100 }];
      const executor = makeExecutor({ getBoxBalances: jest.fn().mockResolvedValue(balances) });
      const controller = makeController(executor);

      const result = await controller.getBoxBalances(fakeReq, {});

      expect(executor.getBoxBalances).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ ok: true, data: balances });
    });
  });

  // ── queryTransactions ────────────────────────────────────────────────────
  describe('POST query-transactions', () => {
    it('delegates to executor.queryTransactions with validated body', async () => {
      const mockResult = { matches: [], count: 0, total: 0 };
      const executor = makeExecutor({ queryTransactions: jest.fn().mockResolvedValue(mockResult) });
      const controller = makeController(executor);
      const body = queryTransactionsSchema.parse({
        groupBy: 'none',
        orderBy: 'date',
        limit: 20,
      });

      const result = await controller.queryTransactions(fakeReq, body);

      expect(executor.queryTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'demo-user-id' }),
        body,
      );
      expect(result).toMatchObject({ ok: true, data: mockResult });
    });
  });

  // ── registerTransaction ──────────────────────────────────────────────────
  describe('POST register-transaction', () => {
    it('delegates to executor.registerTransaction with validated body', async () => {
      const mockResult = { registered: { id: 'tx-1' }, boxBalance: null };
      const executor = makeExecutor({
        registerTransaction: jest.fn().mockResolvedValue(mockResult),
      });
      const controller = makeController(executor);
      const body = registerTransactionSchema.parse({
        type: 'income',
        amount: 100,
      });

      const result = await controller.registerTransaction(fakeReq, body);

      expect(executor.registerTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'demo-user-id' }),
        body,
      );
      expect(result).toMatchObject({ ok: true });
    });

    it('passes needsConfirmation through to CommonToolResponse', async () => {
      const mockResult = { needsConfirmation: true, message: 'Confirm?' };
      const executor = makeExecutor({
        registerTransaction: jest.fn().mockResolvedValue(mockResult),
      });
      const controller = makeController(executor);
      const body = registerTransactionSchema.parse({
        type: TransactionType.EXPENSE,
        amount: 100,
      });

      const result = await controller.registerTransaction(fakeReq, body);

      expect(result.needsConfirmation).toBe(true);
      expect(result.ok).toBe(true);
      expect(result.message).toBe('Confirm?');
    });
  });

  // ── Zod schema validation (unit-test schemas directly) ──────────────────
  describe('Schema validation via ZodValidationPipe', () => {
    it('getBoxBalancesSchema rejects non-empty body (strict)', () => {
      const pipe = new ZodValidationPipe(getBoxBalancesSchema);
      expect(() => pipe.transform({ unexpected: 'field' })).toThrow();
    });

    it('queryTransactionsSchema rejects limit=0', () => {
      const pipe = new ZodValidationPipe(queryTransactionsSchema);
      expect(() => pipe.transform({ groupBy: 'none', orderBy: 'date', limit: 0 })).toThrow();
    });

    it('queryTransactionsSchema rejects limit=101', () => {
      const pipe = new ZodValidationPipe(queryTransactionsSchema);
      expect(() => pipe.transform({ groupBy: 'none', orderBy: 'date', limit: 101 })).toThrow();
    });

    it('queryTransactionsSchema rejects textQuery over 120 chars', () => {
      const pipe = new ZodValidationPipe(queryTransactionsSchema);
      expect(() =>
        pipe.transform({
          groupBy: 'none',
          orderBy: 'date',
          limit: 10,
          textQuery: 'a'.repeat(121),
        }),
      ).toThrow();
    });

    it('registerTransactionSchema rejects missing type', () => {
      const pipe = new ZodValidationPipe(registerTransactionSchema);
      expect(() => pipe.transform({ amount: 50 })).toThrow();
    });

    it('registerTransactionSchema rejects amount=0', () => {
      const pipe = new ZodValidationPipe(registerTransactionSchema);
      expect(() => pipe.transform({ type: 'expense', amount: 0 })).toThrow();
    });

    it('registerTransactionSchema rejects note over 300 chars', () => {
      const pipe = new ZodValidationPipe(registerTransactionSchema);
      expect(() => pipe.transform({ type: 'income', amount: 50, note: 'a'.repeat(301) })).toThrow();
    });
  });

  // ── toResponse mapping ───────────────────────────────────────────────────
  describe('toResponse helper', () => {
    it('wraps success data in { ok: true, data }', () => {
      expect(toResponse([{ id: 'b1' }])).toEqual({ ok: true, data: [{ id: 'b1' }] });
    });

    it('maps error result to { ok: false, error }', () => {
      expect(toResponse({ error: 'Box not found' })).toMatchObject({
        ok: false,
        error: 'Box not found',
      });
    });

    it('maps needsConfirmation result to { ok: true, needsConfirmation: true, message }', () => {
      const result = toResponse({ needsConfirmation: true, message: 'Confirm?' });
      expect(result).toMatchObject({ ok: true, needsConfirmation: true, message: 'Confirm?' });
    });
  });
});
