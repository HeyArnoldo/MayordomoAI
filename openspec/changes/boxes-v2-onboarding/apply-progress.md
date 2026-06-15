# Apply Progress: boxes-v2-onboarding — Slice 1a (API backend only)

## Batch: 1 (first and only batch for S1 API)

**Date**: 2026-06-15
**Branch**: feat/boxes-v2-api
**Mode**: Strict TDD (per tasks.md config)
**Slice**: S1a — Box model v2, API/backend only (S1-T9 web excluded)

---

## S1-D1: Income Source Resolution (CONFIRMED)

**Finding**: `withBalances` computes `allocated` per box using:

- `allocM` = a SQL query that SUMs `split.amount` for each boxId from confirmed income transactions in the accounting month (Lima timezone: `date BETWEEN from AND to`)
- Total income for funding math = `Σ allocM.values()` — the SUM across ALL personal boxes

**Decision recorded in**: `apps/api/src/common/money.ts` (comment block at top of file)

**Key detail**: This is the accounting-month income SUM, NOT a single income event. The 4 existing SUM queries in withBalances remain unchanged as source of truth; funding targets are now derived in TypeScript (ADR-1).

---

## Completed Tasks

### S1-D1 — Income source confirmation

**Status**: [x] Done

- Resolved: accounting-month income SUM (Σ allocM.values() in withBalances)
- Documented in money.ts comment block

### S1-T1 — Add BoxMode enum and extend box entity/DTO contracts

**Status**: [x] Done

- Added `BoxMode` enum (`percent | fixed`) to `packages/contracts/src/boxes.ts`
- `createBoxSchema`: added `mode` (optional, default `percent`), `fixedAmount` (positive | null | optional), Zod refinements for fixed→amount>0 and fixed+business rejection
- `updateBoxSchema`: added `mode` and `fixedAmount` fields with refinements
- `boxSchema`: added `mode` and `fixedAmount` fields
- `boxBalanceSchema`: added `remainingToFill: z.number().nullable()`
- `CreateBoxInput` typed as `z.input<>` (not `z.infer<>`) so `mode` is optional for backward-compat
- `box.entity.ts`: added `mode: BoxMode` (varchar(10), default 'percent') and `fixedAmount: string | null` (numeric(12,2), nullable)

### S1-T2 — Add box.fixed_exceeds_income error code + i18n

**Status**: [x] Done

- Added to `packages/contracts/src/error-codes.ts`: `box.fixed_requires_amount`, `box.fixed_exceeds_income`, `box.mode_not_supported_for_scope`
- Added translations to `packages/i18n/src/locales/es/errors.ts` (Spanish)
- Added translations to `packages/i18n/src/locales/en/errors.ts` (English, satisfies constraint)
- TS1360 gate passes: packages build clean

### S1-T3 — Write pure funding-math unit tests (TDD — RED first)

**Status**: [x] Done

- Extended `apps/api/src/common/money.spec.ts` with:
  - `sumFixedCents` suite (3 tests)
  - `remainingToFill` suite (4 tests)
  - `computeAllocation` suite (7 tests covering all-percent, mixed, boundaries, empty remainder)
  - `isValidPctSum` with mode-filtering context (3 tests)
- Confirmed RED state (TS errors when functions didn't exist yet) before implementing

### S1-T4 — Implement computeSplit, remainingToFill, isValidPctSum in money.ts

**Status**: [x] Done

- Added to `apps/api/src/common/money.ts`:
  - `FundingBox` interface
  - `AllocationResult` interface
  - `sumFixedCents(boxes: FundingBox[]): number` — Σ fixedAmount in cents for fixed boxes only
  - `remainingToFill(fixedAmount, amountFunded): number` — max(fixedAmount - funded, 0)
  - `computeAllocation(income, boxes): AllocationResult[]` — largest-remainder split; fixed off-the-top, remainder to percent boxes
  - Updated `isValidPctSum`: added `if (pcts.length === 0) return false` guard
- 29 tests passing (GREEN)

### S1-T5 — Generate migration: add mode and fixed_amount columns

**Status**: [x] Done

- Migration file: `apps/api/src/database/migrations/1781501875806-BoxModeFixedAmount.ts`
- SQL: `ALTER TABLE "boxes" ADD "mode" character varying(10) NOT NULL DEFAULT 'percent'`
- SQL: `ALTER TABLE "boxes" ADD "fixedAmount" numeric(12,2)` (nullable)
- Migration ran successfully against dev DB on port 55432
- Backward-compatible: existing rows default to 'percent'

### S1-T6 — Rework withBalances to use computeSplit for allocation

**Status**: [x] Done

- `BoxesService.withBalances` reworked in `apps/api/src/boxes/boxes.service.ts`:
  - Total income = `Σ allocM.values()` (same source as before, S1-D1 confirmed)
  - Active personal boxes passed to `computeAllocation(totalIncome, fundingBoxes)`
  - Fixed boxes: `allocated = fixedAmount`, `remainingToFill = max(fixedAmount - amountFunded, 0)`
  - Percent boxes: `allocated = largest-remainder split of remainder by pct`
  - Non-personal and inactive boxes fall back to actual split amount (legacy behavior)
  - `toBoxDto` updated to include `mode` and `fixedAmount`

### S1-T7 — Update createBox and updateBox service methods

**Status**: [x] Done

- `BoxesService.create`: mode guard (fixed→personal only), fixedAmount required check, assertFixedDoesNotExceedIncome call
- `BoxesService.update`: mode switch support, re-checks all invariants for new mode
- `BoxesService.updateAllocation`: filters to PERCENT boxes only for pct-sum invariant; skips fixed boxes in pct update loop
- New private method `assertFixedDoesNotExceedIncome(userId, newAmount, excludeBoxId?)`: uses same accounting-month income SUM as withBalances; raises `box.fixed_exceeds_income` when Σ fixed >= income

### S1-T8 — Update updateAllocation executor tool + agent tools

**Status**: [x] Done

- `apps/api/src/agent/agent-tools.ts`:
  - `createBox` tool: added `mode` (BoxMode enum, default percent) and `fixedAmount` fields to inputSchema; description updated; result note is mode-aware
  - `updateBox` tool: added `mode`, `fixedAmount` fields to inputSchema; description updated; deactivation warning filtered to percent-mode boxes only
- (MCP server NOT changed — out of S1a scope per instructions)

---

## Tasks NOT done in S1a (per explicit exclusion)

- **S1-T9** (web box editor) — S1b, excluded
- **S1-T10** (root CI gate) — gate was run locally, all pass (see below)

---

## ROOT Gate Results (S1-T10 equivalent)

| Gate                                      | Result                                   |
| ----------------------------------------- | ---------------------------------------- |
| `pnpm install --frozen-lockfile`          | PASS                                     |
| `pnpm --filter "./packages/**" run build` | PASS                                     |
| `pnpm lint`                               | PASS (0 errors, 4 pre-existing warnings) |
| `pnpm typecheck`                          | PASS (all 6 packages)                    |
| `pnpm build`                              | PASS                                     |
| `pnpm test`                               | PASS — 355 tests, 27 suites              |

---

## TDD Cycle Evidence

| Task                                   | RED                                             | GREEN                                         | REFACTOR                              |
| -------------------------------------- | ----------------------------------------------- | --------------------------------------------- | ------------------------------------- |
| S1-T3 + S1-T4 (money.ts)               | TS errors on missing exports                    | 29 tests pass after implementation            | isValidPctSum empty-array guard added |
| S1-T6 (withBalances)                   | Existing 8 service tests still pass             | Pass with new mock fields (mode, fixedAmount) | —                                     |
| S1-T7 (create/update/updateAllocation) | New test for fixed-box exclusion from invariant | 9 service tests pass                          | —                                     |

---

## Commits

1. `a9fca11` — docs(sdd): add boxes-v2-onboarding plan
2. `c510a58` — feat(contracts): add BoxMode enum, mode/fixedAmount fields, and fixed-box error codes
3. `96a2975` — feat(boxes): add mode and fixedAmount columns to Box entity and generate migration
4. `c574c6d` — feat(money): add computeAllocation, sumFixedCents, remainingToFill for boxes-v2 funding math (TDD)
5. `0a788c7` — feat(boxes): rework withBalances and add mode/fixedAmount to box mutations
6. `00c4826` — feat(agent): extend createBox and updateBox tools with mode and fixedAmount support

---

## What Remains for S1b (Web)

- **S1-T9**: Web box editor — add mode toggle (percent/fixed) + fixedAmount numeric input
  - Files: `apps/web/src/features/boxes/new-box-dialog.tsx`, `apps/web/src/features/boxes/` (box editor component)
  - API contract is ready; web only needs to pass `mode` and `fixedAmount` to the create/update calls

## Risks / Deviations

- `assertFixedDoesNotExceedIncome` requires an active DB connection (integration test). Unit tests for service mock the repo, so this guard is not unit-tested — an integration test should be added in S1-verify.
- `isValidPctSum` behavior change: now returns `false` for empty array (was `false` before since `total=0 !== 10000`; explicit guard added for clarity). Pre-existing tests still pass.
- `CreateBoxInput` uses `z.input<>` instead of `z.infer<>` to keep `mode` optional in TypeScript callers — this is intentional for backward-compat.

---

## Post-S1a Correctness Fix

**Commit**: `fix(boxes): fixed-income guard allows zero-income and equal-to-income budgets`

**Problem**: `assertFixedDoesNotExceedIncome` used `proposedFixedCents >= incomeCents`, causing two bugs:

1. Zero-income trap: new users with no income recorded (incomeCents = 0) could not create any fixed box because `proposedFixedCents >= 0` is always true.
2. All-fixed budgets: `fixed == income` (entire income committed to fixed envelopes) was wrongly rejected.

**Fix**: Condition changed to `incomeCents > 0 && proposedFixedCents > incomeCents`.

- income = 0 → guard skipped (no constraint yet; AI onboarding can create boxes before income is entered).
- fixed = income → allowed (remainder = 0 is valid).
- fixed > income (income > 0) → rejected with `box.fixed_exceeds_income` as before.

**Files changed**:

- `apps/api/src/boxes/boxes.service.ts` line 292 — guard condition updated
- `apps/api/src/boxes/boxes.service.spec.ts` — 4 new unit tests covering all three boundaries
- `openspec/changes/boxes-v2-onboarding/specs/boxes/spec.md` — scenario updated to reflect corrected semantics

**Gate results**: packages build PASS, lint PASS (0 errors), typecheck PASS, tests 359/359 PASS (27 suites).

---

## Batch: 2 — S1b (Web box editor)

**Date**: 2026-06-15
**Branch**: feat/boxes-v2-web
**Mode**: Standard (no jest in web; UI component task)
**Slice**: S1b — Web layer only

---

### S1-T9 — Web box editor: mode toggle (percent / fixed) + fixedAmount input

**Status**: [x] Done

**Files changed**:

- `apps/web/src/features/boxes/new-box-dialog.tsx` — Added `BoxMode` import, `MODE_OPTIONS` constant, mode state, fixedAmount state; dialog description switches based on mode; mode toggle (2-up card buttons identical to type toggle) hidden when business scope; fixedAmount Input shown only when mode=fixed; business scope checkbox hidden for fixed mode (API rejects fixed+business); submit passes `mode` + `fixedAmount` for fixed or `mode: percent` for percent; toast message is mode-aware (`new.createdFixed` for fixed); dialog reset on close
- `apps/web/src/features/boxes/edit-box-dialog.tsx` — Added `BoxMode` import; mode state seeded from `box.mode ?? PERCENT`; fixedAmount state seeded from `box.fixedAmount`; mode toggle shown only for personal-scope boxes; fixedAmount input shown when mode=fixed; dirty check includes mode + fixedAmount changes; save payload is mode-discriminated; archive behavior (`{active: false, pct: 0}`) is unchanged
- `apps/web/src/pages/boxes.tsx` — Split active personal boxes into `percentBoxes` and `fixedBoxes`; allocation editor (100% sum) applies to `percentBoxes` only; fixed boxes rendered in a separate labeled section with amount + fill-progress bar + remaining-to-fill from `box.remainingToFill`; `RotateCcw` archived section with `handleReactivate` that calls `useUpdateBox({active:true})`; all `onError` handlers use `translateApiError` (covers `box.fixed_exceeds_income`)
- `packages/i18n/src/locales/es/boxes.ts` — Added keys: `editor.percentBoxesTitle`, `editor.fixedBoxesTitle`, `editor.fixedBoxesNote`, `editor.remainingToFill`, `editor.fullyFunded`, `editor.reactivateSection`, `editor.reactivate`, `editor.reactivated`; `new.descriptionFixed`, `new.modeLabel`, `new.modePercent`, `new.modePercentHint`, `new.modeFixed`, `new.modeFixedHint`, `new.fixedAmountLabel`, `new.fixedAmountPlaceholder`, `new.createdFixed`; `edit.modeLabel`, `edit.modePercent`, `edit.modeFixed`, `edit.fixedAmountLabel`, `edit.fixedAmountPlaceholder`
- `packages/i18n/src/locales/en/boxes.ts` — Identical set of keys (required for `satisfies typeof es` to compile)
- `packages/contracts/src/boxes.ts` — `CreateBoxInput = z.input<>` (not `z.infer<>`) so `mode` is optional for callers; `mode` field uses `.optional().default()` to match input semantics

**Commit**: `9e56440` — `feat(web): box editor supports fixed/percent modes and remaining-to-fill`

---

### S1-T9 Gate Results

| Gate                                      | Result                                                  |
| ----------------------------------------- | ------------------------------------------------------- |
| `pnpm --filter "./packages/**" run build` | PASS                                                    |
| `pnpm --filter @app/web run typecheck`    | PASS (0 errors)                                         |
| `pnpm typecheck` (root)                   | PASS (all 6 packages)                                   |
| `pnpm --filter @app/web run build`        | PASS (no errors, pre-existing chunk size warnings only) |
| `pnpm lint` (root)                        | PASS (0 errors, 4 pre-existing warnings)                |

---

## S1 Complete Summary

All S1 tasks (S1-D1 + S1-T1 through S1-T9) are done. S1-T10 root CI gate can now be run.

| Task                             | Status   |
| -------------------------------- | -------- |
| S1-D1 Income source              | [x] Done |
| S1-T1 Contracts BoxMode          | [x] Done |
| S1-T2 Error codes + i18n         | [x] Done |
| S1-T3 money.ts unit tests        | [x] Done |
| S1-T4 money.ts implementation    | [x] Done |
| S1-T5 Migration                  | [x] Done |
| S1-T6 withBalances rework        | [x] Done |
| S1-T7 createBox/updateBox guards | [x] Done |
| S1-T8 Agent tools                | [x] Done |
| S1-T9 Web editor                 | [x] Done |

---

## Batch: 3 — S3 (Remove transit)

**Date**: 2026-06-15
**Branch**: feat/remove-transit
**Mode**: Standard (TDD for S3-T1 invariant validator; no test runner for web)
**Slice**: S3 — Remove transit transaction type (independent slice)

---

## Completed Tasks (S3)

### S3-T1 — Migration: void transit rows + verify-zero gate

**Status**: [x] Done

**Files**:

- `apps/api/src/database/migrations/1781510000000-RemoveTransitType.ts` — hand-written (NOT generated; DB must not be touched)
  - `up()` step 1: `UPDATE transactions SET status='voided', deletedAt=now() WHERE type='transit' AND deletedAt IS NULL`
  - `up()` step 2: verify-zero COUNT gate — throws and aborts if any non-voided transit rows remain
  - `up()` step 3a–d: RENAME old enum → CREATE 2-value enum → ALTER COLUMN USING cast → DROP old enum
  - `down()`: restores 3-value enum; voided transit rows cannot auto-restore their type (documented)
- `apps/api/src/database/seeds/run-seed.ts` — removed TRANSIT seed row; updated count comment (15→14)

**TDD**: `assertNoTransitRows` pure helper tested in `transactions.service.spec.ts` — 4 cases (empty, all voided, one active, multiple active)

### S3-T2 — Enum narrow (combined into S3-T1 migration)

**Status**: [x] Done (part of 1781510000000-RemoveTransitType.ts)

### S3-T3 — Remove TRANSIT from TransactionType enum (contracts)

**Status**: [x] Done

**Files**:

- `packages/contracts/src/transactions.ts` — removed `TRANSIT = 'transit'` from `TransactionType` enum; removed transit comment from `createTransactionSchema` boxId field; `z.enum(TransactionType)` now auto-rejects transit in all schemas
- `apps/api/src/transactions/transaction.entity.ts` — removed transit comment from boxId field
- `apps/api/src/transactions/transactions.service.ts` — removed transit comment from create() jsdoc

### S3-T4 — Remove transit from agent tools and MCP tools

**Status**: [x] Done

**Files**:

- `apps/api/src/agent/agent-tools.ts` — updated `queryTransactions` description (removed "transits" references); updated `registerTransaction` description; updated `type` field describe text to `income | expense` (removed "| transit")
- `apps/mcp-server/src/tools/register-transaction.ts` — schema changed from `z.enum(['income','expense','transit'])` to `z.enum(['income','expense'])`; boxName describe updated; tool description updated
- `apps/mcp-server/src/tools/query-transactions.ts` — schema type field changed from 3-value to 2-value enum

### S3-T5 — Remove transit from i18n catalogs

**Status**: [x] Done

**Files**:

- `packages/i18n/src/locales/es/transactions.ts` — removed `filters.transit`, `registro.typeTransit`, `types.transit`
- `packages/i18n/src/locales/en/transactions.ts` — same removals (kept in sync; `satisfies typeof es` constraint passes)

### S3-T6 — Web: remove transit from UI components

**Status**: [x] Done

**Files**:

- `apps/web/src/features/registro/registro-dialog.tsx` — removed `TransactionType.TRANSIT` entry from `TYPES` array
- `apps/web/src/pages/transactions.tsx` — removed `{ labelKey: 'filters.transit', value: TransactionType.TRANSIT }` from `FILTERS` array
- `apps/web/src/components/mayordomo/transaction-row.tsx` — removed `ArrowUpDown` import; removed `isTransit` const; `Icon` simplified to `ArrowDown : ArrowUp`; `label` fallback uses `t('types.expense')` for legacy voided transit rows (no-box case); `Money` sign/className simplified
- `apps/web/src/components/mayordomo/transaction-detail.tsx` — removed `ArrowUpDown` import; removed `isTransit` const; `Icon` simplified; type row uses `t('types.expense')` for all non-income; `Money` sign simplified

**Safe fallback for legacy transit rows**: voided transit rows that may exist pre-migration will display as "expense" category with a minus sign — inert, no balance impact, consistent with voided status.

### S3-T7 — Root CI gate

**Status**: [x] Done

| Gate                                         | Result                                   |
| -------------------------------------------- | ---------------------------------------- |
| `pnpm install --frozen-lockfile`             | PASS                                     |
| `pnpm --filter "./packages/**" run build`    | PASS                                     |
| `pnpm lint`                                  | PASS (0 errors, 4 pre-existing warnings) |
| `pnpm typecheck`                             | PASS (all 6 packages)                    |
| `pnpm --filter @app/web exec tsc -b --force` | PASS (0 errors)                          |
| `pnpm build`                                 | PASS (all 5 packages)                    |
| `pnpm --filter @app/api run test`            | PASS — 367 tests, 27 suites              |

---

## TDD Cycle Evidence (S3)

| Task                        | RED                                       | GREEN                                    | REFACTOR |
| --------------------------- | ----------------------------------------- | ---------------------------------------- | -------- |
| S3-T1 assertNoTransitRows   | Tests written before migration helper     | 4 tests pass (pure helper)               | —        |
| S3-T3 schema transit reject | Tests written first (transit not in enum) | 4 schema tests pass (2 reject, 2 accept) | —        |

---

## Commits (S3)

1. `253676c` — `feat(contracts): remove transit from TransactionType enum and i18n catalogs`
2. `5fb6440` — `feat(migrations): add RemoveTransitType migration — void transit rows then narrow enum`
3. `55e55b2` — `feat(api): remove transit type from service, entity, seed, and agent tool descriptions`
4. `c3086ed` — `feat(mcp-server): remove transit from register and query transaction tool schemas`
5. `2b2de78` — `feat(web): remove transit type from UI components and transaction filter`
6. `c8b59c1` — `test(transactions): add transit-rejection and assertNoTransitRows invariant tests for S3`

---

## S3 Complete Summary

All S3 tasks (S3-T1 through S3-T7) are done. Ready for sdd-verify.

| Task                            | Status   |
| ------------------------------- | -------- |
| S3-T1 Migration (void + narrow) | [x] Done |
| S3-T2 Enum narrow               | [x] Done |
| S3-T3 Contracts enum            | [x] Done |
| S3-T4 Agent + MCP tools         | [x] Done |
| S3-T5 i18n catalogs             | [x] Done |
| S3-T6 Web UI                    | [x] Done |
| S3-T7 Root CI gate              | [x] Done |

---

## Batch: 3 — S2 (Unify recurring into fixed boxes)

**Date**: 2026-06-15
**Branch**: feat/boxes-v2-recurring
**Mode**: Standard (deletions dominate; no pure business logic to TDD)
**Slice**: S2 — Unify recurring→fixed boxes (all 7 tasks)

---

### S2-T1 — Data migration: convert recurring_expenses to fixed boxes

**Status**: [x] Done

**File**: `apps/api/src/database/migrations/1781600000000-UnifyRecurringIntoFixedBoxes.ts`

**up()**: INSERT INTO boxes selecting from recurring_expenses (mode='fixed', fixedAmount=amount, type='expense', scope='personal', pct=0, active=true); then DROP INDEX, DROP TABLE recurring_expenses.

**down()**: best-effort recreate recurring_expenses schema (data cannot be auto-restored from boxes).

**Commit**: `ec04fb5` — feat(migration): add UnifyRecurringIntoFixedBoxes - move recurring to fixed boxes and drop table

---

### S2-T2 — Remove recurring module, entity, and table references from API

**Status**: [x] Done

**Files deleted**:

- `apps/api/src/recurring/recurring-expense.entity.ts`
- `apps/api/src/recurring/recurring.module.ts`
- `apps/api/src/recurring/recurring.service.ts`
- `apps/api/src/recurring/recurring.service.spec.ts`
- `apps/api/src/whatsapp/recurring-reminder.service.ts`

**Files modified**:

- `apps/api/src/agent/agent.module.ts` — removed RecurringModule import
- `apps/api/src/whatsapp/whatsapp.module.ts` — removed RecurringModule import and RecurringReminderService provider

**Commit**: `8db9126` — feat(recurring): remove recurring module, entity, service, and reminder cron

---

### S2-T3 — Remove/remap the 3 recurring-expense agent tools

**Status**: [x] Done

**What changed**:

- `apps/api/src/agent/agent-tools.ts`: removed `addRecurringExpense` and `removeRecurringExpense` tools; remapped `listRecurringExpenses` to query active fixed-expense boxes from BoxesService; removed `recurring` from AgentToolsContext; updated executor construction call
- `apps/api/src/agent/agent-tool-executor.service.ts`: removed RecurringService from constructor and imports
- `apps/api/src/agent/agent.service.ts`: removed RecurringService import and constructor arg; updated system prompt recurring references; removed `recurring` from buildAgentTools call
- `apps/api/src/agent/agent-tools.spec.ts`: removed `recurring` from makeCtx stub
- `apps/api/src/agent/agent-tool-executor.service.spec.ts`: removed `recurring` from makeService stub
- `apps/api/src/agent/agent.service.spec.ts`: removed extra constructor argument

**listRecurringExpenses remapped to**: filter `BoxesService.findAll()` for `active && mode === 'fixed' && type === 'expense'`; returns `{items: [{id, name, fixedAmount}], monthlyTotal}` — same shape as before for backward compat.

**Commit**: `46ce23d` — feat(agent): remove add/removeRecurringExpense tools, remap listRecurringExpenses to fixed boxes

---

### S2-T4 — Update i18n: remove recurring error code and reminder strings

**Status**: [x] Done

**Files modified**:

- `packages/contracts/src/error-codes.ts`: removed `'recurring.not_found'` from ERROR_CODES
- `packages/i18n/src/locales/es/errors.ts`: removed `recurring.not_found` translation
- `packages/i18n/src/locales/en/errors.ts`: removed `recurring.not_found` translation
- `packages/i18n/src/locales/es/api.ts`: removed `reminders.dueToday` key (used only by deleted RecurringReminderService)
- `packages/i18n/src/locales/en/api.ts`: removed `reminders.dueToday` key

**Commit**: `f1da26d` — feat(i18n): remove recurring error code and reminder strings (S2)

---

### S2-T5 — Web: remove recurring-expense screens/components

**Status**: [x] Done (no action required)

The web app had zero recurring-expense UI (verified by grep). No files to delete or redirect.

---

### S2-T6 — Executor cleanup: verify no dead tool references remain

**Status**: [x] Done

`pnpm typecheck` passes clean (0 errors). No dead recurring references remain in agent/executor code.

---

### S2-T7 — Root CI gate

**Status**: [x] Done

| Gate                                         | Result                                   |
| -------------------------------------------- | ---------------------------------------- |
| `pnpm install --frozen-lockfile`             | PASS                                     |
| `pnpm --filter "./packages/**" run build`    | PASS                                     |
| `pnpm lint`                                  | PASS (0 errors, 4 pre-existing warnings) |
| `pnpm typecheck`                             | PASS (all 6 packages)                    |
| `pnpm --filter @app/web exec tsc -b --force` | PASS (0 errors)                          |
| `pnpm build`                                 | PASS                                     |
| `pnpm test`                                  | PASS — 357 tests, 26 suites              |

Note: Test count dropped from 359 to 357 — the 2 deleted RecurringService unit tests (deactivate tests) are accounted for.

---

## S2 Complete Summary

| Task                                         | Status           |
| -------------------------------------------- | ---------------- |
| S2-T1 Migration UnifyRecurringIntoFixedBoxes | [x] Done         |
| S2-T2 Remove recurring module                | [x] Done         |
| S2-T3 Remap/remove agent tools               | [x] Done         |
| S2-T4 i18n cleanup                           | [x] Done         |
| S2-T5 Web cleanup                            | [x] Done (no-op) |
| S2-T6 Executor cleanup verify                | [x] Done         |
| S2-T7 Root CI gate                           | [x] Done         |

---

## Batch: 3 — Slice 4 (AI Onboarding)

**Date**: 2026-06-15
**Branch**: feat/ai-onboarding
**Mode**: Strict TDD (for S4-T2, S4-T3, S4-T4)
**Slice**: S4 — AI-driven onboarding (web + WhatsApp)

---

## Completed Tasks

### S4-T1 — Migration: add onboardingCompleted column

**Status**: [x] Done

- Migration file: `apps/api/src/database/migrations/1781600000000-UserOnboardingCompleted.ts`
- SQL up: `ALTER TABLE "users" ADD "onboardingCompleted" boolean NOT NULL DEFAULT false`
- SQL down: `ALTER TABLE "users" DROP COLUMN "onboardingCompleted"`
- Column added to `apps/api/src/users/user.entity.ts` (distinct from `onboardedAt`)
- Commit: `d6c9b00` — feat(users): add onboardingCompleted boolean to User entity and hand-written migration

### S4-T2 — Guard ensureDefaultBoxes for new accounts

**Status**: [x] Done

- `apps/api/src/admin/admin.service.ts`: removed call to `ensureDefaultBoxes` in `updateStatus` when approving to ACTIVE
- New accounts start with zero boxes; AI onboarding creates them conversationally
- Existing users unaffected: their boxes are already in DB; `ensureDefaultBoxes` was already a no-op for them
- `ensureDefaultBoxes` method preserved for back-fill needs
- Commit: `1b242ac` — feat(admin): stop auto-seeding boxes on account approval (S4 onboarding takes over)

### S4-T3 — Onboarding state-machine unit tests (TDD RED first)

**Status**: [x] Done

- `apps/api/src/onboarding/onboarding.service.spec.ts` (new)
- Tests cover: `isOnboarding` returns true/false, `confirmOnboarding` idempotent, auto-seed guard scenarios
- Written BEFORE implementation (RED state confirmed)

### S4-T4 — Implement OnboardingService

**Status**: [x] Done

- `apps/api/src/onboarding/onboarding.service.ts` (new): `isOnboarding(userId)`, `confirmOnboarding(userId)`
- `apps/api/src/onboarding/onboarding.module.ts` (new): exports OnboardingService
- `apps/api/src/onboarding/onboarding.controller.ts` (new): `POST /me/onboarding/ai-complete`
- All 8 spec tests GREEN
- Commit: `48352cf` — feat(onboarding): add OnboardingService with isOnboarding/confirmOnboarding (TDD)

### S4-T5 — Thread onboarding context flag through agent.run

**Status**: [x] Done

- `apps/api/src/agent/agent.service.ts`: added `isOnboardingMode` param to `run()` (default false); added `resolveOnboardingMode(userId)` helper; injected `OnboardingService`
- `apps/api/src/agent/agent.module.ts`: imports `OnboardingModule`
- `apps/api/src/agent/agent-tools.ts`: `OnboardingService` added to `AgentToolsContext` (optional for backward compat); `confirmOnboarding` tool added
- `apps/api/src/chat/chat.controller.ts`: calls `resolveOnboardingMode` before `agent.run`, passes `isOnboardingMode`
- `apps/api/src/whatsapp/whatsapp.service.ts`: same pattern in `resolveReply`
- `apps/api/src/agent/agent.service.spec.ts` + `apps/api/src/chat/chat.controller.spec.ts`: updated mocks for new signature
- Commit: `968b02c` — feat(agent): add onboarding mode flag and confirmOnboarding tool

### S4-T6 — Onboarding system-prompt variant

**Status**: [x] Done

- `apps/api/src/agent/prompts/onboarding.prompt.ts` (new): `buildOnboardingPrompt(locale, currency, userName)`
- Covers both `es` and `en` locales
- Guides: income → fixed bills (createBox mode=fixed) → savings goals (createBox type=fund) → percent categories → validate 100% → call confirmOnboarding
- Persuasive, conversational tone; validates percent sum before allowing completion
- Selected in `agent.service.ts` when `isOnboardingMode = true`
- Same tools and guardrails as standard mode (ADR-5)

### S4-T7 — WhatsApp proactive starter on phone verification

**Status**: [x] Done

- `apps/api/src/users/phone-verification.service.ts`: added `sendOnboardingStarterIfNeeded()` called after `verify()` completes; re-reads `onboardingCompleted` from DB for idempotency
- `packages/i18n/src/locales/es/api.ts`: added `whatsapp.onboardingStarter` key (persuasive ES copy)
- `packages/i18n/src/locales/en/api.ts`: matching EN key (satisfies typeof es constraint)
- `apps/api/src/whatsapp/whatsapp.service.ts`: `resolveReply` now passes `isOnboardingMode` to `agent.run`
- WhatsApp Evolution client is NOT called in tests (existing `evolution: { sendText: jest.fn() }` mock in phone-verification.service.spec.ts prevents real sends)
- Commit: `29c6253` — feat(whatsapp): send proactive onboarding starter on phone verification

### S4-T8 — Web onboarding flow

**Status**: [x] Done

- `packages/contracts/src/auth.ts`: added `onboardingCompleted: z.boolean()` to `authUserSchema`
- `apps/api/src/auth/auth.controller.ts`: `toAuthUser` now includes `onboardingCompleted`
- `apps/web/src/pages/onboarding.tsx`: `finish()` now navigates to `/chat` instead of `/` (so AI onboarding starts in chat)
- `apps/web/src/features/auth/hooks/useOnboardingGuard.ts` (new): polls `/me` every 3s; returns `{ isOnboarding, isLoading }`
- `apps/web/src/pages/chat.tsx`: imports `useOnboardingGuard`; shows `OnboardingBanner` when `isOnboarding = true`; navigates to `/` when flag flips to false (onboarding complete)
- `packages/i18n/src/locales/es/chat.ts` + `en/chat.ts`: added `onboardingBanner` key
- Commit: `8f3b434` — feat(web): add onboarding guard hook and banner; route to /chat after phone step

---

## ROOT Gate Results (S4)

| Gate                                         | Result                                 |
| -------------------------------------------- | -------------------------------------- |
| `pnpm install --frozen-lockfile`             | PASS                                   |
| `pnpm --filter "./packages/**" run build`    | PASS                                   |
| `pnpm lint`                                  | PASS (0 errors, pre-existing warnings) |
| `pnpm typecheck`                             | PASS (all 6 packages)                  |
| `pnpm --filter @app/web exec tsc -b --force` | PASS                                   |
| `pnpm build`                                 | PASS                                   |
| `pnpm --filter @app/api run test`            | PASS — 368 tests, 28 suites            |

No real WhatsApp sends in tests: `EvolutionClient.sendText` is mocked in `phone-verification.service.spec.ts` (`evolution = { sendText: jest.fn() }`).

---

## TDD Cycle Evidence (S4)

| Task                    | RED                                                  | GREEN                                   | REFACTOR         |
| ----------------------- | ---------------------------------------------------- | --------------------------------------- | ---------------- |
| S4-T3 (onboarding spec) | TS error: OnboardingService not found                | 8 tests pass after S4-T4 implementation | Idempotent guard |
| S4-T2 (auto-seed guard) | Test for "new user → no boxes created" written first | Guard confirmed by removing the call    | —                |

---

## Slice 4 Summary

| Task                                   | Status                           |
| -------------------------------------- | -------------------------------- |
| S4-T1 Migration onboardingCompleted    | [x] Done                         |
| S4-T2 ensureDefaultBoxes guard         | [x] Done                         |
| S4-T3 Onboarding state-machine tests   | [x] Done                         |
| S4-T4 OnboardingService implementation | [x] Done                         |
| S4-T5 Context flag in agent.run        | [x] Done                         |
| S4-T6 Onboarding prompt variant        | [x] Done                         |
| S4-T7 WhatsApp proactive starter       | [x] Done                         |
| S4-T8 Web onboarding flow              | [x] Done                         |
| S4-T9 Root CI gate                     | [x] Done (all gates green above) |

---

## Integration (S2 + S3 + S4)

**Date**: 2026-06-15
**Branch**: feat/boxes-v2-epic (single PR combining S2, S3, S4)
**Merged in order**: S3 (remove-transit) -> S2 (recurring-into-fixed-boxes) -> S4 (ai-onboarding), each with `--no-ff`.

### Conflicts resolved

- `apps/api/src/agent/agent-tools.ts`, `agent.service.ts`, `agent.module.ts`, `agent.service.spec.ts`, `packages/i18n/src/locales/{en,es}/api.ts` — auto-merged by git; manually audited to confirm the UNION of intent: transit text removed (S3), `recurring` dropped from `AgentToolsContext` + RecurringService removed from constructors and `listRecurringExpenses` remapped to fixed boxes (S2), optional `onboarding` added to context + `confirmOnboarding` tool + OnboardingService injected + `resolveOnboardingMode` (S4).
- `openspec/changes/boxes-v2-onboarding/apply-progress.md` — content conflict on each merge; resolved by keeping ALL slice batch records (S3 + S2 + S4 sections preserved).
- No conflicts in `app.module.ts`, `whatsapp.module.ts`, `whatsapp.service.ts`, or the i18n transactions/chat/errors locales — git auto-merged cleanly; verified RecurringModule/RecurringReminderService removed, OnboardingModule added, S4 onboarding trigger and S2 reminder removal both present, and en/es locales in sync (no transit, no reminder, onboarding keys present).

### Combined migration run (dev DB, port 55432) — applied in timestamp order

1. `1781510000000-RemoveTransitType` (S3) — **executed** (after fix, see below)
2. `1781600000000-UnifyRecurringIntoFixedBoxes` (S2) — **executed** (recurring rows -> fixed boxes, table dropped)
3. `1781700000000-UserOnboardingCompleted` (S4) — **executed** (column added)

Post-migration DB verified: `transactions_type_enum` is now `{income, expense}` (no transit), no rows of type 'transit' remain, `recurring_expenses` table dropped, `users.onboardingCompleted` column present.

### Combined-state bug found and fixed

**S3 RemoveTransitType migration was broken against a DB containing a real transit row.** The verify-zero gate only checked `deletedAt IS NULL`, but step 1 voided transit rows (set status='voided' + deletedAt) WITHOUT changing their `type` column. The irreversible enum-narrow cast (`USING type::text::new_enum`) runs over EVERY row — including the just-voided ones still carrying `type='transit'` — so it failed with `invalid input value for enum transactions_type_enum: "transit"`. Fix: step 1 now also reassigns ALL transit rows to `type='expense'` (an inert placeholder for voided, balance-excluded rows, consistent with the S3 web UI fallback), and the verify-zero gate now asserts zero rows of type 'transit' regardless of `deletedAt`. The migration then applies cleanly.

### Combined gates (ROOT, like CI)

| Gate                                         | Result                                   |
| -------------------------------------------- | ---------------------------------------- |
| `pnpm install --frozen-lockfile`             | PASS                                     |
| `pnpm --filter "./packages/**" run build`    | PASS                                     |
| `pnpm lint`                                  | PASS (0 errors, warnings only)           |
| `pnpm typecheck` (ROOT)                      | PASS (all 6 packages)                    |
| `pnpm --filter @app/web exec tsc -b --force` | PASS (0 errors)                          |
| `pnpm build`                                 | PASS (api + web + mcp-server + packages) |
| `pnpm test` (ROOT)                           | PASS — 374 tests, 27 suites              |

Combined test count (374) is the coherent union of the slices (S3 367, S2 357, S4 368): onboarding tests added, recurring tests removed, transit-rejection tests added. No combined-state test breakage.
