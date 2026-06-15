# Agent Tools Internal API Specification

## Purpose

Secure internal REST layer (`/api/agent-tools/*`) that exposes the 3 MVP tools to any authorized internal caller (the MCP server being the first). Protected by `x-agent-tool-key`. Uses Zod + `ZodValidationPipe`. Never accepts `userId` from callers — resolved server-side.

## Requirements

### Requirement: Internal Key Guard

Every endpoint under `/api/agent-tools/` MUST require the header `x-agent-tool-key` matching the `AGENT_TOOL_INTERNAL_KEY` environment variable. Missing or incorrect key MUST return HTTP 401. The guard MUST apply globally to the controller — no endpoint bypasses it.

#### Scenario: Valid key accepted

- GIVEN a request includes `x-agent-tool-key: <correct value>`
- WHEN the guard evaluates the header
- THEN the request proceeds to the route handler

#### Scenario: Missing key rejected

- GIVEN a request has no `x-agent-tool-key` header
- WHEN the guard evaluates the request
- THEN HTTP 401 Unauthorized is returned
- AND no route handler logic executes

#### Scenario: Wrong key rejected

- GIVEN a request includes `x-agent-tool-key: <wrong value>`
- WHEN the guard evaluates the header
- THEN HTTP 401 Unauthorized is returned

---

### Requirement: Server-Side User Resolution

The controller MUST resolve `userId` from `FOUNDRY_DEMO_USER_ID` (env var) and load the full User via `UsersService.findById`. No endpoint MUST accept `userId`, `user`, or any user identifier from the request body, query params, path params, or headers.

#### Scenario: userId never read from request

- GIVEN a request body includes `{ "userId": "any-value", ... }`
- WHEN the controller processes the request
- THEN `any-value` is ignored; the server-side demo user is used instead

---

### Requirement: getBoxBalances Endpoint

`POST /api/agent-tools/get-box-balances` MUST accept an empty body (`{}`), resolve the demo user, delegate to the executor, and return the user's box balances.

#### Scenario: Empty body returns balances

- GIVEN a valid `x-agent-tool-key` header and body `{}`
- WHEN `POST /api/agent-tools/get-box-balances` is called
- THEN HTTP 200 is returned with the box balances array for the demo user
- AND the response shape matches the existing agent's `getBoxBalances` output

#### Scenario: Audit row written

- GIVEN a successful call to the endpoint
- WHEN the executor completes
- THEN one `tool_audits` row exists for `tool = "getBoxBalances"` with the demo userId

---

### Requirement: queryTransactions Endpoint

`POST /api/agent-tools/query-transactions` MUST accept a Zod-validated body and return transactions or aggregations. An invalid body MUST return a structured validation error (HTTP 422 or 400), never HTTP 500.

Body schema (all fields validated by Zod):

| Field       | Type        | Constraint                                      |
| ----------- | ----------- | ----------------------------------------------- |
| `type`      | string enum | optional; `income \| expense`                   |
| `boxNames`  | string[]    | optional                                        |
| `textQuery` | string      | optional; max 120 chars                         |
| `from`      | string      | optional; format YYYY-MM-DD                     |
| `to`        | string      | optional; format YYYY-MM-DD                     |
| `groupBy`   | string enum | required; `none \| box \| day \| week \| month` |
| `orderBy`   | string enum | required; `date \| amount`                      |
| `limit`     | integer     | required; 1..100 inclusive                      |

#### Scenario: Valid body returns results

- GIVEN a valid body `{ groupBy: "none", orderBy: "date", limit: 20 }`
- WHEN `POST /api/agent-tools/query-transactions` is called with a valid key
- THEN HTTP 200 is returned with the transactions array for the demo user

#### Scenario: Missing required field returns validation error

- GIVEN a body that omits `groupBy`
- WHEN the endpoint is called
- THEN HTTP 400 or 422 is returned with a structured validation error
- AND no DB query is executed

#### Scenario: textQuery over 120 chars rejected

- GIVEN `textQuery` is a 121-character string
- WHEN the endpoint is called
- THEN HTTP 400 or 422 is returned indicating the field length violation

#### Scenario: limit out of range rejected

- GIVEN `limit = 0` or `limit = 101`
- WHEN the endpoint is called
- THEN HTTP 400 or 422 is returned indicating the range violation

#### Scenario: Audit row written on valid call

- GIVEN a successful query call
- WHEN the executor completes
- THEN one `tool_audits` row exists for `tool = "queryTransactions"` with `args` containing the validated body (no userId)

---

### Requirement: registerTransaction Endpoint

`POST /api/agent-tools/register-transaction` MUST accept a Zod-validated body and register a transaction, enforcing the confirmation guard via the executor.

Body schema:

| Field           | Type        | Constraint                    |
| --------------- | ----------- | ----------------------------- |
| `type`          | string enum | required; `income \| expense` |
| `boxName`       | string      | optional                      |
| `amount`        | number      | required; > 0                 |
| `note`          | string      | optional; max 300 chars       |
| `userConfirmed` | boolean     | optional; default false       |

#### Scenario: Income registers immediately

- GIVEN `{ type: "income", amount: 200 }` with valid key
- WHEN `POST /api/agent-tools/register-transaction` is called
- THEN HTTP 200 is returned with the created transaction
- AND the transaction row exists in the database

#### Scenario: Low expense registers immediately

- GIVEN `{ type: "expense", amount: 50 }` with valid key
- WHEN the endpoint is called
- THEN HTTP 200 is returned with the created transaction (amount < threshold)

#### Scenario: High expense without confirmation returns needsConfirmation

- GIVEN `{ type: "expense", amount: 100 }` (no `userConfirmed`) with valid key
- WHEN the endpoint is called
- THEN HTTP 200 is returned with `{ needsConfirmation: true, message: "..." }`
- AND no transaction row is written to the database

#### Scenario: High expense with userConfirmed true persists

- GIVEN `{ type: "expense", amount: 100, userConfirmed: true }` with valid key
- WHEN the endpoint is called
- THEN HTTP 200 is returned with the created transaction
- AND the transaction row exists in the database

#### Scenario: amount = 0 rejected by validation

- GIVEN `{ type: "expense", amount: 0 }` with valid key
- WHEN the endpoint is called
- THEN HTTP 400 or 422 is returned indicating amount must be > 0

#### Scenario: note over 300 chars rejected

- GIVEN `note` is a 301-character string
- WHEN the endpoint is called
- THEN HTTP 400 or 422 is returned indicating the field length violation

#### Scenario: Audit row written regardless of confirmation outcome

- GIVEN `{ type: "expense", amount: 100 }` (triggers needsConfirmation)
- WHEN the executor finishes
- THEN one `tool_audits` row exists with `tool = "registerTransaction"` and `result` containing the `needsConfirmation` response

---

### Requirement: Sanitized Error Responses

Error responses from any `/api/agent-tools/*` endpoint MUST NOT contain stack traces, environment variable values, SQL fragments, or internal service names. Errors MUST be translated to i18n-safe messages via the executor.

#### Scenario: Internal error returns sanitized message

- GIVEN an unexpected server error occurs during a tool call
- WHEN the error propagates to the response
- THEN the response body contains a generic, translated error message
- AND HTTP 500 (or mapped domain status) is returned without internal details
