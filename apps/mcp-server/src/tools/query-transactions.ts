import { z } from 'zod';
import { apiClient } from '../mayordomo-api-client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP tool: queryTransactions
 * Filters and aggregates transaction history.
 *
 * Backend route: POST /api/agent-tools/query-transactions
 * Input schema mirrors the REST body contract (see @app/contracts queryTransactionsSchema).
 * Re-declared locally with zod v4 (SDK 1.29+ supports both zod v3 and v4).
 */

// Input shape — ZodRawShapeCompat: keys mapped to zod schemas, NOT wrapped in z.object().
// userId is intentionally absent — the server resolves identity from env, never from input.
export const queryTransactionsInputShape = {
  type: z.enum(['income', 'expense']).optional().describe('Filter by transaction type.'),
  boxNames: z.array(z.string()).optional().describe('Filter to specific box names.'),
  textQuery: z
    .string()
    .max(120)
    .optional()
    .describe('Full-text search in transaction notes (max 120 chars).'),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Start date filter in YYYY-MM-DD format.'),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('End date filter in YYYY-MM-DD format.'),
  groupBy: z
    .enum(['none', 'box', 'day', 'week', 'month'])
    .optional()
    .describe('Aggregation dimension. Defaults to none (raw list).'),
  orderBy: z
    .enum(['date', 'amount'])
    .optional()
    .describe('Sort order for results. Defaults to date.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of rows to return (1–100). Defaults to 30.'),
};

export const queryTransactionsTool = {
  name: 'queryTransactions',
  description:
    'Searches and aggregates transaction history. Supports filtering by type, box, ' +
    'date range, and free-text search. Can group results by box, day, week, or month ' +
    'for summaries. Use this to answer questions about past spending or income patterns.',
  inputShape: queryTransactionsInputShape,
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const out = await apiClient.queryTransactions(args);
    return {
      content: [{ type: 'text', text: JSON.stringify(out) }],
    };
  },
} as const;
