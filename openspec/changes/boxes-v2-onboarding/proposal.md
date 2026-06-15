# Proposal: Boxes v2 + AI-Driven Onboarding (Epic)

## Intent

New users face a cold-start budget: a static, auto-seeded set of boxes that rarely
matches their real money. Today percentages must sum to 100% of _total_ income, so
fixed bills (rent, subscriptions) are awkward; "recurring expenses" is a parallel,
duplicated concept; and `transit` is a confusing inert transaction type. This epic
makes budgets personalized and AI-built: the assistant co-designs each user's box
structure on signup (web + WhatsApp), boxes support fixed monthly amounts funded
off-the-top, recurring expenses are unified into fixed boxes, and `transit` is
removed. Goal: reduce setup friction, increase activation/retention, and simplify the
money model.

## Scope

### In Scope (delivered as 4 slices)

- **Slice 1 — Box model v2**: per-box allocation `mode` (`percent` | `fixed`) + `fixedAmount`; off-the-top funding; new invariant (percent boxes sum to 100% of _remainder_); `withBalances` math + remaining-to-fill for fixed boxes.
- **Slice 2 — Unify recurring → fixed boxes**: migrate `recurring_expenses` rows into fixed boxes; remove the recurring module; remove/remap its 3 agent tools.
- **Slice 3 — Remove transit**: void existing transit rows; narrow `transactions_type_enum` to `income | expense`.
- **Slice 4 — AI onboarding**: stop auto-seeding boxes; onboarding state flag; conversational box-building on confirmation (web → into chat; WhatsApp → proactive message), via existing agent tools.

### Out of Scope (Non-goals)

- Business-scope boxes adopting modes (Slice 1 ships modes for personal scope; business stays percent-only for now).
- Multi-currency, shared/household budgets, bank integrations.
- Redesigning the boxes UI beyond what fixed-mode + remaining-to-fill require.
- Replacing the agent runtime or MCP/Foundry tool surface (we reuse it).
- Reworking income capture beyond what onboarding needs.

## Capabilities

### New Capabilities

- `ai-onboarding`: conversational, AI-driven budget setup on signup (web + WhatsApp), onboarding state, stop auto-seed, flow into chat.

### Modified Capabilities

- `boxes`: add allocation mode (percent/fixed), off-the-top funding, new percent-sum-of-remainder invariant, balance derivation + remaining-to-fill.
- `recurring-expenses`: REMOVED — folded into fixed boxes; module + agent tools deleted/remapped, data migrated.
- `transactions`: remove `transit` type; narrow enum; void legacy transit rows.

## Approach

**Box model v2.** Add `mode` (enum, default `percent`) and `fixedAmount` (numeric,
nullable) to `boxes`. Funding order: `fixed boxes funded first off-the-top → remainder
= income − Σ active fixed → percent boxes split remainder by pct`. New invariants:
active personal percent boxes sum to 100 (of remainder); fixed boxes require
`fixedAmount > 0`; guard when `Σ fixed > income`. `withBalances` SQL changes so
`allocated` is `fixedAmount` for fixed boxes and `pct × remainder` for percent boxes;
add `remainingToFill = max(fixedAmount − funded, 0)`. Fund boxes keep accumulation.

**Unify recurring.** Each `recurring_expense` → a fixed box (`mode=fixed`,
`type=expense`, `fixedAmount=amount`, `name`, linked `boxId` collapsed). Delete the
recurring module; `listRecurringExpenses` → remap to list fixed boxes,
`add/removeRecurringExpense` → removed (createBox/updateBox cover them).

**Remove transit.** Set legacy transit transactions to `status=voided` (preserves
inert semantics, no balance impact), then enum-narrow to `income | expense`.

**AI onboarding.** Add `onboardingCompleted` flag on user. On account
confirmation: do NOT seed boxes. Trigger a guided agent flow — ask income → fixed
bills (fixed boxes) → savings goals (fund boxes) → spending categories (percent
boxes) — created via existing agent tools, with persuasive copy. Web: onboarding page
hands off into agentic chat. WhatsApp: bot sends a proactive starter message; setup
happens in-chat. Mark `onboardingCompleted` when the structure validates.

## Key Product Decisions (recommended + assumptions)

| Decision                          | Recommended                                             | Assumption / Alternative                                                                                    |
| --------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Legacy transit rows               | **Void** (`status=voided`)                              | Preserves inert semantics. Alt: convert to expense-with-box (counts as spend, rewrites history) — rejected. |
| Recurring agent tools             | **Remap `list`, remove `add`/`remove`**                 | createBox/updateBox replace them. Assumes MCP/Foundry callers tolerate the removed tools.                   |
| Existing users' auto-seeded boxes | **Keep as-is**                                          | We only stop seeding NEW accounts; existing boxes untouched, default mode `percent`.                        |
| `Σ fixed > income`                | **Block with guard error** (`box.fixed_exceeds_income`) | Fixed can't be funded; user must lower fixed or raise income. Alt: partial proportional funding — deferred. |
| Modes for business scope          | **No (personal only this epic)**                        | Business stays percent-only; revisit later.                                                                 |

## Affected Areas

| Area                                     | Impact   | Description                                                                                           |
| ---------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `apps/api/src/boxes/`                    | Modified | `box.entity.ts` (mode, fixedAmount), `boxes.service.ts` (funding, invariants, withBalances), money.ts |
| `apps/api/src/recurring/`                | Removed  | Module + service deleted; data migrated                                                               |
| `apps/api/src/agent/agent-tools.ts`      | Modified | Remap/remove recurring tools; onboarding flow uses box tools                                          |
| `packages/contracts/src/transactions.ts` | Modified | Drop `transit` from `TransactionType`                                                                 |
| DB migrations                            | New      | mode/fixedAmount cols; recurring→fixed; void transit + enum narrow; user onboarding flag              |
| `apps/web/.../onboarding.tsx` + chat     | Modified | Hand off into agentic chat                                                                            |
| `apps/api/src/whatsapp/`                 | Modified | Proactive onboarding starter message                                                                  |

## Risks

| Risk                                              | Likelihood | Mitigation                                                                            |
| ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| Retroactive balance changes from new funding math | High       | Apply v2 math from current period forward; backfill review; test fixtures per mode    |
| Enum narrowing is irreversible                    | Med        | Void rows first; take DB snapshot pre-migration; verify zero transit before narrowing |
| Users mid-onboarding during deploy                | Med        | Idempotent flag; resume logic; no destructive op until flag set                       |
| MCP/Foundry callers break on removed tools        | Med        | Keep `list` remap; document tool removal; version the tool surface                    |
| `Σ fixed > income` lockout frustration            | Low        | Clear guard error + AI guidance to adjust                                             |

## Rollback Plan

Per-slice rollback (independent PRs). Slices 1/2/4 revert via DB-down migrations
(drop columns, restore recurring module from git, clear onboarding flag) — keep
down-migrations. **Slice 3 (enum narrow) is effectively irreversible**: take a full
DB snapshot before; rollback = restore snapshot. Re-enable auto-seed by reverting the
approve-flow change.

## Dependencies

- Existing agent tool runtime (`AgentToolExecutorService`) and WhatsApp/Evolution integration.
- Slice order: **1 → 2 → 3 (parallel-ok) → 4**. Slice 2 depends on Slice 1 (fixed mode must exist). Slice 4 depends on 1 (and 2 for clean tool surface). Slice 3 is independent of 1/2/4.

## Success Criteria

- [ ] Boxes support `mode=fixed` funded off-the-top; percent boxes sum to 100% of remainder; guards enforced.
- [ ] All `recurring_expenses` migrated to fixed boxes; recurring module removed; tools remapped/removed.
- [ ] Zero `transit` transactions; enum is `income | expense`.
- [ ] New accounts are NOT auto-seeded; AI onboarding creates a personalized structure on web + WhatsApp and flows into chat.
- [ ] No unintended retroactive balance changes for existing users.
