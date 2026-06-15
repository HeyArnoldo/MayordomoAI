# Proposal: MCP Tools Integration (Remote MCP Server for Azure AI Foundry)

## Intent

Azure AI Foundry agents cannot reuse MayordomoAI's finance tools today; the tool logic is locked inside the in-app Vercel AI SDK agent (`agent-tools.ts`). We need to expose those tools to external Foundry agents over a **remote MCP server** WITHOUT giving the MCP layer any database access, and without duplicating the financial rules (confirmation threshold, audit trail, i18n errors). Architecture: `Foundry Agent → MCP Server → secure NestJS backend → existing internal services → PostgreSQL`. The MCP server only validates auth, exposes tools, and calls secure internal REST endpoints.

## Scope

### In Scope

- New `AgentToolExecutorService` in `AgentModule` (exported): owns per-tool logic, the `audited()` wrapper, `CONFIRMATION_THRESHOLD` guard, and i18n error translation.
- Refactor `agent-tools.ts` so existing tools delegate to the executor (current agent keeps working).
- New internal REST controller `/api/agent-tools/...` (Zod + ZodValidationPipe) protected by an `x-agent-tool-key` guard, exposing 3 tools: `getBoxBalances`, `queryTransactions`, `registerTransaction`.
- Context loader that resolves server-side `userId` (MVP: `FOUNDRY_DEMO_USER_ID`) and loads the User (UsersService.findById) for locale/currency/i18n.
- New `@app/mcp-server` app: `@modelcontextprotocol/sdk` + zod, remote Streamable HTTP transport (`POST /mcp`), bearer auth, calls backend with `x-agent-tool-key`. Exposes the same 3 tools.
- Folder/registry structure ready to add the remaining 9 tools.

### Out of Scope

- Implementing the other 9 tools (getExchangeRate, listRecurringExpenses, addRecurringExpense, removeRecurringExpense, updateAllocation, createBox, updateBox, voidTransaction, updatePreferences).
- Real thread/conversation → userId mapping (design for it only).
- Any DB access from the MCP server. No raw SQL / admin / debug tools.
- Multi-user demo auth (MVP is single demo user).

## Capabilities

### New Capabilities

- `agent-tool-executor`: shared service centralizing tool logic, audit, confirmation guard, i18n errors.
- `agent-tools-internal-api`: secure internal REST endpoints under `/api/agent-tools` with internal-key guard.
- `mcp-server`: standalone remote MCP server (Streamable HTTP) bridging Foundry to the internal API.

### Modified Capabilities

- None at the spec level. `agent-tools.ts` is refactored to call the executor (behavior preserved).

## Approach

Four mandatory corrections (override the original assumptions, which were guesses):

1. **Endpoints under `/api/agent-tools/...`** — the global prefix in `main.ts` serves all controllers under `/api`. Original `/agent-tools` paths/curls are corrected.
2. **Zod DTOs + ZodValidationPipe, NOT class-validator** — there is no global ValidationPipe; class-validator DTOs would silently NOT validate (security hole). Schemas in `@app/contracts`.
3. **Extract `AgentToolExecutorService` is MANDATORY** — move tool logic + `audited()` + `CONFIRMATION_THRESHOLD` + i18n errors into it; both `agent-tools.ts` and the new controller call it. Avoids duplicating financial rules/audit and keeps the current agent working.
4. **Context service LOADS the user** — UsersService.findById resolves locale/currency/i18n; never just `userId` from env.

**Security model**: Two auth layers — Foundry→MCP `Authorization: Bearer MCP_AUTH_TOKEN`; MCP→backend `x-agent-tool-key: AGENT_TOOL_INTERNAL_KEY` (NestJS guard, not for end users). `userId` is NEVER accepted from Foundry/MCP/body/params/headers — resolved server-side (`FOUNDRY_DEMO_USER_ID`). Server-side confirmation stays enforced. No stack traces/secrets returned. No token/key logging. Demo-user caveat: MVP is effectively single-user; blast radius is that one demo account.

## Affected Areas

| Area                                                | Impact   | Description                              |
| --------------------------------------------------- | -------- | ---------------------------------------- |
| `apps/api/src/agent/agent-tools.ts`                 | Modified | Tools delegate to executor               |
| `apps/api/src/agent/agent-tool-executor.service.ts` | New      | Shared executor (logic+audit+guard+i18n) |
| `apps/api/src/agent/agent-tools.controller.ts`      | New      | `/api/agent-tools/*` + key guard         |
| `apps/api/src/agent/*.guard.ts`                     | New      | `x-agent-tool-key` guard                 |
| `packages/contracts`                                | Modified | Zod schemas/DTOs for endpoints           |
| `apps/mcp-server/**`                                | New      | `@app/mcp-server` Streamable HTTP app    |

## Risks

| Risk                                   | Likelihood | Mitigation                                                                               |
| -------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| Executor refactor breaks current agent | Med        | Behavior-preserving extraction; keep `audited`/threshold/i18n identical; run agent tests |
| Secret leakage (keys/tokens)           | Med        | Env-only secrets, guard rejects missing key, no secret logging, sanitized errors         |
| Demo-user blast radius                 | Low        | Single demo account in MVP; document; design thread→userId for later                     |
| MCP SDK import drift                   | Low        | Verify exact `@modelcontextprotocol/sdk` imports at design/impl time                     |

## Rollback Plan

MCP server is a separate app — stop/undeploy it with no API impact. The executor refactor is the only change to live code: revert `agent-tools.ts` + remove executor/controller/guard via the feature branch (no Coolify auto-deploy until merged to `main`). DB untouched (only reads `tool_audits` via existing path).

## Dependencies

- `@modelcontextprotocol/sdk`, `zod`, `dotenv`, `tsx` (mcp-server).
- Env vars — api: `AGENT_TOOL_INTERNAL_KEY`, `FOUNDRY_DEMO_USER_ID`; mcp-server: `PORT`, `MAYORDOMO_API_BASE_URL`, `AGENT_TOOL_INTERNAL_KEY`, `MCP_AUTH_TOKEN`.

## Success Criteria

- [ ] Foundry agent calls the 3 tools via `POST /mcp` and gets correct results.
- [ ] Existing in-app agent still passes its tests after the executor refactor.
- [ ] Internal endpoints reject requests without a valid `x-agent-tool-key`.
- [ ] `userId` is resolved server-side; no caller-supplied id is ever trusted.
- [ ] Confirmation guard and audit rows behave identically across both call paths.
- [ ] Adding a 4th tool requires only registry/executor wiring, no architectural change.
