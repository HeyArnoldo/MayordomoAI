# Design: MCP Tools Integration (Remote MCP Server for Azure AI Foundry)

> Architecture for exposing MayordomoAI's finance tools to external Azure AI Foundry
> agents over a remote MCP server, with zero DB access from the MCP layer and no
> duplication of the financial rules (confirmation threshold, audit trail, i18n errors).
>
> Verified against real code at `apps/api/src/agent/*`, `apps/api/src/main.ts`,
> `apps/api/src/common/pipes/zod-validation.pipe.ts`, `packages/contracts/*`.

## 1. Context & Constraints (from the real code)

- `main.ts` sets `app.setGlobalPrefix('api', { exclude: ['health'] })` and **no global `ValidationPipe`**. Validation is opt-in per route via `new ZodValidationPipe(schema)` (see `chat.controller.ts`, `agent.controller.ts`). class-validator DTOs would silently NOT validate — a security hole. We use Zod + `ZodValidationPipe`.
- `ZodValidationPipe.transform()` calls `schema.parse(value)` and on `ZodError` throws `BadRequestException` (HTTP **400**) with `issues` mapped to `path: message`. So invalid bodies return **400**, not 422.
- `buildAgentTools(ctx: AgentToolsContext): ToolSet` builds Vercel AI SDK `tool()` wrappers. The current agent (`agent.service.run`) and the jest test `agent-tools.spec.ts` both call `buildAgentTools(ctx)` and `tools.<name>.execute(args, opts)`. **This contract MUST stay identical** after extraction.
- `audited<T>(ctx, toolName, args, run)` is the central audit + error-localization wrapper. Without `ctx.i18n` it **re-throws** on error (legacy behavior the test `when no i18n is present in context` asserts). With `ctx.i18n` it returns `{ error }` localized and still writes an audit row. This branch MUST be preserved verbatim.
- `CONFIRMATION_THRESHOLD = 100`. The guard in `registerTransaction` only fires for `type === EXPENSE && amount >= 100 && !userConfirmed`, returning `{ needsConfirmation: true, message }`.
- `AgentToolsContext` shape: `{ userId, conversationId, boxes, transactions, recurring, users, audits: Repository<ToolAudit>, locale: Locale, currency: string, i18n?: Pick<I18nService,'t'> }`.
- `AgentModule` imports `BoxesModule, TransactionsModule, RecurringModule, AiUsageModule, UsersModule` and `TypeOrmModule.forFeature([ToolAudit])`; currently exports only `AgentService`. `UsersModule` already exports `UsersService`.
- `User` entity: `language: Locale` (default `'es'`), `currency: string | null`. `resolveCurrency(currency)` (from `@app/contracts`) collapses null → default currency (`chat.controller.ts` calls `resolveCurrency(user.currency)`).
- Monorepo: pnpm workspaces `apps/*` + `packages/*`. Packages are `@app/api`, `@app/contracts`, `@app/i18n`, `@app/web`, `@app/tsconfig`. **zod is `^4.3.6`** across the repo (critical for MCP SDK compatibility — see §4.1).
- `@app/contracts` builds with `tsup` and is consumed via `workspace:*`. It is framework-agnostic (pure zod + types) — safe to add the internal-API request schemas there.

## 2. Architecture Overview

```
Azure AI Foundry Agent
        │  MCP (Streamable HTTP, POST /mcp)
        │  Authorization: Bearer MCP_AUTH_TOKEN
        ▼
@app/mcp-server  (Node, no DB, no Nest)
  - auth.ts        validates bearer
  - tools/*        zod input schemas + MCP descriptions
  - api-client     POST {MAYORDOMO_API_BASE_URL}/api/agent-tools/<tool>
        │  HTTP
        │  x-agent-tool-key: AGENT_TOOL_INTERNAL_KEY
        ▼
NestJS @app/api
  AgentToolsApiModule
    - AgentToolsAuthGuard        validates x-agent-tool-key
    - AgentToolsContextService   resolves userId from FOUNDRY_DEMO_USER_ID,
                                 loads User → locale/currency, builds executor ctx
    - AgentToolsController        /api/agent-tools/* (Zod + ZodValidationPipe)
        │  injects
        ▼
  AgentModule
    - AgentToolExecutorService   getBoxBalances / queryTransactions /
                                 registerTransaction + audited() + threshold + i18n
        │  calls
        ▼
  BoxesService / TransactionsService / UsersService / Repository<ToolAudit>
        ▼
  PostgreSQL
```

Two new providers in `AgentModule` (executor) and a new feature module `AgentToolsApiModule`. The MCP server is a brand-new standalone app. The only change to live agent code is the behavior-preserving extraction inside `agent-tools.ts`.

### Pattern & layering rationale

- **Hexagonal core**: `AgentToolExecutorService` is the application-service port for tool logic. The Vercel AI SDK `tool()` wrappers and the REST controller are two **driving adapters** over the same port — neither owns business rules. This is exactly the "don't duplicate financial rules/audit" requirement.
- **The MCP server is a separate bounded context / process**, intentionally anemic: it only does protocol + auth + HTTP relay. No domain logic, no DB. Blast radius and rollback are isolated (stop the process → zero API impact).

## 3. API-side design

### 3.1 Executor extraction (behavior-preserving) — `apps/api/src/agent/agent-tool-executor.service.ts`

New injectable service that **owns the per-tool logic, `audited()`, the threshold guard, and i18n errors**. The current `agent-tools.ts` keeps `buildAgentTools()` and the `tool()` wrappers but each `execute()` delegates to the executor, producing **byte-identical outputs**.

#### Executor context shape

The executor is stateless across requests; per-call context is passed explicitly so both call paths (in-app agent and REST) feed it the same way:

```ts
export interface ToolExecCtx {
  userId: string;
  conversationId: string | null;
  locale: Locale; // user's language
  currency: string; // resolveCurrency() applied, never null
  i18n?: Pick<I18nService, 't'>;
}
```

> Note: `ToolExecCtx` is `AgentToolsContext` MINUS the service handles (`boxes`, `transactions`, `recurring`, `users`, `audits`) — those become **constructor-injected dependencies** of the executor (DI), not per-call fields. This is the key structural improvement: services are injected once, request data flows per call.

#### Executor public surface

```ts
@Injectable()
export class AgentToolExecutorService {
  constructor(
    private readonly boxes: BoxesService,
    private readonly transactions: TransactionsService,
    private readonly recurring: RecurringService, // for parity / future tools
    private readonly users: UsersService,
    @InjectRepository(ToolAudit) private readonly audits: Repository<ToolAudit>,
  ) {}

  getBoxBalances(ctx: ToolExecCtx): Promise<unknown | { error: string }>;
  queryTransactions(
    ctx: ToolExecCtx,
    args: QueryTransactionsArgs,
  ): Promise<unknown | { error: string }>;
  registerTransaction(
    ctx: ToolExecCtx,
    args: RegisterTransactionArgs,
  ): Promise<unknown | { error: string }>;

  // private audited<T>(ctx, toolName, args, run) — moved verbatim from agent-tools.ts,
  // but reads ctx.userId/conversationId/locale/i18n from ToolExecCtx and uses this.audits.
}
```

- `audited()` is **moved verbatim** (same try/catch/re-throw-without-i18n branch, same two `audits.save(audits.create(...))` calls, same `toolErrorMessage(err, ctx.locale, ctx.i18n)`). It now uses `this.audits` and the `ctx` fields.
- `getBoxBalances`: `audited(ctx, 'getBoxBalances', {}, () => this.boxes.withBalances(ctx.userId))`.
- `queryTransactions`: the entire body (box-name resolution, `scanAll` heuristic, 500-row truncation warning, groupBy/isoWeek aggregation, allocated/pctOfAllocated) is **moved unchanged**, swapping `ctx.boxes`→`this.boxes`, `ctx.transactions`→`this.transactions`. `isEn`/`fmt`/`isoWeek`/`ALL_BOXES` helpers move with it (module-level helpers stay module-level; `fmt`/`isEn`/`threshold` are derived from `ctx` inside the method).
- `registerTransaction`: the threshold guard, box resolution, `CreateTransactionInput`, `transactions.create(..., TransactionSource.PWA)`, and `{ registered, boxBalance }` shape are **moved unchanged**.

#### How `agent-tools.ts` is refactored

`buildAgentTools()` signature and `AgentToolsContext` stay **exactly as-is** (so `agent.service.ts` and `agent-tools.spec.ts` don't change). Internally, the 3 MVP tools' `execute()` now delegate. To keep `buildAgentTools` a pure function (no DI) while reusing the executor, `buildAgentTools` accepts an **optional executor** and falls back to constructing one inline from `ctx`'s service handles:

```ts
export function buildAgentTools(ctx: AgentToolsContext, executor?: AgentToolExecutorService): ToolSet {
  const exec = executor ?? new AgentToolExecutorService(
    ctx.boxes, ctx.transactions, ctx.recurring, ctx.users, ctx.audits,
  );
  const ec: ToolExecCtx = {
    userId: ctx.userId, conversationId: ctx.conversationId,
    locale: ctx.locale, currency: ctx.currency, i18n: ctx.i18n,
  };
  return {
    getBoxBalances: tool({ description: ..., inputSchema: z.object({}),
      execute: (args) => exec.getBoxBalances(ec) }),
    queryTransactions: tool({ description: ..., inputSchema: <unchanged>,
      execute: (args) => exec.queryTransactions(ec, args) }),
    registerTransaction: tool({ description: ..., inputSchema: <unchanged>,
      execute: (args) => exec.registerTransaction(ec, args) }),
    // getExchangeRate, listRecurringExpenses, ... (the other 9 tools) stay INLINE,
    // still using ctx + the module-level audited(). They are out of scope; do not touch.
  };
}
```

> Decision (constructor reuse vs. fallback): we allow `new AgentToolExecutorService(...)` from `ctx` because `agent-tools.spec.ts` constructs `buildAgentTools(makeCtx(...))` with stub services and asserts the re-throw/localization behavior. The fallback keeps that test green **without** wiring DI into the test. In production, `agent.service.run()` continues to call `buildAgentTools(ctx)` (executor omitted) — identical behavior. (Alternative: inject the executor into `AgentService` and pass it through — heavier change to `agent.service.ts`; rejected to minimize live-code churn, but acceptable as a follow-up.)

> CRITICAL parity guard: only `getBoxBalances`, `queryTransactions`, `registerTransaction` move into the executor for MVP. The remaining 9 tools (`getExchangeRate`, `listRecurringExpenses`, `addRecurringExpense`, `removeRecurringExpense`, `updateAllocation`, `createBox`, `updateBox`, `voidTransaction`, `update_preferences`) stay inline and continue using the module-level `audited()`. The module-level `audited()` and `CONFIRMATION_THRESHOLD` export remain (the executor's private copy is the same logic; do not delete the exported constant — `agent.service.ts` imports `CONFIRMATION_THRESHOLD`).

#### Module wiring

`AgentModule`: add `AgentToolExecutorService` to `providers` and `exports`. No import changes needed (Boxes/Transactions/Recurring/Users modules + `TypeOrmModule.forFeature([ToolAudit])` are already imported).

### 3.2 Internal REST layer — `apps/api/src/agent-tools-api/`

New feature module (separate folder from `agent/` for clear boundary, per proposal Affected Areas, though the proposal table mentions `agent/`; **decision: put it in `apps/api/src/agent-tools-api/`** to keep the internal API surface visually distinct from the in-app agent — see §8 trade-off).

Files:

- `agent-tools-api.module.ts`
- `agent-tools.controller.ts`
- `agent-tools-auth.guard.ts`
- `agent-tools-context.service.ts`

#### `AgentToolsAuthGuard` (`agent-tools-auth.guard.ts`)

```ts
@Injectable()
export class AgentToolsAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-agent-tool-key'];
    const expected = process.env.AGENT_TOOL_INTERNAL_KEY;
    if (!expected || !provided || provided !== expected) {
      throw new UnauthorizedException(); // → HTTP 401
    }
    return true;
  }
}
```

- If `AGENT_TOOL_INTERNAL_KEY` is unset, **fail closed** (401), never open. Use a constant-time-ish compare is nice-to-have but not required (single short key). Never log the header or key.
- Applied at the **controller class level** (`@UseGuards(AgentToolsAuthGuard)`) so no endpoint can bypass it (spec requirement).

#### `AgentToolsContextService` (`agent-tools-context.service.ts`)

Builds the `ToolExecCtx`. **Never** reads any user identifier from the request.

```ts
@Injectable()
export class AgentToolsContextService {
  constructor(
    private readonly users: UsersService,
    private readonly i18n: I18nService,
  ) {}

  async build(req: Request): Promise<ToolExecCtx> {
    const userId = process.env.FOUNDRY_DEMO_USER_ID;
    if (!userId)
      throw new AppException(
        'agent_tools.demo_user_missing',
        HttpStatus.SERVICE_UNAVAILABLE,
        'FOUNDRY_DEMO_USER_ID not configured',
      );
    const user = await this.users.findById(userId);
    if (!user)
      throw new AppException(
        'agent_tools.demo_user_not_found',
        HttpStatus.SERVICE_UNAVAILABLE,
        'Configured demo user does not exist',
      );

    // conversationId: optional thread mapping for future multi-thread support.
    const thread = req.headers['x-conversation-id'] ?? req.headers['x-foundry-thread-id'];
    const conversationId =
      typeof thread === 'string' && thread.trim() ? thread.trim() : 'foundry-demo';

    return {
      userId: user.id,
      conversationId,
      locale: user.language, // Locale
      currency: resolveCurrency(user.currency), // never null
      i18n: this.i18n,
    };
  }
}
```

> `conversationId` is `string` here (`'foundry-demo'` default). `ToolAudit.conversationId` is `uuid nullable`. `'foundry-demo'` is **not** a uuid → it would fail the DB column. **Decision**: default `conversationId` to `null` for the audit column unless `x-conversation-id` is a valid uuid; keep `'foundry-demo'` only as a logical tag if needed. Simpler and DB-safe: **default `null`**, accept `x-conversation-id` only when it parses as a uuid (use `z.uuid().safeParse`). This matches the existing nullable column and the `audited()` write. (Flagged for impl: pick `null` default to avoid a `tool_audits` insert error.)

#### `AgentToolsController` (`agent-tools.controller.ts`)

```ts
@Controller('agent-tools') // → served at /api/agent-tools (global prefix)
@UseGuards(AgentToolsAuthGuard)
export class AgentToolsController {
  constructor(
    private readonly executor: AgentToolExecutorService,
    private readonly ctxBuilder: AgentToolsContextService,
  ) {}

  @Post('get-box-balances')
  async getBoxBalances(
    @Req() req: Request,
    @Body(new ZodValidationPipe(getBoxBalancesSchema)) _body: GetBoxBalancesInput,
  ): Promise<CommonToolResponse<unknown>> {
    const ctx = await this.ctxBuilder.build(req);
    return toResponse(await this.executor.getBoxBalances(ctx));
  }

  @Post('query-transactions')
  async queryTransactions(
    @Req() req: Request,
    @Body(new ZodValidationPipe(queryTransactionsSchema)) body: QueryTransactionsInput,
  ): Promise<CommonToolResponse<unknown>> {
    const ctx = await this.ctxBuilder.build(req);
    return toResponse(await this.executor.queryTransactions(ctx, body));
  }

  @Post('register-transaction')
  async registerTransaction(
    @Req() req: Request,
    @Body(new ZodValidationPipe(registerTransactionSchema)) body: RegisterTransactionInput,
  ): Promise<CommonToolResponse<unknown>> {
    const ctx = await this.ctxBuilder.build(req);
    return toResponse(await this.executor.registerTransaction(ctx, body));
  }
}
```

- All endpoints `POST` (even read-only `get-box-balances`) for a uniform body+key contract and to match the MCP→REST mapping.
- `toResponse()` maps executor output into `CommonToolResponse` (§3.3).

#### `AgentToolsApiModule` (`agent-tools-api.module.ts`)

```ts
@Module({
  imports: [AgentModule, UsersModule, I18nModule], // AgentModule exports the executor + AgentService; UsersModule exports UsersService
  controllers: [AgentToolsController],
  providers: [AgentToolsAuthGuard, AgentToolsContextService],
})
export class AgentToolsApiModule {}
```

- Imports `AgentModule` to get the **exported** `AgentToolExecutorService`. `AgentModule` already provides `TypeOrmModule.forFeature([ToolAudit])` internally, so the executor's `@InjectRepository(ToolAudit)` resolves there (no need to re-import the repo here).
- `I18nModule` for `AgentToolsContextService`'s `I18nService` (confirm `I18nService` is exported by `I18nModule`; it is used by `AgentService` via `AgentModule`'s import graph — re-import here).
- Wire into `AppModule.imports` after `AgentModule`.

### 3.3 DTOs / schemas & `CommonToolResponse`

**Decision: schemas live in `@app/contracts`** (new file `agent-tools.ts`, re-exported from `index.ts`) so the MCP server (`@app/mcp-server`) and the API share the **single source of truth** and we avoid drift (see §8). They mirror the tool `inputSchema`s **minus** any `userId` (there is none today — good) and minus the description text (descriptions stay in the tool/MCP layer).

```ts
// packages/contracts/src/agent-tools.ts
import { z } from 'zod';
import { TransactionType } from './transactions';

export const getBoxBalancesSchema = z.object({}).strict(); // empty body
export type GetBoxBalancesInput = z.infer<typeof getBoxBalancesSchema>;

export const queryTransactionsSchema = z.object({
  type: z.enum(TransactionType).optional(),
  boxNames: z.array(z.string()).optional(),
  textQuery: z.string().max(120).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  groupBy: z.enum(['none', 'box', 'day', 'week', 'month']).default('none'),
  orderBy: z.enum(['date', 'amount']).default('date'),
  limit: z.number().int().min(1).max(100).default(30),
});
export type QueryTransactionsInput = z.infer<typeof queryTransactionsSchema>;

export const registerTransactionSchema = z.object({
  type: z.enum(TransactionType),
  boxName: z.string().optional(),
  amount: z.number().positive(),
  note: z.string().max(300).optional(),
  userConfirmed: z.boolean().default(false),
});
export type RegisterTransactionInput = z.infer<typeof registerTransactionSchema>;

export interface CommonToolResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
  needsConfirmation?: boolean;
}
```

> The spec table lists `type` enum as `income | expense` for the REST layer, while the tool uses the full `TransactionType` enum (`income | expense | transit`). **Decision: reuse `z.enum(TransactionType)`** (the full enum) so REST and executor accept exactly what the executor handles — narrowing to 2 values would diverge from the executor and the in-app agent. The spec's 2-value note is a simplification; the executor already supports all three. (Flagged: if product wants to forbid `transit` over REST, narrow here — but that is a product decision, not architectural.)

#### `toResponse()` mapping

The executor returns one of: a domain payload, `{ error }`, or `{ needsConfirmation, message }` (or `{ error, availableBoxes, hint }` for box-not-found, etc.). Map into `CommonToolResponse`:

```ts
function toResponse(out: unknown): CommonToolResponse<unknown> {
  if (out && typeof out === 'object') {
    const o = out as Record<string, unknown>;
    if ('needsConfirmation' in o)
      return { ok: true, needsConfirmation: true, message: o.message as string, data: o };
    if ('error' in o) return { ok: false, error: o.error as string, data: stripError(o) };
  }
  return { ok: true, data: out };
}
```

- `needsConfirmation` is surfaced as a **first-class field** AND echoed in `data` so the MCP/Foundry side can render either. `ok: true` for needsConfirmation (it is a valid business outcome, not a failure).
- For `{ error }` outputs from the executor (already i18n-localized), set `ok: false, error`. Extra fields like `availableBoxes`/`hint` ride along in `data`.

## 4. MCP server app — `apps/mcp-server` (`@app/mcp-server`)

Standalone Node app (no Nest, no TypeORM). Run with `tsx` in dev, `node dist` in prod. Structure:

```
apps/mcp-server/
  package.json            # name @app/mcp-server, deps below
  tsconfig.json           # extends @app/tsconfig
  .env.example
  src/
    index.ts              # McpServer + Streamable HTTP transport + bearer gate + listen
    config.ts             # env validation (zod)
    auth.ts               # Bearer MCP_AUTH_TOKEN check
    mayordomo-api-client.ts  # POST to /api/agent-tools/*, x-agent-tool-key, sanitize
    tools/
      index.ts            # registry: register all tools on the server
      get-box-balances.ts
      query-transactions.ts
      register-transaction.ts
```

### 4.1 `@modelcontextprotocol/sdk` import surface — VERIFICATION STATUS

> **NOT verified online.** This design agent has no Context7/WebSearch/WebFetch access in its toolset (only filesystem + memory). The SDK is not yet installed in the repo (no lockfile entry). The following reflects the SDK API as of knowledge cutoff (Jan 2026) and is **FLAGGED for impl-time confirmation** — see Risks.

**Most likely current API** (`@modelcontextprotocol/sdk` ~1.x, ESM, subpath exports):

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
```

- `new McpServer({ name: 'mayordomoai-mcp-server', version: '0.1.0' })`.
- Tool registration: **`server.registerTool(name, { title, description, inputSchema }, handler)`** where `inputSchema` is a **zod raw shape** (`{ field: z.string() }`, i.e. `schema.shape`, NOT a wrapped `z.object`). Handler returns `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`. (Older `server.tool(name, shape, handler)` also exists; `registerTool` is the current preferred form.)
- **Streamable HTTP, stateless mode** for a remote server: construct `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` **per request** (stateless), then `await server.connect(transport)` and `await transport.handleRequest(req, res, parsedBody)`. Stateless is correct here because Foundry calls are independent and we hold no per-session server state. (Session mode would require `sessionIdGenerator` + an in-memory transport map keyed by `mcp-session-id` — unnecessary complexity and a memory-leak vector for a stateless relay. **Decision: stateless.**)

> **zod v4 compatibility caveat (HIGH-attention flag):** the repo is on **zod ^4**. Historically `@modelcontextprotocol/sdk` peer-depended on **zod ^3** and `registerTool` expected zod-v3 raw shapes. At impl time you MUST verify the installed SDK version supports zod v4. Options if it does not: (a) upgrade to an SDK version with zod-v4 support, (b) add `zod@^3` **only inside `apps/mcp-server`** (its own `package.json`, isolated from the workspace zod-4) — the MCP tool schemas are simple (string/number/enum/array) so a local zod-3 is low-risk and does not touch `@app/contracts`. **Decision: prefer (a); fall back to (b) scoped to the mcp-server package.** This also means the contracts schemas (zod-4) are reused in the **REST** layer, while the MCP tool schemas may be re-declared locally in the mcp-server with whatever zod the SDK needs (acceptable, minimal — see §8 drift mitigation).

### 4.2 `config.ts`

Validate required env at startup with zod; **fail fast** with a clear message (no secret values printed):

```ts
const Env = z.object({
  PORT: z.coerce.number().int().default(8080),
  MAYORDOMO_API_BASE_URL: z.string().url(),
  AGENT_TOOL_INTERNAL_KEY: z.string().min(1),
  MCP_AUTH_TOKEN: z.string().min(1),
});
export const config = Env.parse(process.env); // throws on missing → process exits non-zero
```

### 4.3 `auth.ts`

```ts
export function checkBearer(req: IncomingMessage): boolean {
  const h = req.headers['authorization'];
  return typeof h === 'string' && h === `Bearer ${config.MCP_AUTH_TOKEN}`;
}
```

- Never log the header or token. On failure, respond `401` before touching the transport.

### 4.4 `mayordomo-api-client.ts`

```ts
async function call(tool: string, body: unknown): Promise<CommonToolResponse<unknown>> {
  const res = await fetch(`${config.MAYORDOMO_API_BASE_URL}/api/agent-tools/${tool}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-agent-tool-key': config.AGENT_TOOL_INTERNAL_KEY,
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Sanitize: surface only a generic message + the i18n error from CommonToolResponse if present.
    return {
      ok: false,
      error: (json as any)?.error ?? 'The finance service rejected the request.',
    };
  }
  return json as CommonToolResponse<unknown>;
}
export const apiClient = {
  getBoxBalances: () => call('get-box-balances', {}),
  queryTransactions: (a) => call('query-transactions', a),
  registerTransaction: (a) => call('register-transaction', a),
};
```

- **No stack traces, no secrets** ever returned to the MCP caller. The API already returns i18n-safe `error` strings; the client only forwards `error`/`message`/`needsConfirmation`/`data`.
- Never log `x-agent-tool-key` or request bodies containing amounts in plaintext logs beyond what is operationally needed (avoid logging the key always).

### 4.5 `tools/*` and `index.ts`

Each tool module exports `{ name, description, inputShape, handler }`. The handler validates with zod, calls `apiClient`, and returns MCP `content`:

```ts
// tools/register-transaction.ts (shape may use SDK-required zod version — see §4.1)
export const registerTransactionTool = {
  name: 'registerTransaction',
  description:
    'Records a transaction (expense in a box, income distributed by %, or transit). ' +
    'High-amount expenses require explicit user confirmation (the server enforces this and returns needsConfirmation).',
  inputShape: {
    type: z.enum(['income', 'expense', 'transit']),
    boxName: z.string().optional(),
    amount: z.number().positive(),
    note: z.string().max(300).optional(),
    userConfirmed: z.boolean().optional(),
  },
  handler: async (args) => {
    const out = await apiClient.registerTransaction(args);
    return { content: [{ type: 'text', text: JSON.stringify(out) }] };
  },
};
```

`index.ts`:

```ts
const server = new McpServer({ name: 'mayordomoai-mcp-server', version: '0.1.0' });
for (const t of [getBoxBalancesTool, queryTransactionsTool, registerTransactionTool]) {
  server.registerTool(t.name, { description: t.description, inputSchema: t.inputShape }, t.handler);
}
const http = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/mcp') {
    if (!checkBearer(req)) {
      res.writeHead(401).end();
      return;
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined }); // stateless
    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res /*, parsedBody if pre-read */);
    return;
  }
  res.writeHead(404).end(); // unknown routes → 404
});
http.listen(config.PORT);
```

- Bearer check runs **before** handing to the transport. Unknown routes → 404. Listen on `config.PORT`.

### 4.6 `package.json` (mcp-server)

```jsonc
{
  "name": "@app/mcp-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "<verified version>",
    "zod": "<SDK-compatible version — see §4.1>",
    "dotenv": "^17.0.0",
    // NOTE: do NOT add @app/contracts here if it forces zod-4 into the SDK path; re-declare tool shapes locally.
  },
  "devDependencies": {
    "@app/tsconfig": "workspace:*",
    "tsx": "...",
    "typescript": "~5.9.3",
    "@types/node": "^22",
  },
}
```

## 5. Environment variables

### `apps/api/.env.example` — add

```
# Internal key the MCP server (and other trusted internal callers) must send as x-agent-tool-key.
AGENT_TOOL_INTERNAL_KEY=
# Server-side demo user whose identity ALL /api/agent-tools/* calls run as (MVP single-user).
FOUNDRY_DEMO_USER_ID=
```

> Also add to `apps/api/src/config/env.validation.ts` if it enforces a schema (verify; `app.module.ts` uses `validate: validateEnv`). If `validateEnv` is strict/allowlist-based, these two MUST be added or boot fails. **Flagged for impl: check `env.validation.ts`.**

### `apps/mcp-server/.env.example` — new file

```
PORT=8080
MAYORDOMO_API_BASE_URL=http://localhost:3000
AGENT_TOOL_INTERNAL_KEY=
MCP_AUTH_TOKEN=
```

## 6. Security & logging

- **Two auth layers**: Foundry→MCP `Authorization: Bearer MCP_AUTH_TOKEN`; MCP→API `x-agent-tool-key: AGENT_TOOL_INTERNAL_KEY`. Both fail closed (401) when missing/wrong/unset.
- **`userId` is never caller-supplied** — resolved from `FOUNDRY_DEMO_USER_ID` server-side; any `userId` in body is ignored (schemas don't include it; `ZodValidationPipe` with `getBoxBalancesSchema.strict()` would reject unexpected keys on the empty-body endpoint).
- **No secret logging**: never log `AGENT_TOOL_INTERNAL_KEY`, `MCP_AUTH_TOKEN`, or `Authorization`/`x-agent-tool-key` header values, in either app.
- **Sanitized errors**: API returns i18n-localized `error` strings via `audited()`/`toolErrorMessage` (no stack/SQL/env). The MCP api-client forwards only `error`/`message`/`needsConfirmation`/`data`; on non-2xx it returns a generic message. The Nest `HttpExceptionFilter` already standardizes API error bodies.
- **No DB from MCP**: the mcp-server has zero TypeORM/pg deps; the only outbound is HTTP to the API.
- **Server-side confirmation stays authoritative**: the threshold guard lives in the executor; the MCP `userConfirmed` flag is just relayed — it cannot bypass the guard.
- **Demo-user caveat**: MVP is effectively single-user (`FOUNDRY_DEMO_USER_ID`). Blast radius = that one demo account. Real thread→userId mapping (`x-conversation-id`/`x-foundry-thread-id`) is designed-for (accepted as conversationId tag) but not used for identity in MVP.

## 7. Testability (TDD-first targets)

API (jest is configured in `@app/api`; `testRegex: .*\.spec\.ts$`, `rootDir: src`):

1. **Executor unit tests** (`agent-tool-executor.service.spec.ts`) — construct the service with stubbed `boxes/transactions/recurring/users/audits` (same stub style as `agent-tools.spec.ts`):
   - confirmation threshold: expense 50 → persists (no `needsConfirmation`); expense 100 no-confirm → `{ needsConfirmation: true, message }`, **no** `transactions.create` call; expense 100 `userConfirmed` → persists; income 500 → persists (guard skipped).
   - audit write: `audits.create`+`audits.save` called once on success AND once on error path (with i18n).
   - i18n error: service throws `AppException` → with i18n returns localized `{ error }`; without i18n → re-throws (parity with existing test).
   - per-tool happy/error: `getBoxBalances` returns `boxes.withBalances`; `queryTransactions` box-not-found → `{ error, availableBoxes, hint }`; groupBy aggregation shape.
2. **Parity regression**: keep `agent-tools.spec.ts` green unchanged (it exercises `buildAgentTools(...).registerTransaction.execute`). This is the behavior-preserving gate.
3. **Guard test** (`agent-tools-auth.guard.spec.ts`): no header → 401; wrong key → 401; correct key → true; unset env → 401 (fail closed). Mock `process.env.AGENT_TOOL_INTERNAL_KEY`.
4. **Context service test** (`agent-tools-context.service.spec.ts`): `userId` comes from `FOUNDRY_DEMO_USER_ID` and `UsersService.findById`, **never** from the request; a `userId` in body/headers is ignored; locale/currency derived from the loaded User (`resolveCurrency` for null currency); missing env / missing user → SERVICE_UNAVAILABLE; `conversationId` null unless valid uuid header.
5. **Controller tests** (`agent-tools.controller.spec.ts`) per endpoint: with stubbed executor + context service — delegation calls the right executor method with validated body; `needsConfirmation` passthrough into `CommonToolResponse`; validation errors via `ZodValidationPipe` (unit-test the schemas directly: `limit=0/101`, `note` 301 chars, missing `type`, `amount<=0`, empty-body strict). (Guard/pipe are integration concerns; e2e optional.)

MCP server (`apps/mcp-server` has **no jest runner**):

- **Verification = build + typecheck + manual curl**. `pnpm --filter @app/mcp-server build && typecheck` must pass. Manual smoke: `curl -X POST localhost:8080/mcp` without bearer → 401; with bearer → MCP handshake; a tool call relays to the API and returns JSON content. Optionally add a tiny `node:test` for `mayordomo-api-client` sanitization (mock `fetch`) and `auth.checkBearer` — **decision: add a light `node:test` for `auth.ts` + api-client error sanitization** (no jest needed; `node --test`), since those carry security logic. Tool-registration/transport wiring is verified by build + curl.

## 8. Trade-offs & ADRs

- **ADR-1 — Executor as shared application service (chosen)** over duplicating logic in the controller. Rationale: single source for threshold/audit/i18n; both adapters call one port. Rejected: copy-paste into controller (drift, double audit logic).
- **ADR-2 — `buildAgentTools` accepts an optional executor with `ctx`-based fallback (chosen)** over injecting the executor through `AgentService`. Rationale: zero churn to `agent.service.ts` and the existing jest tests; the fallback constructs the executor from `ctx`'s service handles so `agent-tools.spec.ts` stays green. Rejected (deferred): full DI of the executor into `AgentService` — cleaner long-term, more live-code churn now.
- **ADR-3 — Internal API in its own `agent-tools-api/` module/folder (chosen)** over colocating in `agent/`. Rationale: clear security boundary (internal-key surface vs in-app agent), independent testing, easy rollback. Rejected: folding into `AgentModule` controllers (mixes JWT-guarded user surface with internal-key surface).
- **ADR-4 — REST request schemas in `@app/contracts` (chosen)** vs local-to-API. Rationale: single source of truth shareable with web/other consumers; framework-agnostic zod fits `@app/contracts`. Caveat: the **MCP server may need a different zod major** (SDK peer dep), so MCP tool shapes are **re-declared locally** in `apps/mcp-server` rather than importing `@app/contracts`. Drift mitigation: the executor's runtime `inputSchema` (the real validator) and the REST `*Schema` are both zod-4 in the same repo and can be **diff-tested** (a parity unit test asserting the REST schema shape matches the tool inputSchema fields). The MCP shapes are trivial (3 fields each) and validated again server-side by the REST Zod pipe — so MCP-side drift can never bypass the authoritative validation.
- **ADR-5 — Stateless Streamable HTTP transport (chosen)** over session mode. Rationale: relay holds no per-session state; stateless avoids a session map (memory leak / cleanup complexity) and matches independent Foundry calls. Rejected: session mode (`sessionIdGenerator` + transport map) — unneeded for a stateless bridge.
- **ADR-6 — Avoiding executor↔REST schema drift**: the executor is the **only** place that runs business validation that matters; the REST Zod schema mirrors the tool `inputSchema`. We add a small parity test comparing the two zod shapes (field names + kinds) so a change in one fails CI until the other matches. The MCP shapes are non-authoritative (re-validated downstream).

## 9. Open items flagged for implementation

1. **Verify `@modelcontextprotocol/sdk` exact version + import paths + zod-v4 support** (Context7/WebSearch at impl time). If zod-v4 unsupported, scope zod-v3 to `apps/mcp-server` only. (Risk: import drift.)
2. **`conversationId` default = `null`** for the audit row (the column is `uuid nullable`); accept `x-conversation-id` only when it parses as uuid.
3. **`env.validation.ts`**: add `AGENT_TOOL_INTERNAL_KEY` + `FOUNDRY_DEMO_USER_ID` if the validator is allowlist/strict, or boot fails.
4. **`I18nModule` export of `I18nService`**: confirm it is exported so `AgentToolsApiModule` can inject it (it is used across the app; re-import in the new module).
5. **`TransactionType` enum over REST**: design keeps the full enum (`income|expense|transit`); narrow only if product forbids `transit`.

```

```
