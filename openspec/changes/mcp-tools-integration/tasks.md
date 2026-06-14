# Tasks: MCP Tools Integration

## Review Workload Forecast

| Field                   | Value                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Estimated changed lines | 900–1,200                                                                                    |
| 400-line budget risk    | High                                                                                         |
| Chained PRs recommended | Yes                                                                                          |
| Suggested split         | PR 1 (WU-A + WU-B: backend executor + internal REST) → PR 2 (WU-C + WU-D: mcp-server + docs) |
| Delivery strategy       | ask-on-risk                                                                                  |
| Chain strategy          | pending (user decision required before apply)                                                |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                                             | Likely PR | Notes                                        |
| ---- | ---------------------------------------------------------------- | --------- | -------------------------------------------- |
| WU-A | Extract `AgentToolExecutorService`; keep agent tests green       | PR 1      | base = feature branch; TDD                   |
| WU-B | `AgentToolsApiModule` (guard, context, controller, Zod schemas)  | PR 1      | depends on WU-A; TDD                         |
| WU-C | Scaffold `apps/mcp-server` app + tools + index + light node:test | PR 2      | base = PR 1 branch; verify SDK imports first |
| WU-D | Docs, curl examples, Foundry+ngrok guide, "add a tool" howto     | PR 2      | included with WU-C commit                    |

---

## WU-A: Backend Executor (PR 1 — TDD)

### Phase 1: Foundation

- [x] A-1.1 Read `apps/api/src/config/env.validation.ts` and `app.module.ts`; add `AGENT_TOOL_INTERNAL_KEY` and `FOUNDRY_DEMO_USER_ID` to the env allowlist / schema; update `apps/api/.env.example`. Test: API boots without error when both vars are set. Spec ref: Internal Key Guard / Context Service.
- [x] A-1.2 Add `packages/contracts/src/agent-tools.ts` with `getBoxBalancesSchema`, `queryTransactionsSchema`, `registerTransactionSchema`, `CommonToolResponse<T>` interface, and `toResponse()` helper; re-export all from `packages/contracts/src/index.ts`; rebuild `@app/contracts` (`pnpm --filter @app/contracts run build`). Spec ref: DTOs / Schemas.
- [x] A-1.3 Write RED unit tests in `apps/api/src/agent/agent-tool-executor.service.spec.ts`: confirmation threshold (expense 50 → no `needsConfirmation`; expense 100 no-confirm → `needsConfirmation: true`, no `transactions.create` call; expense 100 `userConfirmed` → persists; income 500 → persists); audit writes (`audits.create`+`audits.save` once on success, once on error); i18n error: with `i18n` → localized `{error}`; without → re-throws; `getBoxBalances` happy path; `queryTransactions` box-not-found → `{error, availableBoxes, hint}`; groupBy aggregation shape. Run: `pnpm --filter @app/api run test agent-tool-executor` — must be RED.

### Phase 2: Core Implementation

- [x] A-2.1 Create `apps/api/src/agent/agent-tool-executor.service.ts`: define `ToolExecCtx` interface; implement `AgentToolExecutorService` (`@Injectable`) with constructor-injected `BoxesService`, `TransactionsService`, `RecurringService`, `UsersService`, `@InjectRepository(ToolAudit) audits`; move `audited<T>()` verbatim (same try/catch/re-throw-without-i18n branch); implement `getBoxBalances`, `queryTransactions`, `registerTransaction` delegating moved logic from `agent-tools.ts`. Run spec: GREEN. Spec ref: Tool Execution Entry Point / Audit / Confirmation Guard / i18n.
- [x] A-2.2 Refactor `apps/api/src/agent/agent-tools.ts`: add optional `executor?: AgentToolExecutorService` param to `buildAgentTools(ctx, executor?)`; inside, construct fallback `new AgentToolExecutorService(ctx.boxes, ...)` when omitted; replace the 3 MVP tools' `execute()` bodies with executor delegates. Keep module-level `audited()`, `CONFIRMATION_THRESHOLD`, and all 9 remaining tools UNCHANGED. Run: `pnpm --filter @app/api run test agent-tools` — existing spec must stay GREEN.
- [x] A-2.3 Register `AgentToolExecutorService` in `AgentModule`: add to `providers` array; add to `exports` array. No import changes needed (all deps already imported). Run full API tests: `pnpm --filter @app/api run test` — all GREEN.

---

## WU-B: Internal REST Layer (PR 1 — TDD, depends on WU-A)

### Phase 3: Guard, Context, Controller

- [x] B-3.1 Write RED guard tests in `apps/api/src/agent-tools-api/agent-tools-auth.guard.spec.ts`: no header → 401; wrong key → 401; correct key → `canActivate` returns true; `AGENT_TOOL_INTERNAL_KEY` unset → 401 (fail closed). Mock `process.env`. Run: RED.
- [x] B-3.2 Create `apps/api/src/agent-tools-api/agent-tools-auth.guard.ts`: implement `CanActivate`; read `x-agent-tool-key` header; compare to `process.env.AGENT_TOOL_INTERNAL_KEY`; throw `UnauthorizedException` if missing/wrong/unset; never log header or key. Run guard spec: GREEN.
- [x] B-3.3 Write RED context service tests in `apps/api/src/agent-tools-api/agent-tools-context.service.spec.ts`: `userId` sourced from `FOUNDRY_DEMO_USER_ID` env, not request; `userId` in body/headers is ignored; locale/currency derived from loaded User (`resolveCurrency` for null currency); missing env → `SERVICE_UNAVAILABLE`; missing user → `SERVICE_UNAVAILABLE`; `conversationId` is `null` when no valid uuid header; `conversationId` is the uuid string when `x-conversation-id` is a valid uuid. Run: RED.
- [x] B-3.4 Create `apps/api/src/agent-tools-api/agent-tools-context.service.ts`: inject `UsersService` and `I18nService`; `build(req)` reads `FOUNDRY_DEMO_USER_ID`; calls `users.findById`; sets `conversationId = null` (default) or uuid from `x-conversation-id`/`x-foundry-thread-id` (only if `z.uuid().safeParse` passes); returns `ToolExecCtx`. Run context spec: GREEN.
- [x] B-3.5 Write RED controller tests in `apps/api/src/agent-tools-api/agent-tools.controller.spec.ts` (stub executor + context service): `getBoxBalances` delegates to `executor.getBoxBalances` and maps via `toResponse`; `queryTransactions` passes validated body; `registerTransaction` passes validated body; `needsConfirmation` propagates to `CommonToolResponse`; invalid body (`limit=0`, `limit=101`, `note` 301 chars, missing `type`, `amount=0`) → `BadRequestException` via `ZodValidationPipe`. Run: RED.
- [x] B-3.6 Create `apps/api/src/agent-tools-api/agent-tools.controller.ts`: `@Controller('agent-tools')`, `@UseGuards(AgentToolsAuthGuard)` at class level; three `@Post` routes calling `ctxBuilder.build(req)` then executor; apply `new ZodValidationPipe(schema)` per body param; return `toResponse(result)`. Run controller spec: GREEN.
- [x] B-3.7 Create `apps/api/src/agent-tools-api/agent-tools-api.module.ts`: imports `AgentModule`, `UsersModule`, `I18nModule`; controllers `[AgentToolsController]`; providers `[AgentToolsAuthGuard, AgentToolsContextService]`. Add `AgentToolsApiModule` to `AppModule.imports`. Run full API tests: all GREEN. Run `pnpm lint && pnpm typecheck` from root: clean.

---

## WU-C: MCP Server App (PR 2 — depends on PR 1 merged)

### Phase 4: Scaffold + SDK Verification

- [ ] C-4.1 Before writing any TypeScript: verify `@modelcontextprotocol/sdk` via Context7/WebSearch — exact version, correct import paths for `McpServer` and `StreamableHTTPServerTransport`, `registerTool` API signature (name, options, handler), whether it ships zod-v4 support or still peer-deps zod-v3. Document findings inline in `apps/mcp-server/package.json` comments and carry the correct import paths into all subsequent tasks. Spec ref: MCP server §4.1.
- [ ] C-4.2 Create `apps/mcp-server/package.json` (`name: @app/mcp-server`, `"type": "module"`, scripts: `dev`, `start`, `build: tsc`, `typecheck: tsc --noEmit`; no `test` script); add `@modelcontextprotocol/sdk` at verified version; add `zod` scoped to the version the SDK requires (zod-v3 if SDK doesn't support v4 yet — scope to this package only, do NOT change root); add `dotenv`; devDeps: `@app/tsconfig: workspace:*`, `tsx`, `typescript`, `@types/node`. Verify `pnpm-workspace.yaml` lists `apps/*`. Run `pnpm install --frozen-lockfile` from root; commit `pnpm-lock.yaml`. Check if any dep needs `allowBuilds` in `pnpm-workspace.yaml`.
- [ ] C-4.3 Create `apps/mcp-server/tsconfig.json` (extends `@app/tsconfig`; `outDir: dist`; `rootDir: src`; `module: Node16` or `NodeNext` matching SDK ESM requirements). Verify `pnpm --filter @app/mcp-server run typecheck` passes on empty `src/`.

### Phase 5: Core MCP Server Implementation

- [ ] C-5.1 Create `apps/mcp-server/src/config.ts`: zod `Env` schema (`PORT`, `MAYORDOMO_API_BASE_URL`, `AGENT_TOOL_INTERNAL_KEY`, `MCP_AUTH_TOKEN`); `Env.parse(process.env)` at module level — fails fast with clear message, no secret values in output; export `config`. Create `apps/mcp-server/.env.example` with all four vars.
- [ ] C-5.2 Create `apps/mcp-server/src/auth.ts`: `checkBearer(req: IncomingMessage): boolean` — compares `Authorization` header to `Bearer ${config.MCP_AUTH_TOKEN}`; never logs header or token value. Write `apps/mcp-server/src/auth.test.ts` (node:test): valid bearer → true; wrong bearer → false; missing header → false. Run: `node --test src/auth.test.ts` passes.
- [ ] C-5.3 Create `apps/mcp-server/src/mayordomo-api-client.ts`: `call(tool, body)` uses `fetch` to `POST ${config.MAYORDOMO_API_BASE_URL}/api/agent-tools/${tool}` with `x-agent-tool-key` header; on non-2xx returns `{ ok: false, error: json?.error ?? 'The finance service rejected the request.' }`; never logs key or request bodies containing secrets. Export `apiClient.getBoxBalances`, `apiClient.queryTransactions`, `apiClient.registerTransaction`. Write `apps/mcp-server/src/mayordomo-api-client.test.ts` (node:test, mock `fetch`): non-2xx with `error` field → sanitized error (no key); non-2xx without body → generic message; 200 → passes response through. Run: passes.
- [ ] C-5.4 Create `apps/mcp-server/src/tools/get-box-balances.ts`, `query-transactions.ts`, `register-transaction.ts`: each exports `{ name, description, inputShape, handler }`; `inputShape` uses the SDK-compatible zod version (re-declared locally if needed — do NOT import from `@app/contracts` if it would pull zod-v4 into the SDK path); handler calls `apiClient.*` and returns `{ content: [{ type: 'text', text: JSON.stringify(out) }] }`. `registerTransaction` handler must NOT auto-retry on `needsConfirmation: true`. Spec ref: Registered Tools / needsConfirmation Must Not Be Auto-Retried / Security Invariants.
- [ ] C-5.5 Create `apps/mcp-server/src/tools/index.ts`: exports array of all 3 tool definitions for registration. Create `apps/mcp-server/src/index.ts`: import `McpServer` + `StreamableHTTPServerTransport` at verified paths; register tools via `server.registerTool`; create `http.createServer`; on `POST /mcp` run `checkBearer` → 401 on fail; create stateless transport (`sessionIdGenerator: undefined`) per request; `res.on('close', () => transport.close())`; `await server.connect(transport)`; `await transport.handleRequest(req, res)`; all other paths → 404; listen on `config.PORT`. Spec ref: Bearer Token Auth / Unknown route 404 / Stateless Streamable HTTP.
- [ ] C-5.6 Run `pnpm --filter @app/mcp-server run build` and `pnpm --filter @app/mcp-server run typecheck` — both must pass clean. Run root `pnpm typecheck` (ROOT, not filtered) — must also pass. Spec ref: workspace integration.

---

## WU-D: Docs & Verification (PR 2, included with WU-C)

### Phase 6: Documentation

- [ ] D-6.1 Update `apps/mcp-server/.env.example` with inline comments explaining each var; add brief run instructions as comments above `dev` script in `package.json`. No separate README file needed unless there is an existing pattern in the repo.
- [ ] D-6.2 Document in a commit message (or inline comment in `src/index.ts`) the curl smoke-test commands: `curl -X POST http://localhost:8080/mcp` (missing auth → 401); `curl -X POST http://localhost:8080/unknown` (→ 404); tool call with bearer + MCP JSON payload; equivalent `POST /api/agent-tools/get-box-balances` call with `x-agent-tool-key`. Paths must use `/api/agent-tools/` prefix. Spec ref: §4 verification.
- [ ] D-6.3 Add a comment block in `apps/mcp-server/src/tools/index.ts` describing the "how to add a 4th tool" pattern: create `tools/your-tool.ts` → export `{ name, description, inputShape, handler }` → add to the array in `tools/index.ts` → add a route in `apps/api/src/agent-tools-api/agent-tools.controller.ts` → add method in `AgentToolExecutorService` → add schema in `@app/contracts`. No code changes needed to `index.ts` or transport.

---

## CI Gates (run before each PR)

- [ ] `pnpm install --frozen-lockfile` — lockfile must be committed and consistent.
- [ ] `pnpm --filter "./packages/**" run build` — contracts rebuild clean.
- [ ] `pnpm lint` — no errors.
- [ ] `pnpm typecheck` (ROOT — not filtered; catches packages/i18n + mcp-server).
- [ ] `pnpm build` — all apps build.
- [ ] `pnpm test` / `pnpm -r --if-present run test` — `@app/api` jest passes; `@app/mcp-server` node:test passes; no other suite regresses.
