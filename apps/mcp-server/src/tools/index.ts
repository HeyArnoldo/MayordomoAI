/**
 * MCP Tool Registry
 *
 * Exports the array of tool definitions used in src/index.ts to register
 * tools on the McpServer instance.
 *
 * ─── How to add a 4th (or Nth) tool ───────────────────────────────────────
 *
 * 1. Create  `apps/mcp-server/src/tools/your-tool.ts`
 *    Export `{ name, description, inputShape, handler }` following the same
 *    pattern as the files in this directory.
 *    - `name`        → unique string identifier (camelCase, matches backend route)
 *    - `description` → human-readable string for the AI agent
 *    - `inputShape`  → ZodRawShapeCompat (raw object of zod schemas, NOT z.object())
 *    - `handler`     → async (args) => { content: [{ type: 'text', text: '...' }] }
 *
 * 2. Import and add it to the `tools` array below.
 *    No changes needed to src/index.ts or the transport layer.
 *
 * 3. Add the matching route on the API side:
 *    - `apps/api/src/agent-tools-api/agent-tools.controller.ts`
 *      → add a new @Post('your-tool') method that calls the executor
 *    - `apps/api/src/agent/agent-tool-executor.service.ts`
 *      → implement the business logic (with audited() + i18n)
 *    - `packages/contracts/src/agent-tools.ts`
 *      → add the Zod request/response schema for the new endpoint
 *
 * The remaining 9 tools from the in-app Vercel AI agent can be added this way:
 * getExchangeRate, listRecurringExpenses, addRecurringExpense,
 * removeRecurringExpense, updateAllocation, createBox, updateBox,
 * voidTransaction, update_preferences
 * ──────────────────────────────────────────────────────────────────────────
 */

import { getBoxBalancesTool } from './get-box-balances.js';
import { queryTransactionsTool } from './query-transactions.js';
import { registerTransactionTool } from './register-transaction.js';

export const tools = [getBoxBalancesTool, queryTransactionsTool, registerTransactionTool] as const;
