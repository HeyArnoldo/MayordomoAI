import { z } from 'zod';
import { TransactionType } from './transactions';

// ---------------------------------------------------------------------------
// Request schemas for the internal /api/agent-tools/* REST layer.
// Mirrors the agent tool inputSchemas minus userId (never accepted from callers).
// ---------------------------------------------------------------------------

/** POST /api/agent-tools/get-box-balances — empty body */
export const getBoxBalancesSchema = z.object({}).strict();
export type GetBoxBalancesInput = z.infer<typeof getBoxBalancesSchema>;

/** POST /api/agent-tools/query-transactions */
export const queryTransactionsSchema = z.object({
  type: z.enum(TransactionType).optional(),
  boxNames: z.array(z.string()).optional(),
  textQuery: z.string().max(120).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  groupBy: z.enum(['none', 'box', 'day', 'week', 'month']).default('none'),
  orderBy: z.enum(['date', 'amount']).default('date'),
  limit: z.number().int().min(1).max(100).default(30),
});
export type QueryTransactionsInput = z.infer<typeof queryTransactionsSchema>;

/** POST /api/agent-tools/register-transaction — no userId */
export const registerTransactionSchema = z.object({
  type: z.enum(TransactionType),
  boxName: z.string().optional(),
  amount: z.number().positive(),
  note: z.string().max(300).optional(),
  userConfirmed: z.boolean().default(false),
});
export type RegisterTransactionInput = z.infer<typeof registerTransactionSchema>;

// ---------------------------------------------------------------------------
// Shared response wrapper
// ---------------------------------------------------------------------------

export interface CommonToolResponse<T = unknown> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
  needsConfirmation?: boolean;
}

/**
 * Maps executor output into a CommonToolResponse.
 * - needsConfirmation results → ok: true (valid business outcome)
 * - error results → ok: false (already i18n-localized by the executor)
 * - success results → ok: true, data
 */
export function toResponse(out: unknown): CommonToolResponse<unknown> {
  if (out !== null && out !== undefined && typeof out === 'object') {
    const o = out as Record<string, unknown>;
    if ('needsConfirmation' in o) {
      return {
        ok: true,
        needsConfirmation: true,
        message: o.message as string | undefined,
        data: o,
      };
    }
    if ('error' in o) {
      // Strip the 'error' key from data to avoid duplication, but keep extras like availableBoxes.
      const { error, ...rest } = o;
      return {
        ok: false,
        error: error as string,
        ...(Object.keys(rest).length > 0 ? { data: rest } : {}),
      };
    }
  }
  return { ok: true, data: out };
}
