import { z } from 'zod';
import { apiClient } from '../mayordomo-api-client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP tool: registerTransaction
 * Records a new financial transaction.
 *
 * Backend route: POST /api/agent-tools/register-transaction
 * Input schema mirrors @app/contracts registerTransactionSchema.
 * Re-declared locally with zod v4 (SDK 1.29+ supports both zod v3 and v4).
 *
 * IMPORTANT — needsConfirmation:
 *   Expenses >= 100 (the confirmation threshold) return { needsConfirmation: true }
 *   from the backend. The MCP server MUST relay this to the Foundry agent and
 *   MUST NOT auto-retry with userConfirmed: true. The agent itself must ask the
 *   user for explicit confirmation and re-invoke the tool with userConfirmed: true.
 */

// Input shape — ZodRawShapeCompat (raw object, NOT z.object).
// userId is intentionally absent — never accepted from the caller.
export const registerTransactionInputShape = {
  type: z
    .enum(['income', 'expense'])
    .describe('Transaction type: income (money in) or expense (money out of a box).'),
  boxName: z
    .string()
    .optional()
    .describe('Target box name for the transaction. Required for expenses.'),
  amount: z.number().positive().describe('Amount in the account currency. Must be greater than 0.'),
  note: z.string().max(300).optional().describe('Optional note or description (max 300 chars).'),
  userConfirmed: z
    .boolean()
    .optional()
    .describe(
      'Set to true only after the user explicitly confirms a high-amount expense. ' +
        'Do NOT set automatically — wait for needsConfirmation in the response first.',
    ),
};

export const registerTransactionTool = {
  name: 'registerTransaction',
  description:
    'Records a transaction: expense charged to a box, or income distributed by allocation %. ' +
    'High-amount expenses (>= 100) require explicit user confirmation — ' +
    'when the server returns needsConfirmation: true, ask the user to confirm before re-invoking ' +
    'with userConfirmed: true. Do NOT auto-confirm.',
  inputShape: registerTransactionInputShape,
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    // Forward args as-is — the backend's ZodValidationPipe validates them.
    // CRITICAL: never retry automatically on needsConfirmation.
    const out = await apiClient.registerTransaction(args);
    return {
      content: [{ type: 'text', text: JSON.stringify(out) }],
    };
  },
} as const;
