# MCP Server Specification

## Purpose

Standalone remote MCP application (`@app/mcp-server`) exposing the 3 MVP tools to Azure AI Foundry agents over Streamable HTTP (`POST /mcp`). The server MUST NOT access the database directly — all tool execution goes through the internal REST API. Bearer auth guards entry; `x-agent-tool-key` guards the backend call.

## Requirements

### Requirement: Bearer Token Authentication

Every inbound request to `POST /mcp` MUST carry `Authorization: Bearer <MCP_AUTH_TOKEN>`. Missing or incorrect token MUST return HTTP 401. Unknown routes MUST return HTTP 404.

#### Scenario: Valid bearer token accepted

- GIVEN a request includes `Authorization: Bearer <correct MCP_AUTH_TOKEN>`
- WHEN the MCP server receives it
- THEN the request is processed normally

#### Scenario: Missing authorization header rejected

- GIVEN a request has no `Authorization` header
- WHEN the MCP server receives it
- THEN HTTP 401 Unauthorized is returned before any tool logic runs

#### Scenario: Wrong token rejected

- GIVEN a request includes `Authorization: Bearer <wrong token>`
- WHEN the MCP server receives it
- THEN HTTP 401 Unauthorized is returned

#### Scenario: Unknown route returns 404

- GIVEN a request to any path other than `POST /mcp` (e.g., `GET /health` if not defined, `POST /tools`)
- WHEN the MCP server receives it
- THEN HTTP 404 Not Found is returned

---

### Requirement: No Direct Database Access

The MCP server MUST NOT import or instantiate any database client, ORM entity, TypeORM connection, or raw SQL driver. All data operations MUST go through `MAYORDOMO_API_BASE_URL/api/agent-tools/...` via HTTP.

#### Scenario: Tool call routed to backend only

- GIVEN a Foundry agent invokes any MCP tool
- WHEN the MCP server processes the call
- THEN the server sends an HTTP request to the internal API
- AND no DB query originates from the MCP server process

---

### Requirement: Backend Call Authentication

When the MCP server calls the internal API, every HTTP request MUST include `x-agent-tool-key: <AGENT_TOOL_INTERNAL_KEY>`. Missing or incorrect key on the backend side MUST surface as an error to the calling Foundry agent (not swallowed).

#### Scenario: Backend call includes internal key

- GIVEN any tool invocation from Foundry
- WHEN the MCP server forwards the call to the backend
- THEN the HTTP request to `MAYORDOMO_API_BASE_URL` includes `x-agent-tool-key: <value>`

#### Scenario: Backend 401 surfaced to caller

- GIVEN the backend rejects the internal key with 401
- WHEN the MCP server receives the 401
- THEN the tool invocation returns an error to the Foundry agent
- AND the error message is sanitized (no key values, no internal URLs)

---

### Requirement: Registered Tools

The MCP server MUST register exactly 3 tools at startup: `getBoxBalances`, `queryTransactions`, `registerTransaction`. Each tool MUST declare its Zod input schema matching the corresponding internal API body contract. No additional tools (SQL, admin, debug) MUST be registered.

| Tool                  | Backend Path                                 | Input Schema                                                                  |
| --------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| `getBoxBalances`      | `POST /api/agent-tools/get-box-balances`     | `{}` (empty)                                                                  |
| `queryTransactions`   | `POST /api/agent-tools/query-transactions`   | Zod: type?,boxNames?,textQuery?(≤120),from?,to?,groupBy,orderBy,limit(1..100) |
| `registerTransaction` | `POST /api/agent-tools/register-transaction` | Zod: type,boxName?,amount>0,note?(≤300),userConfirmed?                        |

#### Scenario: getBoxBalances tool invoked end-to-end

- GIVEN a Foundry agent calls `getBoxBalances` with `{}`
- WHEN the MCP server forwards to `POST /api/agent-tools/get-box-balances`
- THEN the backend returns box balances
- AND the MCP server returns the same payload to the Foundry agent

#### Scenario: queryTransactions tool invoked end-to-end

- GIVEN a Foundry agent calls `queryTransactions` with `{ groupBy: "box", orderBy: "amount", limit: 10 }`
- WHEN the MCP server forwards to `POST /api/agent-tools/query-transactions`
- THEN the backend returns the aggregated result
- AND the MCP server returns it to the Foundry agent

#### Scenario: registerTransaction high-expense confirmation propagated

- GIVEN a Foundry agent calls `registerTransaction` with `{ type: "expense", amount: 100 }`
- WHEN the backend returns `{ needsConfirmation: true, message }`
- THEN the MCP server returns the same `{ needsConfirmation: true, message }` to the Foundry agent
- AND does NOT retry or auto-confirm the transaction

#### Scenario: No extra tools registered

- GIVEN the MCP server starts up
- WHEN the tool registry is inspected
- THEN only `getBoxBalances`, `queryTransactions`, and `registerTransaction` are listed

---

### Requirement: needsConfirmation Must Not Be Auto-Retried

When the backend returns `{ needsConfirmation: true }`, the MCP server MUST return that response as-is to the calling agent. The MCP server MUST NOT re-invoke the tool with `userConfirmed: true` automatically.

#### Scenario: MCP server passes needsConfirmation through

- GIVEN the backend responds `{ needsConfirmation: true, message: "..." }`
- WHEN the MCP server receives this response
- THEN it returns `{ needsConfirmation: true, message: "..." }` to the Foundry agent verbatim
- AND no follow-up HTTP call to the backend is made for the same transaction

---

### Requirement: Security Invariants

The MCP server MUST NOT log or transmit `MCP_AUTH_TOKEN`, `AGENT_TOOL_INTERNAL_KEY`, or any other secret. Error responses to Foundry agents MUST NOT include stack traces, internal hostnames, or secret values. The server MUST NOT expose any tool that accepts a `userId` field or allows raw DB/admin operations.

#### Scenario: Error response is sanitized

- GIVEN any error occurs during a tool call (backend unreachable, validation failure, etc.)
- WHEN the MCP server constructs the error response to the Foundry agent
- THEN the response contains only a safe, descriptive error message
- AND no secret values, hostnames, stack traces, or env var names appear

#### Scenario: userId field in tool input ignored or rejected

- GIVEN a Foundry agent sends a tool call body containing `userId`
- WHEN the MCP server's Zod schema validates the input
- THEN `userId` is either stripped by the schema or rejected as an unknown field
- AND the backend is never called with a caller-supplied userId
