# @app/mcp-server

Standalone remote MCP server that exposes MayordomoAI finance tools to Azure AI Foundry agents
over the [Model Context Protocol](https://modelcontextprotocol.io/) (Streamable HTTP transport).

The server holds **no database connection**. Every tool call is forwarded to the internal
NestJS API at `MAYORDOMO_API_BASE_URL/api/agent-tools/*` using a shared internal key.
Authentication between Foundry and this server uses a separate Bearer token.

---

## Architecture

```
Azure AI Foundry Agent
      │  Authorization: Bearer MCP_AUTH_TOKEN
      ▼
@app/mcp-server  (this app, POST /mcp)
      │  x-agent-tool-key: AGENT_TOOL_INTERNAL_KEY
      ▼
@app/api  (NestJS, POST /api/agent-tools/*)
      │
      ▼
PostgreSQL
```

---

## Environment variables

### `apps/mcp-server/.env` (copy from `.env.example`)

| Variable                  | Required | Description                                                                      |
| ------------------------- | -------- | -------------------------------------------------------------------------------- |
| `PORT`                    | No       | Port the MCP server listens on. Defaults to `3001`.                              |
| `MAYORDOMO_API_BASE_URL`  | Yes      | Base URL of the NestJS API (no trailing slash). Example: `http://localhost:3000` |
| `AGENT_TOOL_INTERNAL_KEY` | Yes      | Shared secret sent as `x-agent-tool-key` to the API. Must match the API's env.   |
| `MCP_AUTH_TOKEN`          | Yes      | Bearer token that the MCP client (Foundry) must send in `Authorization`.         |

### `apps/api/.env` additions (already in root `.env.example`)

| Variable                  | Description                                                                   |
| ------------------------- | ----------------------------------------------------------------------------- |
| `AGENT_TOOL_INTERNAL_KEY` | Must match the MCP server's value. The API rejects requests with a wrong key. |
| `FOUNDRY_DEMO_USER_ID`    | UUID of the demo user in the DB. All tool calls run as this user.             |

---

## Install and run

```bash
# From repo root — installs all workspace deps including mcp-server
pnpm install

# Copy env file and fill in values
cp apps/mcp-server/.env.example apps/mcp-server/.env

# Development (tsx watch, hot reload)
pnpm --filter @app/mcp-server run dev

# Production build
pnpm --filter @app/mcp-server run build

# Production start (after build)
pnpm --filter @app/mcp-server run start
```

---

## curl smoke tests

Replace `<mcp-token>` with `MCP_AUTH_TOKEN` and `<api-key>` with `AGENT_TOOL_INTERNAL_KEY`.

```bash
# 1. Missing auth → 401
curl -v -X POST http://localhost:3001/mcp

# 2. Wrong auth → 401
curl -v -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer wrong-token"

# 3. Unknown route → 404
curl -v http://localhost:3001/unknown

# 4. MCP initialize handshake
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer <mcp-token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'

# 5. Tool call — getBoxBalances (after initialize in same session or stateless)
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer <mcp-token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"getBoxBalances","arguments":{}}}'

# 6. Tool call — queryTransactions
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer <mcp-token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"queryTransactions","arguments":{"groupBy":"box","limit":10}}}'

# 7. Direct backend call (bypass MCP, for debugging)
curl -X POST http://localhost:3000/api/agent-tools/get-box-balances \
  -H "Content-Type: application/json" \
  -H "x-agent-tool-key: <api-key>" \
  -d '{}'
```

---

## Connect to Azure AI Foundry via ngrok

1. **Expose the server** with ngrok:

   ```bash
   ngrok http 3001
   # Copy the HTTPS URL, e.g. https://abc123.ngrok-free.app
   ```

2. **Add the tool in Foundry**:
   - Go to your Azure AI Foundry project → **Tools** → **Add** → **Custom** → **MCP**
   - **Server URL**: `https://abc123.ngrok-free.app/mcp`
   - **Authentication**: Bearer token → paste the value of `MCP_AUTH_TOKEN`
   - Save and test — Foundry should list `getBoxBalances`, `queryTransactions`, `registerTransaction`.

3. **Production**: replace ngrok with your public HTTPS endpoint (Coolify service, reverse proxy, etc.).
   The MCP server only needs port `PORT` exposed. The API (`MAYORDOMO_API_BASE_URL`) must be
   reachable from the MCP server but does **not** need to be public.

---

## Deploy on Coolify

Each app in this monorepo deploys as its own Coolify **Application** (built from its Dockerfile). The MCP server is no exception.

1. **Create a new Application** in Coolify:
   - Source: the same Git repo, branch `main`.
   - Build pack: **Dockerfile**.
   - Dockerfile location: `apps/mcp-server/Dockerfile`.
   - Build context / base directory: the **repo root** (it's a pnpm monorepo).
   - Exposed port: `3001`. Production domain: `https://mcp.mayordomoai.xyz` → Foundry uses `https://mcp.mayordomoai.xyz/mcp`.
   - Health check path: `/health` (the image also ships a Docker `HEALTHCHECK` on it) → `https://mcp.mayordomoai.xyz/health`.

2. **Set its environment variables** (Coolify panel — not a `.env` file):
   - `PORT=3001`
   - `MAYORDOMO_API_BASE_URL` — the API URL **without** `/api`. Prefer the API's internal Coolify address (private network); otherwise its public domain.
   - `AGENT_TOOL_INTERNAL_KEY` — the same value as the API.
   - `MCP_AUTH_TOKEN` — the Bearer token you paste in Foundry.

3. **Set the API's new env vars** on the existing `apps/api` Application: `AGENT_TOOL_INTERNAL_KEY` (same) and `FOUNDRY_DEMO_USER_ID` (a real user UUID). Until these are set, `/api/agent-tools/*` stays closed (401/503).

4. The **frontend** (`apps/web`) needs **no** changes for this integration.

5. In Foundry: Tools → Add → Custom → MCP → URL `https://mcp.mayordomoai.xyz/mcp` → Bearer = `MCP_AUTH_TOKEN`.

---

## Security notes

- **Two auth layers**: Foundry → MCP (`Authorization: Bearer MCP_AUTH_TOKEN`) and
  MCP → API (`x-agent-tool-key: AGENT_TOOL_INTERNAL_KEY`). Both fail closed (401) when
  missing, wrong, or unset.
- **No DB access**: the MCP server has zero database dependencies. Blast radius is limited
  to the HTTP relay.
- **userId is never caller-supplied**: the backend resolves user identity from `FOUNDRY_DEMO_USER_ID`
  (server-side env). Any `userId` in a tool call body is ignored or rejected by Zod schemas.
- **No secret logging**: `MCP_AUTH_TOKEN` and `AGENT_TOOL_INTERNAL_KEY` are never logged.
  Error responses contain only safe, i18n-localized messages — no stack traces, hostnames,
  or env var values.
- **Confirmation guard**: expenses >= 100 trigger `{ needsConfirmation: true }` from the backend.
  The MCP server relays this verbatim — it does NOT auto-confirm. The Foundry agent must ask
  the user for explicit confirmation before re-invoking with `userConfirmed: true`.
- **Demo-user caveat (MVP)**: all tool calls run as `FOUNDRY_DEMO_USER_ID`. This is a single
  shared identity. Do not use production user credentials as the demo user.

---

## How to add a new tool

The 9 remaining in-app tools (`getExchangeRate`, `listRecurringExpenses`, etc.) can be added
following this pattern:

### 1. Create `apps/mcp-server/src/tools/your-tool.ts`

```typescript
import { z } from 'zod';
import { apiClient } from '../mayordomo-api-client.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const yourTool = {
  name: 'yourToolName',
  description: 'What this tool does for the AI agent.',
  // Raw shape (ZodRawShapeCompat) — NOT z.object(). Keys map to zod schemas.
  inputShape: {
    field: z.string().describe('Field description'),
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const out = await apiClient.yourMethod(args);
    return { content: [{ type: 'text', text: JSON.stringify(out) }] };
  },
} as const;
```

### 2. Register it in `apps/mcp-server/src/tools/index.ts`

```typescript
import { yourTool } from './your-tool.js';

export const tools = [
  getBoxBalancesTool,
  queryTransactionsTool,
  registerTransactionTool,
  yourTool, // ← add here
] as const;
```

No changes needed to `src/index.ts` or the transport.

### 3. Add a method to `apiClient` in `mayordomo-api-client.ts`

```typescript
export const apiClient = {
  // ...existing methods...
  yourMethod: (args: Record<string, unknown>) => call('your-tool-route', args),
};
```

### 4. Add the route on the API side

- `apps/api/src/agent-tools-api/agent-tools.controller.ts` — new `@Post('your-tool-route')` method
- `apps/api/src/agent/agent-tool-executor.service.ts` — implement the business logic (with `audited()`)
- `packages/contracts/src/agent-tools.ts` — add Zod schema for the new endpoint's body
