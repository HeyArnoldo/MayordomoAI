# Apply Progress: mcp-tools-integration (PR 1)

**Change**: mcp-tools-integration
**PR**: PR 1 (WU-A + WU-B)
**Branch**: feat/mcp-tools-backend
**Mode**: Strict TDD (RED → GREEN cycle for all tasks)
**Delivery**: Chained PR slice — PR 1 only (WU-A + WU-B); PR 2 (WU-C + WU-D) is a separate branch.

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

---

## TDD Cycle Evidence

| Task                  | RED                       | GREEN                                | REFACTOR                               |
| --------------------- | ------------------------- | ------------------------------------ | -------------------------------------- |
| A-1.3 executor spec   | Cannot find module → FAIL | AgentToolExecutorService implemented | Removed unused imports                 |
| B-3.1 guard spec      | Cannot find module → FAIL | AgentToolsAuthGuard implemented      | —                                      |
| B-3.3 context spec    | Cannot find module → FAIL | AgentToolsContextService implemented | Fixed null vs undefined in test helper |
| B-3.5 controller spec | Cannot find module → FAIL | AgentToolsController implemented     | —                                      |

---

## Commits

| Hash    | Subject                                                                 |
| ------- | ----------------------------------------------------------------------- |
| 6e43d05 | refactor(agent): extract AgentToolExecutorService (behavior-preserving) |
| 967936e | feat(agent-tools-api): internal REST layer with x-agent-tool-key guard  |

---

## Files Changed

| File                                                               | Action   | Notes                                                      |
| ------------------------------------------------------------------ | -------- | ---------------------------------------------------------- |
| `apps/api/src/config/env.validation.ts`                            | Modified | Added 2 optional env vars                                  |
| `apps/api/src/agent/agent-tool-executor.service.ts`                | Created  | New executor service                                       |
| `apps/api/src/agent/agent-tool-executor.service.spec.ts`           | Created  | 11 TDD tests                                               |
| `apps/api/src/agent/agent-tools.ts`                                | Modified | Delegates 3 MVP tools to executor; optional executor param |
| `apps/api/src/agent/agent.module.ts`                               | Modified | Registers + exports AgentToolExecutorService               |
| `apps/api/src/agent-tools-api/agent-tools-auth.guard.ts`           | Created  | x-agent-tool-key guard                                     |
| `apps/api/src/agent-tools-api/agent-tools-auth.guard.spec.ts`      | Created  | 5 TDD tests                                                |
| `apps/api/src/agent-tools-api/agent-tools-context.service.ts`      | Created  | Builds ToolExecCtx from env                                |
| `apps/api/src/agent-tools-api/agent-tools-context.service.spec.ts` | Created  | 10 TDD tests                                               |
| `apps/api/src/agent-tools-api/agent-tools.controller.ts`           | Created  | 3 POST endpoints                                           |
| `apps/api/src/agent-tools-api/agent-tools.controller.spec.ts`      | Created  | 14 TDD tests                                               |
| `apps/api/src/agent-tools-api/agent-tools-api.module.ts`           | Created  | Feature module                                             |
| `apps/api/src/app.module.ts`                                       | Modified | Wires AgentToolsApiModule                                  |
| `packages/contracts/src/agent-tools.ts`                            | Created  | 3 Zod schemas + CommonToolResponse + toResponse            |
| `packages/contracts/src/index.ts`                                  | Modified | Re-exports agent-tools                                     |
| `packages/contracts/src/error-codes.ts`                            | Modified | Added agent_tools.\* error codes                           |
| `packages/i18n/src/locales/es/errors.ts`                           | Modified | agent_tools translations (es)                              |
| `packages/i18n/src/locales/en/errors.ts`                           | Modified | agent_tools translations (en)                              |
| `.env.example`                                                     | Modified | Documents the 2 new optional env vars                      |

---

## CI Gate Results (all pass)

| Gate                                      | Result                                                |
| ----------------------------------------- | ----------------------------------------------------- |
| `pnpm install --frozen-lockfile`          | PASS                                                  |
| `pnpm --filter "./packages/**" run build` | PASS                                                  |
| `pnpm lint`                               | PASS (0 errors, warnings only from pre-existing code) |
| `pnpm typecheck` (ROOT)                   | PASS                                                  |
| `pnpm build`                              | PASS                                                  |
| `pnpm test` (ROOT)                        | PASS — 317 tests, 25 suites                           |

---

## Agent Parity (behavior-preserving)

- `agent-tools.spec.ts` stays GREEN (3 tests) — zero changes to assertions.
- `buildAgentTools(ctx)` without executor arg uses the ctx-based fallback constructor so `agent.service.ts` and tests are unchanged.
- `CONFIRMATION_THRESHOLD` export preserved; module-level `audited()` preserved for the other 9 tools.
- Pre-existing 288 tests were GREEN before WU-A; 317 total GREEN after WU-A + WU-B (29 new tests added).

---

## Env Vars Handling

- `AGENT_TOOL_INTERNAL_KEY`: OPTIONAL in `env.validation.ts`. Guard fails-closed (401) if unset/empty.
- `FOUNDRY_DEMO_USER_ID`: OPTIONAL in `env.validation.ts`. Context service throws 503 if unset or user not found.
- No existing production deployment breaks — both vars default to `undefined` which is valid per schema.

---

## Remaining (PR 2)

- [ ] C-4.1 Verify `@modelcontextprotocol/sdk` version + zod compatibility
- [ ] C-4.2 Create `apps/mcp-server/package.json`
- [ ] C-4.3 Create `apps/mcp-server/tsconfig.json`
- [ ] C-5.1 `config.ts` with env validation
- [ ] C-5.2 `auth.ts` + bearer check tests
- [ ] C-5.3 `mayordomo-api-client.ts` + sanitization tests
- [ ] C-5.4 Tool modules (get-box-balances, query-transactions, register-transaction)
- [ ] C-5.5 `index.ts` — MCP server + streamable HTTP transport
- [ ] C-5.6 Build + typecheck verification
- [ ] D-6.1-6.3 Docs

**PR 2 base**: `feat/mcp-tools-backend` (after PR 1 merges to main, PR 2 targets main).

---

## Security review follow-up (post-apply, on feat/mcp-tools-backend)

Two confirmed issues from a fresh security review were fixed:

- **BLOCKER — DI boot crash**: `AgentToolsContextService` declared `private readonly i18n: Pick<I18nService,'t'>`. With `emitDecoratorMetadata`, Nest resolved the runtime token as `Object` (not a provider), so resolving the service threw at bootstrap and crashed the ENTIRE API (AgentToolsApiModule is imported in AppModule). Fixed by injecting the concrete `I18nService` token (matching `boxes.service.ts` / `agent.service.ts`). `I18nModule` is `@Global()`, so no module import change was needed. Added a Nest DI regression test (`agent-tools-context.di.spec.ts`) that compiles a minimal `Test.createTestingModule` (not AppModule) and asserts the service resolves — it FAILS against the `Pick<>` version and PASSES after the fix.
- **SHOULD-FIX — raw error leak across the external REST trust boundary**: `toolErrorMessage` returned `err.message` for generic (non-AppException) errors, leaking TypeORM/SQL/table/column detail to the external caller (the global HttpExceptionFilter never runs because the executor swallows the throw). Fixed in `tool-error.helper.ts` to return the generic localized `errors:common.unexpected` (static fallback when i18n absent) for ANY non-AppException error. `AgentToolExecutorService.audited()` now logs the real error server-side (NestJS Logger) before returning the safe generic message. Also removed the legacy raw-`err.message` fallback in `agent-tools.ts` (in-app agent) so both paths are safe. AppException handling, the confirmation threshold, the guard, env handling, and userId resolution were left unchanged.

Specs updated for the sanitization: `tool-error.helper.spec.ts` (generic-Error now asserts the generic message + no leak), `agent-tool-executor.service.spec.ts` (new test: plain `Error('sensitive db detail')` → generic message, leak-free, logged server-side).

Gates (ROOT): packages build OK, `pnpm lint` 0 errors, `pnpm typecheck` OK, `pnpm test` 26 suites / 320 tests passing.
