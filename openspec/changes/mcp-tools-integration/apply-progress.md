# Apply Progress: mcp-tools-integration (PR 1 + PR 2)

**Change**: mcp-tools-integration
**PRs**: PR 1 (WU-A + WU-B) + PR 2 (WU-C + WU-D)
**Branches**: `feat/mcp-tools-backend` (PR 1) → `feat/mcp-tools-server` (PR 2, stacked)
**Mode**: PR 1 Strict TDD (RED → GREEN); PR 2 Standard (build + typecheck + node:test)
**Delivery**: Chained PR slice — stacked-to-main

---

## Completed Tasks

### WU-A — Backend Executor

- [x] A-1.1 Added `AGENT_TOOL_INTERNAL_KEY` and `FOUNDRY_DEMO_USER_ID` as OPTIONAL vars to `env.validation.ts`; updated `.env.example`.
- [x] A-1.2 Created `packages/contracts/src/agent-tools.ts` with all 3 request schemas, `CommonToolResponse<T>`, and `toResponse()`; re-exported from `index.ts`; packages build clean.
- [x] A-1.3 Wrote RED executor tests (11 tests) then implemented `AgentToolExecutorService` — all GREEN.
- [x] A-2.1 Created `apps/api/src/agent/agent-tool-executor.service.ts` with DI-injected services, `audited()`, threshold guard, i18n error translation, and all 3 tool methods.
- [x] A-2.2 Refactored `agent-tools.ts`: `buildAgentTools(ctx, executor?)` with ctx-based fallback; 3 MVP tools delegate to executor; 9 remaining tools unchanged; `agent-tools.spec.ts` stays GREEN (3/3 tests).
- [x] A-2.3 Registered `AgentToolExecutorService` in `AgentModule` (providers + exports).

### WU-B — Internal REST Layer

- [x] B-3.1 Wrote RED guard tests (5 tests).
- [x] B-3.2 Created `agent-tools-auth.guard.ts` — fail-closed, never logs key. GREEN.
- [x] B-3.3 Wrote RED context service tests (10 tests).
- [x] B-3.4 Created `agent-tools-context.service.ts` — userId from env only, uuid-validated conversationId, 503 on missing config. GREEN.
- [x] B-3.5 Wrote RED controller tests (14 tests).
- [x] B-3.6 Created `agent-tools.controller.ts` — 3 POST endpoints with ZodValidationPipe + toResponse mapping. GREEN.
- [x] B-3.7 Created `agent-tools-api.module.ts`; wired into `AppModule`. Full API tests GREEN.

### WU-C — MCP Server App

- [x] C-4.1 Verified `@modelcontextprotocol/sdk` by inspecting installed package. **Resolved version: 1.29.0 with zod v4 variant** (SDK natively supports both zod v3 and v4 via `ZodRawShapeCompat` compatibility layer in `dist/esm/server/zod-compat.js`). No zod-v3 pin needed. Import paths confirmed:
  - `McpServer` → `@modelcontextprotocol/sdk/server/mcp.js`
  - `StreamableHTTPServerTransport` → `@modelcontextprotocol/sdk/server/streamableHttp.js`
  - `registerTool` signature: `(name, { title?, description?, inputSchema? }, cb)` where `inputSchema` is `ZodRawShapeCompat` (raw shape, NOT `z.object()`).
  - Stateless transport: `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` per request.
  - Body must be pre-parsed and passed as 3rd arg: `transport.handleRequest(req, res, parsedBody)`.
  - `handleRequest` is `async (req: IncomingMessage, res: ServerResponse, parsedBody?: unknown) => void`.
  - No `allowBuilds` needed — SDK has no `postinstall` script.
- [x] C-4.2 Created `apps/mcp-server/package.json` — `@app/mcp-server`, `"type":"module"`, `@modelcontextprotocol/sdk@^1.29.0`, `zod@^4.3.6` (SDK v4 variant), `dotenv@^17`. `pnpm install --frozen-lockfile` passes. No `allowBuilds` entry needed.
- [x] C-4.3 Created `apps/mcp-server/tsconfig.json` — extends `@app/tsconfig`, `module: NodeNext`, `moduleResolution: NodeNext`. `pnpm --filter @app/mcp-server run typecheck` passes.
- [x] C-5.1 Created `apps/mcp-server/src/config.ts` — zod Env schema, `safeParse` with field-name-only error output (no secret values). Created `.env.example`. `PORT` defaults to 3001.
- [x] C-5.2 Created `apps/mcp-server/src/auth.ts` — `checkBearer(req)` comparing Authorization header to `Bearer ${config.MCP_AUTH_TOKEN}`. Never logs. Created `auth.test.ts` (5 node:test cases) — all pass.
- [x] C-5.3 Created `apps/mcp-server/src/mayordomo-api-client.ts` — `call(tool, body)` with sanitized error forwarding (generic message on non-2xx without safe error, network error catch). Never logs `x-agent-tool-key`. Created `mayordomo-api-client.test.ts` (6 node:test cases) — all pass.
- [x] C-5.4 Created `src/tools/get-box-balances.ts`, `query-transactions.ts`, `register-transaction.ts` — each exports `{ name, description, inputShape, handler }`. `inputShape` is ZodRawShapeCompat using zod v4. `registerTransaction` does NOT auto-retry on `needsConfirmation`. Created `src/types.ts` for `CommonToolResponse` (local copy, avoids importing `@app/contracts` which uses zod v4 — actually both use v4, but local avoids workspace dep).
- [x] C-5.5 Created `src/tools/index.ts` with "how to add a tool" doc block. Created `src/index.ts`: `McpServer` + tools registered; pure Node.js HTTP server; POST /mcp → bearer check → body parse → stateless transport per request → `server.connect` + `transport.handleRequest`; unknown routes → 404; listens on `config.PORT`.
- [x] C-5.6 `pnpm --filter @app/mcp-server run build` — PASS (clean tsc). `pnpm --filter @app/mcp-server run typecheck` — PASS. Root `pnpm typecheck` — PASS (6 packages).

### WU-D — Docs

- [x] D-6.1 `.env.example` has inline comments for all 4 vars. `package.json` has clear script names with descriptions. Created `apps/mcp-server/README.md` (repo has no README pattern for apps, so one was added per spec guidance).
- [x] D-6.2 Curl smoke tests documented in `src/index.ts` top-of-file JSDoc block covering: 401 (missing auth), 401 (wrong auth), 404 (unknown route), MCP initialize, tool call getBoxBalances, direct backend call. All use `/api/agent-tools/` prefix. Also documented in `README.md` curl section.
- [x] D-6.3 "How to add a 4th tool" comment block in `src/tools/index.ts` — covers create tool file → export shape → add to array → add apiClient method → add API route → add executor method → add contracts schema.

---

## TDD Cycle Evidence

### PR 1 (Strict TDD)

| Task                  | RED                       | GREEN                                | REFACTOR                               |
| --------------------- | ------------------------- | ------------------------------------ | -------------------------------------- |
| A-1.3 executor spec   | Cannot find module → FAIL | AgentToolExecutorService implemented | Removed unused imports                 |
| B-3.1 guard spec      | Cannot find module → FAIL | AgentToolsAuthGuard implemented      | —                                      |
| B-3.3 context spec    | Cannot find module → FAIL | AgentToolsContextService implemented | Fixed null vs undefined in test helper |
| B-3.5 controller spec | Cannot find module → FAIL | AgentToolsController implemented     | —                                      |

### PR 2 (Standard mode — build + typecheck + node:test)

| Task                  | Verification                                             | Result |
| --------------------- | -------------------------------------------------------- | ------ |
| C-5.2 auth.ts         | `node --test dist/auth.test.js` (5 tests)                | PASS   |
| C-5.3 api-client      | `node --test dist/mayordomo-api-client.test.js` (6)      | PASS   |
| C-5.6 build/typecheck | `pnpm --filter @app/mcp-server run build && typecheck`   | PASS   |
| All (root gates)      | `pnpm typecheck && pnpm build && pnpm lint && pnpm test` | PASS   |

---

## Commits

| Hash    | Subject                                                                        |
| ------- | ------------------------------------------------------------------------------ |
| 6e43d05 | refactor(agent): extract AgentToolExecutorService (behavior-preserving)        |
| 967936e | feat(agent-tools-api): internal REST layer with x-agent-tool-key guard         |
| ef74a74 | fix(agent-tools-api): inject concrete I18nService to fix DI boot crash         |
| 3b27bea | fix(agent): sanitize non-AppException errors on the tool boundary              |
| ecc239f | feat(mcp-server): add @app/mcp-server with stateless Streamable HTTP transport |

---

## Files Changed (PR 2 — WU-C + WU-D)

| File                                                | Action   | Notes                                                                 |
| --------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| `apps/mcp-server/package.json`                      | Created  | @app/mcp-server, type:module, SDK ^1.29.0 + zod ^4.3.6                |
| `apps/mcp-server/tsconfig.json`                     | Created  | NodeNext module, extends @app/tsconfig                                |
| `apps/mcp-server/.env.example`                      | Created  | PORT, MAYORDOMO_API_BASE_URL, AGENT_TOOL_INTERNAL_KEY, MCP_AUTH_TOKEN |
| `apps/mcp-server/README.md`                         | Created  | Install, curl tests, ngrok/Foundry guide, add-a-tool howto            |
| `apps/mcp-server/src/types.ts`                      | Created  | Local CommonToolResponse interface                                    |
| `apps/mcp-server/src/config.ts`                     | Created  | Env validation, fail-fast, no secret values in error                  |
| `apps/mcp-server/src/auth.ts`                       | Created  | checkBearer, never logs token                                         |
| `apps/mcp-server/src/auth.test.ts`                  | Created  | 5 node:test cases for bearer validation                               |
| `apps/mcp-server/src/mayordomo-api-client.ts`       | Created  | fetch wrapper, sanitized errors, never logs key                       |
| `apps/mcp-server/src/mayordomo-api-client.test.ts`  | Created  | 6 node:test cases for error sanitization                              |
| `apps/mcp-server/src/tools/get-box-balances.ts`     | Created  | MCP tool definition for getBoxBalances                                |
| `apps/mcp-server/src/tools/query-transactions.ts`   | Created  | MCP tool definition for queryTransactions                             |
| `apps/mcp-server/src/tools/register-transaction.ts` | Created  | MCP tool definition for registerTransaction (no auto-retry)           |
| `apps/mcp-server/src/tools/index.ts`                | Created  | Tool registry + "how to add a tool" doc                               |
| `apps/mcp-server/src/index.ts`                      | Created  | McpServer + transport + HTTP server + curl docs in header             |
| `pnpm-lock.yaml`                                    | Modified | SDK 1.29.0 + zod v4 variant added                                     |

---

## CI Gate Results (PR 2 — all pass)

| Gate                                      | Result                                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`          | PASS                                                         |
| `pnpm --filter "./packages/**" run build` | PASS                                                         |
| `pnpm lint`                               | PASS (0 errors, pre-existing warnings only)                  |
| `pnpm typecheck` (ROOT)                   | PASS (6 packages)                                            |
| `pnpm build` (ROOT)                       | PASS                                                         |
| `pnpm test` (ROOT)                        | PASS — 320 API tests (26 suites) + 11 node:test (mcp-server) |

---

## MCP SDK Verification Results (C-4.1)

- **Installed version**: `@modelcontextprotocol/sdk@1.29.0`
- **Zod support**: Both v3 AND v4 via `ZodRawShapeCompat` in `dist/esm/server/zod-compat.js`. Used zod v4 (matching workspace).
- **Exact import paths**:
  - `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'`
  - `import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'`
- **registerTool API**: `server.registerTool(name, { description, inputSchema: ZodRawShapeCompat }, handler)`
  - `inputSchema` is a raw shape object (record of zod schemas), NOT `z.object(...)`.
  - Handler receives typed args inferred from the shape.
- **Stateless mode**: `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` per request.
- **Body parsing**: must pre-parse JSON body and pass as 3rd arg to `transport.handleRequest(req, res, parsedBody)`.
- **No postinstall** — no `allowBuilds` entry needed for SDK.

---

## Env Vars (both apps)

| App               | Var                       | Required | Notes                                                    |
| ----------------- | ------------------------- | -------- | -------------------------------------------------------- |
| `apps/api`        | `AGENT_TOOL_INTERNAL_KEY` | Optional | Guard fails-closed (401) if unset. Already in PR1.       |
| `apps/api`        | `FOUNDRY_DEMO_USER_ID`    | Optional | Context service throws 503 if unset. Already in PR1.     |
| `apps/mcp-server` | `PORT`                    | Optional | Defaults to 3001.                                        |
| `apps/mcp-server` | `MAYORDOMO_API_BASE_URL`  | Required | Base URL of NestJS API.                                  |
| `apps/mcp-server` | `AGENT_TOOL_INTERNAL_KEY` | Required | Must match apps/api value. Both must be the same secret. |
| `apps/mcp-server` | `MCP_AUTH_TOKEN`          | Required | Bearer token for Foundry → MCP auth.                     |

Root `.env.example` was already updated in PR1 (AGENT_TOOL_INTERNAL_KEY + FOUNDRY_DEMO_USER_ID). No changes needed for PR2 root env.

---

## What Remains (Future — outside PR 2 scope)

- [ ] The 9 remaining in-app tools (getExchangeRate, listRecurringExpenses, addRecurringExpense, removeRecurringExpense, updateAllocation, createBox, updateBox, voidTransaction, update_preferences) need to be:
  1. Moved to `AgentToolExecutorService` (same pattern as the 3 MVP tools)
  2. Exposed via `AgentToolsController` new POST endpoints
  3. Added as MCP tools in `apps/mcp-server/src/tools/`
  4. Follow the "how to add a tool" guide in `src/tools/index.ts` and README
- [ ] Thread → userId mapping (non-demo multi-user) — requires auth design for the MCP server

---

## Security Review Notes

- Bearer auth check runs BEFORE the transport receives the request — no MCP protocol bytes processed on 401.
- `AGENT_TOOL_INTERNAL_KEY` is never logged at any layer (config reads it; api-client header write; never console.log).
- `MCP_AUTH_TOKEN` is never logged (auth.ts comparison only; no logging of the header value).
- Error responses to Foundry: only `{ ok: false, error: "<i18n-safe-string>" }` — no stack traces, hostnames, or secrets.
- `userId` field is absent from all MCP tool input shapes — Foundry cannot supply it.
- `needsConfirmation` is relayed verbatim — the MCP server never auto-confirms.

---

## Post-PR2 Quality Fixes (commit 80aeed8 — branch feat/mcp-tools-server)

### Fix 1 — Tests now exercise real production modules

**Problem**: `auth.test.ts` and `mayordomo-api-client.test.ts` contained local reimplementations of the production logic because `config.ts` ran env validation at import time, blocking any test that imported those modules without real env vars.

**Solution**:

- `config.ts`: converted to a lazy memoized `getConfig()` function. Env validation runs only on first call (at server startup), not at import time. No behavioral change when booting the server.
- `auth.ts`: extracted `isValidBearer(authHeader, expectedToken)` as a pure exported function with no config dependency. `checkBearer(req)` calls `isValidBearer` + `getConfig()`.
- `mayordomo-api-client.ts`: exported `sanitizeApiError(json, resOk)` as a pure function. `call()` uses `getConfig()` lazily.
- `auth.test.ts`: imports and tests the real `isValidBearer` (6 tests).
- `mayordomo-api-client.test.ts`: imports and tests the real `sanitizeApiError` (6 tests).

### Fix 2 — Constant-time bearer comparison (mcp-server only)

**Problem**: `auth.ts` used `===` string equality for the bearer token comparison, which is vulnerable to timing attacks.

**Solution**: `isValidBearer` now uses `crypto.timingSafeEqual`. Length mismatch returns `false` immediately (before calling `timingSafeEqual`, which would throw on different-length buffers). Equal-length buffers are compared in constant time.

**Follow-up (future PR)**: The NestJS backend guard in `apps/api/src/agent/agent-tools-auth.guard.ts` uses a string equality check for `AGENT_TOOL_INTERNAL_KEY` and should also be migrated to `crypto.timingSafeEqual`. Not touched in this PR (different branch/PR scope).

### Gate Results

| Gate                                                              | Result                                      |
| ----------------------------------------------------------------- | ------------------------------------------- |
| `pnpm --filter @app/mcp-server run build`                         | PASS (tsc clean)                            |
| `node --test dist/auth.test.js dist/mayordomo-api-client.test.js` | PASS — 12/12                                |
| `pnpm typecheck` (ROOT)                                           | PASS (6 packages, 0 errors)                 |
| `pnpm lint` (ROOT)                                                | PASS (0 errors, pre-existing warnings only) |
