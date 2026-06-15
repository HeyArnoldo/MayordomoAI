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
