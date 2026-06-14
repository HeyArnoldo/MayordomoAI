import { z } from 'zod';
import { apiClient } from '../mayordomo-api-client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP tool: getBoxBalances
 * Retrieves current balances for all spending boxes (budget categories).
 * Input schema: empty (no parameters needed).
 *
 * Backend route: POST /api/agent-tools/get-box-balances
 */
export const getBoxBalancesTool = {
  name: 'getBoxBalances',
  description:
    'Returns the current balance of every spending box (budget category). ' +
    'Use this to understand how much money is allocated and available in each box ' +
    'before suggesting expenses or transfers.',
  // Raw shape (not z.object) — the MCP SDK accepts ZodRawShapeCompat.
  // Empty shape → no required inputs.
  inputShape: {} as Record<string, z.ZodTypeAny>,
  handler: async (_args: Record<string, never>): Promise<CallToolResult> => {
    const out = await apiClient.getBoxBalances();
    return {
      content: [{ type: 'text', text: JSON.stringify(out) }],
    };
  },
} as const;
