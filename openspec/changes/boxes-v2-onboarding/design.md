# Design: Boxes v2 + AI-Driven Onboarding

## Technical Approach

Four ordered slices (1 → 2 → 3 ⫽ 4). Each is an independent PR with its own
generated migration (TypeORM, NEVER `synchronize`). Build order inside every
slice: `packages/contracts` + `packages/i18n` first, then `apps/api`, then
`apps/web`/`mcp-server`. Pure money logic stays in `apps/api/src/common/money.ts`
(IO-free, TDD-first). Existing patterns reused verbatim: `AppException` + stable
codes in `@app/contracts` `error-codes.ts`, `audited()` agent-tool wrapper,
`withBalances` SUM-on-read truth, largest-remainder cents math (`computeSplit`).

## Architecture Decisions

| #   | Decision                     | Choice                                                                                                                 | Rejected alternative            | Rationale                                                                                                                                                     |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Funding math location        | **Service layer** compute in `withBalances` (4 SUM queries unchanged; remainder/allocation derived in TS via money.ts) | Push remainder math into SQL    | Income for remainder is per-period; cents largest-remainder is already pure TS and unit-tested. SQL rewrite risks float drift and is untestable in isolation. |
| 2   | Recurring fill-day           | **Drop reminders this epic**; migrate amount+name+box only, no `fillDay` on box                                        | Add `boxes.fillDay` + keep cron | Proposal unifies concepts; reminder cron (`recurring-reminder.service`) is out of scope and adds surface. Revisit later. Documented as known regression.      |
| 3   | Legacy transit rows          | **Void** (`status=voided`, set `deletedAt`) BEFORE enum narrow                                                         | Convert to expense-with-box     | Void preserves inert semantics, zero balance impact; convert rewrites history.                                                                                |
| 4   | Onboarding state             | **New `users.onboardingCompleted` bool**, distinct from existing `onboardedAt`                                         | Reuse `onboardedAt`             | `onboardedAt` = phone-link step (already shipped). AI-budget onboarding is orthogonal and must be independently resumable/idempotent.                         |
| 5   | Onboarding agent mode        | **System-prompt variant** selected by an `onboarding` context flag threaded through `agent.run`                        | Separate agent/runtime          | Reuse same tools + guardrails; only the prompt changes.                                                                                                       |
| 6   | Modes scope                  | **Personal only**                                                                                                      | Business modes                  | Matches proposal non-goal; invariant validators filter `scope=personal`.                                                                                      |
| 7   | `listRecurringExpenses` tool | **Remap to list fixed boxes**; remove `add`/`remove`                                                                   | Keep all 3                      | createBox/updateBox cover writes; keep `list` so MCP/Foundry callers degrade gracefully.                                                                      |

## Funding Math (exact definition)

Replaces the current `allocated = pct × period-income` derivation in
`BoxesService.withBalances`. The 4 SUM queries stay; `allocM`/`spentM`/`allocA`/`spentA`
remain the source of truth for actual money moved. New layer derives the
**target allocation** per active personal box from monthly income:

```
income       = Σ confirmed income for the accounting month (existing allocMonth roll-up,
               or SUM of split amounts — already available per box; total = Σ over boxes)
fixedBoxes   = active personal boxes where mode = 'fixed'
pctBoxes     = active personal boxes where mode = 'percent'
fixedTotal   = Σ fixedAmount(fixedBoxes)                      // cents
remainder    = max(0, toCents(income) - fixedTotal)           // cents, never negative
```

Per box (all arithmetic in cents via toCents/fromCents):

- **fixed box**: `allocated = fixedAmount`; `remainingToFill = max(0, fixedAmount - actuallyFunded)`
  where `actuallyFunded` = the SUM already credited to it this period.
- **percent box**: `allocated` = largest-remainder split of `remainder` by `pct`
  (reuse the `computeSplit` algorithm so Σ percent-allocations == remainder exactly).
- `spent`, `balance = allocated - spent`, fund `accumulated` unchanged.
- `BoxBalance` gains `remainingToFill: number | null` (null for percent boxes).

Guard `box.fixed_exceeds_income`: raised when `fixedTotal > toCents(income)` is
detected on allocation/box mutation (not on read — read clamps remainder to 0).

## Invariants

`isValidPctSum` now validated only over active personal **percent** boxes (must
sum 100.00). Fixed boxes excluded; each requires `fixedAmount > 0`. Changes:

- `money.ts`: keep `isValidPctSum`; add `sumFixedCents(boxes)` helper (pure).
- `updateAllocation`: filter percent boxes for the sum check; reject fixed-mode ids in `items`.
- New error codes (add to `error-codes.ts` + both i18n locales): `box.fixed_requires_amount`, `box.fixed_exceeds_income`. Keep `box.allocation_must_sum_100`.

## File Changes

| File                                                                        | Action | Slice   | Description                                                                                                                                             |
| --------------------------------------------------------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/boxes.ts`                                           | Modify | 1       | Add `BoxMode` enum; `mode`+`fixedAmount` on create/update/box/boxBalance schemas (discriminated: fixed→amount>0, percent→pct); add `remainingToFill`.   |
| `packages/contracts/src/error-codes.ts`                                     | Modify | 1,3     | Add `box.fixed_requires_amount`, `box.fixed_exceeds_income`.                                                                                            |
| `packages/i18n/src/locales/{es,en}/*`                                       | Modify | 1,2,3,4 | New error strings; onboarding/WhatsApp starter copy; remove recurring strings.                                                                          |
| `apps/api/src/boxes/box.entity.ts`                                          | Modify | 1       | `mode` enum (default percent) + `fixedAmount numeric(12,2) null`.                                                                                       |
| `apps/api/src/common/money.ts`                                              | Modify | 1       | `sumFixedCents`; remainder/percent allocation helper (pure).                                                                                            |
| `apps/api/src/boxes/boxes.service.ts`                                       | Modify | 1       | Rework `withBalances` (fixed off-the-top); `updateAllocation` invariant; create/update accept mode+fixedAmount; mode-switch re-check.                   |
| `apps/api/src/database/migrations/*-BoxModeFixedAmount.ts`                  | Create | 1       | `ALTER TYPE`/add `boxes_mode_enum`; add columns; existing rows → percent.                                                                               |
| `apps/api/src/database/migrations/*-RecurringToFixedBoxes.ts`               | Create | 2       | Data move recurring→fixed boxes, then drop table + enum.                                                                                                |
| `apps/api/src/recurring/**`, `recurring-reminder.service.ts`, module wiring | Delete | 2       | Remove module/entity/service/cron; detach from agent + whatsapp modules.                                                                                |
| `apps/api/src/agent/agent-tools.ts` + `agent-tool-executor.service.ts`      | Modify | 2,4     | Remove `add/removeRecurringExpense`; remap `listRecurringExpenses`→fixed boxes; createBox/updateBox accept mode+fixedAmount; drop `recurring` from ctx. |
| `apps/api/src/agent/agent.service.ts`                                       | Modify | 4       | `onboarding` flag → prompt variant; drop recurring dep.                                                                                                 |
| `packages/contracts/src/transactions.ts`                                    | Modify | 3       | Remove `TRANSIT` from `TransactionType`.                                                                                                                |
| `apps/api/src/database/migrations/*-RemoveTransit.ts`                       | Create | 3       | Void transit rows; verify-zero; rename+create+`ALTER ... USING`+drop enum.                                                                              |
| `apps/mcp-server/src/tools/*`, `apps/web/**` selectors                      | Modify | 3       | Drop transit from type unions/UI.                                                                                                                       |
| `apps/api/src/admin/admin.service.ts`                                       | Modify | 4       | Guard/remove `ensureDefaultBoxes` for NEW accounts (keep idempotent no-op for existing).                                                                |
| `apps/api/src/database/migrations/*-UserOnboardingCompleted.ts`             | Create | 4       | `users.onboardingCompleted bool default false`.                                                                                                         |
| `apps/api/src/users/phone-verification.service.ts`                          | Modify | 4       | On verify (confirmation) → send WhatsApp starter + flag pending.                                                                                        |
| `apps/web/src/pages/onboarding.tsx` + chat page                             | Modify | 4       | After phone step, route into AI chat in onboarding mode; finish sets flag.                                                                              |

## Data Flow — funding (read)

    GET /boxes/balances → withBalances
      ├─ 4 SUM queries (actual money) ── unchanged truth
      └─ derive targets: income → fixedTotal → remainder → computeSplit(remainder, pctBoxes)
                                                   └─ per box: allocated, remainingToFill

## Data Flow — onboarding

    Web:  approve(no seed) → phone verify → chat[onboarding mode] → tools create boxes → flag set
    WA:   phone verify (confirmation) → evolution.sendText(starter) → agent[onboarding mode] in-chat → flag set

## Testing Strategy (TDD-first)

| Layer       | What                                                                                                            | Approach                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Unit        | `sumFixedCents`, remainder+percent allocation, `isValidPctSum` (percent-only), `box.fixed_exceeds_income` guard | money.spec.ts — write tests first             |
| Unit        | recurring→fixed transform; transit void+verify-zero precondition                                                | migration-logic helpers extracted as pure fns |
| Unit        | onboarding state transitions (pending→completed, idempotent, resumable)                                         | users service spec                            |
| Integration | `withBalances` mixed fixed+percent fixtures; `updateAllocation` rejects fixed ids                               | boxes.service.spec.ts                         |
| Integration | agent tools: createBox(mode=fixed), remapped list, removed tools 404                                            | agent-tools.spec.ts                           |

## Migration / Rollout

Generated, never synchronized. Order strict. Slice 3 enum narrow is irreversible
→ snapshot DB pre-migration; `down()` documents the limitation (recreate 3-value
enum, cannot restore voided rows' original type). Slices 1/2/4 have real `down()`.
ROOT gates per slice: `pnpm -w typecheck`, `pnpm -w test`, `pnpm -w lint`.

## Open Questions

- [ ] Confirm `income` source for remainder = month income SUM (vs last single income event). Assumed: accounting-month income SUM.
- [ ] WhatsApp starter requires a verified number; users who SKIP phone get web-only onboarding. Accepted.
