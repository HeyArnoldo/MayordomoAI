# Agent Tool Executor Specification

## Purpose

Shared service centralizing all per-tool logic, audit trail, high-expense confirmation guard, and i18n error translation. Both the in-app Vercel AI SDK agent and the new internal REST layer MUST call through this service — never duplicate tool logic elsewhere.

## Requirements

### Requirement: Tool Execution Entry Point

The `AgentToolExecutorService` MUST expose a typed method per tool that accepts strongly-typed arguments and returns a typed result. The service MUST be exported from `AgentModule` so the REST controller can inject it.

#### Scenario: Successful tool execution

- GIVEN the executor is called with a valid tool name and valid arguments
- WHEN the tool method resolves without error
- THEN the method returns the tool's typed result payload
- AND no error is thrown or propagated

#### Scenario: Unknown tool call is rejected

- GIVEN the executor receives an unrecognized tool name
- WHEN the dispatch is attempted
- THEN an error is thrown before any DB or service call occurs

---

### Requirement: Audit Row on Every Call

The executor MUST write one `tool_audits` row per tool invocation, regardless of success or failure, capturing `userId`, `conversationId`, `tool`, `args`, and `result`.

#### Scenario: Audit written on success

- GIVEN a tool call completes successfully
- WHEN the executor saves the audit row
- THEN a row exists in `tool_audits` with the correct `userId`, `tool`, serialized `args`, and serialized `result`

#### Scenario: Audit written on tool failure

- GIVEN a tool call throws a domain error
- WHEN the executor catches and re-throws
- THEN a row is still written to `tool_audits` with `result` containing the error descriptor (no stack trace, no secrets)

---

### Requirement: High-Expense Confirmation Guard

When `registerTransaction` is called with `type = expense`, `amount >= CONFIRMATION_THRESHOLD` (100), and `userConfirmed != true`, the executor MUST NOT persist the transaction. It MUST return `{ needsConfirmation: true, message }` where `message` is the i18n-translated confirmation prompt for the user's locale.

#### Scenario: Expense below threshold persists immediately

- GIVEN `type = expense`, `amount = 50`, `userConfirmed` is absent
- WHEN the executor processes the call
- THEN the transaction is persisted and the result contains the created transaction data
- AND `needsConfirmation` is absent from the result

#### Scenario: Expense at threshold without confirmation is blocked

- GIVEN `type = expense`, `amount = 100`, `userConfirmed` is absent or false
- WHEN the executor processes the call
- THEN no transaction row is written to the database
- AND the result is `{ needsConfirmation: true, message: "<locale-specific prompt>" }`

#### Scenario: Expense at threshold with confirmation persists

- GIVEN `type = expense`, `amount = 100`, `userConfirmed = true`
- WHEN the executor processes the call
- THEN the transaction is persisted
- AND `needsConfirmation` is absent from the result

#### Scenario: Income type skips confirmation guard entirely

- GIVEN `type = income`, `amount = 500`, `userConfirmed` is absent
- WHEN the executor processes the call
- THEN the transaction is persisted with no confirmation check

---

### Requirement: i18n Error Translation

All user-facing error messages returned by the executor MUST be translated using the User's locale resolved via `UsersService.findById(FOUNDRY_DEMO_USER_ID)`. Raw exception messages, stack traces, environment variable values, and internal service names MUST NOT appear in any response.

#### Scenario: Locale-aware error message

- GIVEN the demo user has locale `es`
- WHEN a domain error occurs (e.g., box not found)
- THEN the error message returned is in Spanish
- AND contains no stack trace or internal identifier

#### Scenario: Sanitized unknown error

- GIVEN an unexpected internal error (e.g., DB timeout)
- WHEN the executor catches it
- THEN the result contains a generic, sanitized error message
- AND the original error details are logged server-side only

---

### Requirement: Behavior Parity with Existing Agent

After refactoring `agent-tools.ts` to delegate to the executor, all existing tool behaviors MUST remain identical: same output shape, same confirmation logic, same audit writes, same error messages.

#### Scenario: In-app agent get-box-balances unchanged

- GIVEN the in-app Vercel AI SDK agent calls `getBoxBalances`
- WHEN the executor resolves the demo user and queries box balances
- THEN the response shape is identical to the pre-refactor output
- AND one `tool_audits` row is written

#### Scenario: In-app agent register-transaction confirmation unchanged

- GIVEN the in-app agent calls `registerTransaction` with a high-expense amount without `userConfirmed`
- WHEN the executor runs the confirmation guard
- THEN it returns `{ needsConfirmation: true, message }` — same as before refactor
