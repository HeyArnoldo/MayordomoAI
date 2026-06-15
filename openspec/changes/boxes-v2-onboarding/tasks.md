# Tasks: boxes-v2-onboarding

Generated: 2026-06-15
Delivery strategy: ask-on-risk (one PR per slice, 4 PRs total)
Chain strategy: stacked-to-main
TDD mode: STRICT (pnpm --filter @app/api run test)

---

## Dependency Graph

```
Slice 1 (Box model v2)
    ├── Slice 2 (Unify recurring→fixed)   [depends on S1]
    ├── Slice 4 (AI onboarding)           [depends on S1]
    └── (no dependency on Slice 3)
Slice 3 (Remove transit)                  [independent — can land any order]
```

Recommended merge order: S1 → S3 → S2 → S4  
(S3 is independent; land it early to reduce diff noise in S2.)

---

## Slice 1 — Box model v2

> PR boundary: all tasks below ship as a single PR. Target branch: `main`.

### Decision task (MUST resolve first — blocks all other S1 tasks)

- [x] **S1-D1** Confirm income source for remainder computation  
       **Spec req**: funding math `remainder = income − Σ fixedAmount`; income source is ambiguous.  
       **Action**: Read `withBalances` service to identify the income value already used for allocation today. Define whether it is (a) the accounting-month income SUM or (b) the latest income event. Record the decision as a comment in `money.ts` / `computeSplit`. This task produces no code change — only the decision.  
       **Files**: `apps/api/src/boxes/boxes.service.ts` (or wherever `withBalances` is implemented), `apps/api/src/money/money.ts`  
       **TDD**: no (design decision only)  
       **Parallel**: yes — can run alongside S1-T1

---

### S1 — API layer

- [x] **S1-T1** Add `BoxMode` enum and extend box entity/DTO contracts  
       **Spec req**: boxes spec §mode (percent | fixed), fixedAmount optional.  
       **Files**:
  - `apps/api/src/boxes/box.entity.ts` — add `mode: BoxMode`, `fixedAmount: number | null`
  - `apps/api/src/boxes/dto/create-box.dto.ts` — add mode + fixedAmount fields, Zod/class-validator rules
  - `apps/api/src/boxes/dto/update-box.dto.ts` — same
  - `packages/shared/src/contracts/box.contracts.ts` (if shared types exist) — export `BoxMode`  
    **TDD**: no (entity/DTO shape, no business logic)  
    **Parallel**: can start immediately, blocked only by S1-D1 decision on field semantics

- [x] **S1-T2** Add `box.fixed_exceeds_income` error code + i18n  
       **Spec req**: boxes spec §error-codes; constraint lesson: both `en/errors.ts` and `es/errors.ts` required or TS1360 fires.  
       **Files**:
  - `packages/i18n/src/en/errors.ts`
  - `packages/i18n/src/es/errors.ts`
  - `apps/api/src/boxes/boxes.errors.ts` (or equivalent error catalog)  
    **TDD**: no (strings only)  
    **Parallel**: yes — can run in parallel with S1-T1

- [x] **S1-T3** Write pure funding-math unit tests (TDD — write tests first)  
       **Spec req**: boxes spec §funding-math; design §computeSplit, §remainingToFill.  
       **Tests cover**:
  - `computeSplit(income, boxes)` → correct fixed allocation, remainder, percent splits
  - Fixed box where fixedAmount > income → throws `box.fixed_exceeds_income`
  - `remainingToFill(box, balance)` → correct fill amount
  - `isValidPctSum(boxes)` → true only when all percent-mode boxes sum to 100 and no fixed boxes mixed (per spec)  
    **Files**:
  - `apps/api/src/money/money.spec.ts` (new or extended)  
    **TDD**: YES — write before S1-T4  
    **Parallel**: can write in parallel with S1-T1 and S1-T2; must complete before S1-T4  
    **Depends on**: S1-D1 decision is captured in test constants

- [x] **S1-T4** Implement `computeSplit`, `remainingToFill`, `isValidPctSum` in money.ts  
       **Spec req**: boxes spec §funding-math.  
       **Files**:
  - `apps/api/src/money/money.ts`  
    **TDD**: YES — implement to make S1-T3 tests pass  
    **Depends on**: S1-T3 (tests must exist first)

- [x] **S1-T5** Generate migration: add `mode` (enum) and `fixed_amount` columns to `boxes` table  
       **Spec req**: boxes spec §persistence; constraint: `pnpm migration:generate` on port 55432, NOT sync.  
       **Action**:
  1. Run `pnpm migration:generate` after S1-T1 entity change
  2. Verify migration SQL: add `mode VARCHAR` column with default `'percent'`, `fixed_amount DECIMAL NULL`
  3. Add `NOT NULL DEFAULT 'percent'` constraint on mode so existing rows get percent mode  
     **Files**:
  - `apps/api/src/migrations/YYYYMMDD_AddBoxModeAndFixedAmount.ts` (generated)  
    **TDD**: no (migration DDL)  
    **Depends on**: S1-T1  
    **Parallel**: no — must run after entity is defined

- [x] **S1-T6** Rework `withBalances` to use `computeSplit` for allocation  
       **Spec req**: boxes spec §withBalances rework; design §funding-math.  
       **Action**: Replace ad-hoc percentage math in `withBalances` with call to `computeSplit`. Use the same income source confirmed in S1-D1.  
       **Files**:
  - `apps/api/src/boxes/boxes.service.ts`  
    **TDD**: write integration tests for `withBalances` covering fixed + percent mix scenarios  
    **Depends on**: S1-T4 (computeSplit), S1-D1 (income source confirmed)

- [x] **S1-T7** Update `createBox` and `updateBox` service methods to accept mode + fixedAmount  
       **Spec req**: boxes spec §mutations.  
       **Action**: Guard fixed mode: if mode=fixed and fixedAmount > income → throw `box.fixed_exceeds_income`. Validate `isValidPctSum` on save when any box changes.  
       **Files**:
  - `apps/api/src/boxes/boxes.service.ts`
  - `apps/api/src/boxes/boxes.controller.ts`  
    **TDD**: YES — unit tests for the guard and validation  
    **Depends on**: S1-T4, S1-T2

- [x] **S1-T8** Update `updateAllocation` executor tool + MCP tool to accept mode + fixedAmount  
       **Spec req**: boxes spec §agent-tools.  
       **Files**:
  - `apps/api/src/agent/tools/update-allocation.tool.ts` (or executor equivalent)
  - `apps/api/src/mcp/tools/update-allocation.mcp.ts` (if separate)  
    **TDD**: no (executor/tool wiring, not pure logic)  
    **Depends on**: S1-T7

---

### S1 — Web layer

- [x] **S1-T9** Web box editor: add mode toggle (percent / fixed) + fixedAmount input  
       **Spec req**: boxes spec §web-ui.  
       **Action**: Toggle shows fixedAmount numeric field when mode=fixed; hides it for percent. Disable fixedAmount field when mode=percent. Pass mode+fixedAmount to create/update API calls.  
       **Files**:
  - `apps/web/src/features/boxes/components/BoxEditor.tsx` (or equivalent)
  - `apps/web/src/features/boxes/hooks/useBoxForm.ts`  
    **TDD**: no (UI component)  
    **Depends on**: S1-T1 (contracts), S1-T7 (API accepts fields)  
    **Parallel**: can build UI in parallel with backend integration once contracts are defined

---

### S1 — Root gates

- [ ] **S1-T10** Run root CI gate before PR  
       **Action**: `pnpm install --frozen-lockfile && pnpm --filter "./packages/**" run build && pnpm lint && pnpm typecheck && pnpm build && pnpm test`  
       **Gate**: All must pass. Pay special attention to `pnpm typecheck` (catches i18n TS1360 errors).  
       **Depends on**: all S1 tasks complete

**S1 task count**: 11 (1 decision + 10 implementation)

---

## Slice 2 — Unify recurring→fixed boxes

> PR boundary: all tasks below ship as a single PR.  
> Depends on: Slice 1 merged to main.  
> Target branch: `main`.

- [x] **S2-T1** Data migration: convert `recurring_expenses` rows to fixed-mode boxes  
       **Spec req**: recurring-expenses spec §migration; design ADR-2 (drop reminders/dayOfMonth).  
       **Action**:
  1. Generate migration that reads all `recurring_expenses` rows
  2. Inserts corresponding `boxes` rows with `mode='fixed'`, `fixedAmount=amount`, name from recurring expense
  3. Does NOT copy `dayOfMonth` or reminder fields (dropped per ADR-2)
  4. Drops `recurring_expenses` table at end  
     **Files**:
  - `apps/api/src/migrations/YYYYMMDD_MigrateRecurringToFixedBoxes.ts` (generated + hand-edited)  
    **TDD**: write a migration-transform unit test covering the mapping logic before writing the SQL  
    **Parallel**: no — must be first S2 task

- [x] **S2-T2** Remove recurring module, entity, and table references from API  
       **Spec req**: recurring-expenses spec §removal.  
       **Action**: Delete or strip `RecurringExpense` entity, module, service, controller, repository. Remove from `AppModule` imports.  
       **Files**:
  - `apps/api/src/recurring-expenses/` (delete entire directory)
  - `apps/api/src/app.module.ts`  
    **TDD**: no (deletion task; verify by running typecheck)  
    **Depends on**: S2-T1

- [x] **S2-T3** Remove/remap the 3 recurring-expense agent tools  
       **Spec req**: recurring-expenses spec §agent-tools (3 tools: list, create, delete recurring expenses).  
       **Action**: Delete tool files. Update executor's tool registry. If any tool is referenced in onboarding prompts, remove those references.  
       **Files**:
  - `apps/api/src/agent/tools/recurring-*.tool.ts` (delete)
  - `apps/api/src/agent/executor.ts` (remove from tool registry)
  - `apps/api/src/mcp/tools/recurring-*.mcp.ts` (delete if separate)  
    **TDD**: no  
    **Depends on**: S2-T2

- [x] **S2-T4** Update i18n: remove recurring-expense keys, add any new fixed-box keys if needed  
       **Spec req**: recurring-expenses spec §i18n.  
       **Files**:
  - `packages/i18n/src/en/*.ts`
  - `packages/i18n/src/es/*.ts`  
    **TDD**: no  
    **Parallel**: can run alongside S2-T2 and S2-T3

- [x] **S2-T5** Web: remove recurring-expense screens/components  
       **Spec req**: recurring-expenses spec §web-removal.  
       **Action**: Delete recurring expense list/create/edit UI. Remove nav links.  
       **Files**:
  - `apps/web/src/features/recurring-expenses/` (delete or gut)
  - `apps/web/src/components/nav/` (remove recurring expense link)  
    **TDD**: no  
    **Parallel**: can run alongside S2-T2 through S2-T4

- [x] **S2-T6** Executor cleanup: verify no dead tool references remain  
       **Action**: `pnpm typecheck` + manual grep for `recurring` in agent/executor code.  
       **TDD**: no  
       **Depends on**: S2-T3

- [x] **S2-T7** Run root CI gate before PR  
       **Action**: same gate as S1-T10  
       **Depends on**: all S2 tasks complete

**S2 task count**: 7

---

## Slice 3 — Remove transit

> PR boundary: all tasks below ship as a single PR.  
> Independent of S1, S2, S4 — can land any time.  
> Recommended: land after S1 to reduce i18n churn, but not required.

- [ ] **S3-T1** Void all transit transaction rows in a migration  
       **Spec req**: transactions spec §transit-removal.  
       **Action**:
  1. Generate + write migration that sets `type = 'expense'` (or flags as voided) for all rows with `type = 'transit'`
  2. Add verify-zero gate: the migration must assert zero transit rows remain before altering the enum  
     **Files**:
  - `apps/api/src/migrations/YYYYMMDD_VoidTransitRows.ts`  
    **TDD**: write invariant validator test: `assertNoTransitRows(rows)` throws if any transit row exists  
    **Parallel**: no — must complete before S3-T2

- [ ] **S3-T2** Narrow the transaction type enum (rename+create+alter+drop dance)  
       **Spec req**: transactions spec §enum-narrowing; constraint: must use rename+create+alter+drop sequence, not simple ALTER TYPE.  
       **Action**:
  1. Rename old enum `transaction_type` → `transaction_type_old`
  2. Create new enum `transaction_type` without `transit` value
  3. ALTER TABLE to use new enum (cast with USING clause)
  4. DROP old enum  
     **Files**:
  - `apps/api/src/migrations/YYYYMMDD_NarrowTransactionTypeEnum.ts`
  - `apps/api/src/transactions/transaction.entity.ts` — update TypeScript enum  
    **TDD**: no (DDL migration)  
    **Depends on**: S3-T1

- [ ] **S3-T3** Update contracts enum: remove transit from TypeScript union/enum  
       **Spec req**: transactions spec §contracts.  
       **Files**:
  - `packages/shared/src/contracts/transaction.contracts.ts`
  - `apps/api/src/transactions/dto/*.ts`  
    **TDD**: no — typecheck will catch remaining usages  
    **Depends on**: S3-T2

- [ ] **S3-T4** Remove transit from all agent tools, MCP tools, and executor  
       **Spec req**: transactions spec §agent-cleanup.  
       **Action**: Remove any `transit` from tool input schemas, output formatters, executor routing.  
       **Files**:
  - `apps/api/src/agent/tools/*.tool.ts` (grep for transit)
  - `apps/api/src/mcp/tools/*.ts`
  - `apps/api/src/agent/executor.ts`  
    **TDD**: no  
    **Depends on**: S3-T3

- [ ] **S3-T5** Remove transit from i18n catalogs  
       **Spec req**: transactions spec §i18n.  
       **Files**:
  - `packages/i18n/src/en/*.ts`
  - `packages/i18n/src/es/*.ts`  
    **TDD**: no  
    **Parallel**: can run alongside S3-T4

- [ ] **S3-T6** Web: remove transit from transaction-row display and transaction-detail selectors  
       **Spec req**: transactions spec §web-cleanup.  
       **Files**:
  - `apps/web/src/features/transactions/components/TransactionRow.tsx`
  - `apps/web/src/features/transactions/components/TransactionDetail.tsx`
  - Any type filter/selector components that list transaction types  
    **TDD**: no  
    **Parallel**: can run alongside S3-T4 and S3-T5

- [ ] **S3-T7** Run root CI gate before PR  
       **Action**: same gate as S1-T10  
       **Depends on**: all S3 tasks complete

**S3 task count**: 7

---

## Slice 4 — AI onboarding

> PR boundary: all tasks below ship as a single PR.  
> Depends on: Slice 1 merged (needs `boxes.mode` model to exist before onboarding can create fixed boxes).  
> Independent of S2 and S3.

- [ ] **S4-T1** Migration: add `onboarding_completed` boolean column to `users` table  
       **Spec req**: ai-onboarding spec §persistence.  
       **Action**: `pnpm migration:generate` after adding field to User entity. Default = false for existing users.  
       **Files**:
  - `apps/api/src/users/user.entity.ts` — add `onboardingCompleted: boolean`
  - `apps/api/src/migrations/YYYYMMDD_AddUserOnboardingCompleted.ts`  
    **TDD**: no (DDL)

- [ ] **S4-T2** Guard `ensureDefaultBoxes` for new accounts: skip if onboarding flag will be set  
       **Spec req**: ai-onboarding spec §auto-seed removal; design §stop-auto-seed.  
       **Action**: Wrap `ensureDefaultBoxes` call in a guard: if `onboardingCompleted = false` AND new account, do NOT auto-create default boxes — onboarding will create them instead.  
       **Files**:
  - `apps/api/src/boxes/boxes.service.ts` (or wherever ensureDefaultBoxes is called)
  - `apps/api/src/users/users.service.ts`  
    **TDD**: YES — unit test: new user → `ensureDefaultBoxes` NOT called; existing user (migrated) → NOT affected  
    **Depends on**: S4-T1

- [ ] **S4-T3** Onboarding state-machine unit tests (TDD — write first)  
       **Spec req**: ai-onboarding spec §state-machine; resumable/idempotent requirement.  
       **Tests cover**:
  - New user → `onboardingCompleted = false` → onboarding variant active
  - `confirmOnboarding(userId)` → sets `onboardingCompleted = true`, idempotent on repeat calls
  - Existing user (`onboardingCompleted = true`) → standard prompt variant  
    **Files**:
  - `apps/api/src/onboarding/onboarding.service.spec.ts` (new)  
    **TDD**: YES — write before S4-T4  
    **Depends on**: S4-T1

- [ ] **S4-T4** Implement `OnboardingService`: `isOnboarding(userId)`, `confirmOnboarding(userId)`  
       **Spec req**: ai-onboarding spec §service.  
       **Files**:
  - `apps/api/src/onboarding/onboarding.service.ts` (new)
  - `apps/api/src/onboarding/onboarding.module.ts` (new)  
    **TDD**: YES — implement to pass S4-T3 tests  
    **Depends on**: S4-T3

- [ ] **S4-T5** Thread onboarding context flag through `agent.run`  
       **Spec req**: ai-onboarding spec §agent-context.  
       **Action**: Before calling `agent.run`, call `isOnboarding(userId)`. Pass result as `context.isOnboarding` to executor. Executor selects system-prompt variant based on flag.  
       **Files**:
  - `apps/api/src/agent/agent.service.ts`
  - `apps/api/src/agent/executor.ts`  
    **TDD**: no (wiring)  
    **Depends on**: S4-T4

- [ ] **S4-T6** Write onboarding system-prompt variant (persuasive, box-setup focused)  
       **Spec req**: ai-onboarding spec §onboarding-prompt.  
       **Action**: Separate prompt string/template for onboarding mode. Prompt must: introduce Mayordomo, ask for income, propose a box structure, call `createBox` with appropriate modes, confirm completion, call `confirmOnboarding`.  
       **Files**:
  - `apps/api/src/agent/prompts/onboarding.prompt.ts` (new)
  - `apps/api/src/agent/prompts/standard.prompt.ts` (extract existing prompt if not already isolated)  
    **TDD**: no (prompt text)  
    **Depends on**: S4-T5

- [ ] **S4-T7** WhatsApp proactive starter: send welcome message on account confirmation  
       **Spec req**: ai-onboarding spec §proactive-starter.  
       **Action**: On new account confirmed (registration or first login), send a proactive WhatsApp message that opens the onboarding conversation. Must be idempotent (send only once).  
       **Files**:
  - `apps/api/src/whatsapp/whatsapp.service.ts`
  - `apps/api/src/users/users.service.ts` (hook on user creation/first login)  
    **TDD**: no (external integration)  
    **Depends on**: S4-T4 (needs onboarding flag to check idempotency)

- [ ] **S4-T8** Web: onboarding flow — show flag + navigate into chat  
       **Spec req**: ai-onboarding spec §web-onboarding.  
       **Action**: On login, if `onboardingCompleted = false`, redirect to chat view with an onboarding banner/state. On completion event (flag flips to true), navigate away from onboarding state.  
       **Files**:
  - `apps/web/src/features/auth/hooks/useOnboardingGuard.ts` (new)
  - `apps/web/src/app/router.tsx` or equivalent
  - `apps/web/src/features/chat/ChatPage.tsx`  
    **TDD**: no (UI routing)  
    **Depends on**: S4-T1 (flag exists in API response)

- [ ] **S4-T9** Run root CI gate before PR  
       **Action**: same gate as S1-T10  
       **Depends on**: all S4 tasks complete

**S4 task count**: 9

---

## Cross-slice gate (all slices)

- [ ] **ROOT-T1** After each slice lands: verify `main` auto-deploy to Coolify succeeds before starting next slice  
       **Note**: `main` auto-deploys — do NOT merge a slice that breaks the Coolify build.

---

## Summary

| Slice                      | Tasks  | TDD tasks                       | Depends on  |
| -------------------------- | ------ | ------------------------------- | ----------- |
| S1 — Box model v2          | 11     | S1-T3, S1-T4, S1-T6, S1-T7 (4)  | —           |
| S2 — Unify recurring→fixed | 7      | S2-T1 (migration transform) (1) | S1          |
| S3 — Remove transit        | 7      | S3-T1 (invariant validator) (1) | independent |
| S4 — AI onboarding         | 9      | S4-T2, S4-T3, S4-T4 (3)         | S1          |
| **Total**                  | **34** | **9**                           |             |

---

## Review Workload Forecast

### Slice 1 — Box model v2

| Metric                       | Estimate                                         |
| ---------------------------- | ------------------------------------------------ |
| Changed files                | ~14                                              |
| Estimated lines changed      | ~420–500                                         |
| 400-line budget risk         | **High**                                         |
| Chained PRs recommended      | **Yes** (or size:exception if scope is accepted) |
| Decision needed before apply | **Yes** — S1-D1 income source                    |

**Options for orchestrator**: split S1 into S1a (API: entities + money.ts + migration + service) and S1b (web: box editor). S1a ~280 lines, S1b ~120–150 lines. Alternatively, accept as single PR with `size:exception`.

---

### Slice 2 — Unify recurring→fixed

| Metric                       | Estimate                   |
| ---------------------------- | -------------------------- |
| Changed files                | ~10 (deletions dominate)   |
| Estimated lines changed      | ~200–280 (deletions count) |
| 400-line budget risk         | **Medium**                 |
| Chained PRs recommended      | No (monitor during apply)  |
| Decision needed before apply | No                         |

---

### Slice 3 — Remove transit

| Metric                       | Estimate |
| ---------------------------- | -------- |
| Changed files                | ~9       |
| Estimated lines changed      | ~150–220 |
| 400-line budget risk         | **Low**  |
| Chained PRs recommended      | No       |
| Decision needed before apply | No       |

---

### Slice 4 — AI onboarding

| Metric                       | Estimate                                             |
| ---------------------------- | ---------------------------------------------------- |
| Changed files                | ~12                                                  |
| Estimated lines changed      | ~320–400                                             |
| 400-line budget risk         | **Medium-High**                                      |
| Chained PRs recommended      | Borderline — monitor during apply                    |
| Decision needed before apply | No (but confirm onboarding prompt text before S4-T6) |

---

### Overall PR plan

**Recommended: 4 PRs (one per slice), stacked-to-main.**

```
feat/boxes-v2-model      →  main  (S1, gate: ask-on-risk re 400-line budget → may split S1a/S1b)
feat/remove-transit      →  main  (S3, independent, land after S1)
feat/unify-recurring     →  main  (S2, after S1)
feat/ai-onboarding       →  main  (S4, after S1)
```

S1 is the only slice that clearly risks exceeding 400 lines — orchestrator must ask before apply whether to split or accept `size:exception`.

---

## Open questions / risks

1. **S1-D1 (income source)**: Unresolved. Blocks all funding-math tasks. Must be answered by reading `withBalances` before any S1 implementation starts.
2. **S1 line budget**: S1 may exceed 400 lines. Orchestrator should ask at apply time whether to split into S1a (API) + S1b (Web) or proceed with `size:exception`.
3. **S2-T1 migration safety**: Converting recurring→fixed is destructive. Migration must be manually reviewed before running in production. Consider a dry-run gate.
4. **S3-T1 verify-zero gate**: The enum narrowing is irreversible. The zero-row assertion in the migration is the only safety net — must not be skipped.
5. **S4-T7 WhatsApp proactive**: External side-effect on account creation. Test environment must mock the WhatsApp client or this will fire on test/seed runs.
6. **S2 + S4 ordering**: Both depend on S1. They can be developed in parallel (separate branches) but must each rebase onto S1 before merging.
