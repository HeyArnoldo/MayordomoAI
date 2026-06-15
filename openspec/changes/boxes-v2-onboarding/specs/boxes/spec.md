# Delta for Boxes

## ADDED Requirements

### Requirement: Box Allocation Mode

Each box MUST have an `mode` field with values `percent` or `fixed`. A box with
`mode=fixed` MUST have `fixedAmount > 0`. A box with `mode=percent` MUST have
a `pct` value; `fixedAmount` is ignored and SHOULD be null.

Existing boxes without a stored `mode` MUST default to `mode='percent'` and continue
working without change.

#### Scenario: Create fixed box with valid amount

- GIVEN a user with personal scope and monthly income set
- WHEN `createBox` is called with `mode=fixed`, `fixedAmount=500`
- THEN the box is persisted with `mode=fixed`, `fixedAmount=500`
- AND the percent-box invariant is re-evaluated for the remaining income

#### Scenario: Create fixed box without amount is rejected

- GIVEN a user with personal scope
- WHEN `createBox` is called with `mode=fixed` and no `fixedAmount` (or `fixedAmount=0`)
- THEN the request MUST be rejected with validation error `box.fixed_amount_required`

#### Scenario: Existing percent box defaults correctly

- GIVEN a box persisted before mode was introduced (no `mode` column value)
- WHEN that box is read
- THEN it MUST be returned with `mode='percent'` and behave identically to a percent box

---

### Requirement: Off-the-Top Fixed Box Funding

When computing allocations for a user's personal boxes, fixed boxes MUST be funded
first, off the top of monthly income. The remainder available for percent boxes MUST
be: `remainder = monthly_income − Σ(fixedAmount of all active personal fixed boxes)`.
Percent boxes MUST split `remainder` by their `pct`.

#### Scenario: Fixed box gets its full amount before percent split

- GIVEN a user with monthly income 3000, one fixed box at 800, and two percent boxes at 60%/40%
- WHEN allocations are computed
- THEN the fixed box allocated = 800
- AND remainder = 2200; percent boxes receive 1320 and 880 respectively

#### Scenario: Zero fixed boxes — remainder equals full income

- GIVEN a user with monthly income 2000 and no active fixed boxes
- WHEN allocations are computed
- THEN remainder = 2000; percent boxes split the full income

---

### Requirement: Guard — Fixed Amounts Must Not Exceed Income

If the sum of `fixedAmount` of all active personal fixed boxes exceeds the user's
monthly income, the system MUST reject the create/update operation with error code
`box.fixed_exceeds_income`. Partial proportional funding is NOT allowed.

#### Scenario: Σ fixed exactly equals income is rejected

- GIVEN monthly income = 1000 and existing fixed boxes totaling 900
- WHEN `createBox` or `updateBox` attempts to add/change a fixed box making Σ fixed = 1000
- THEN the request MUST be rejected with `box.fixed_exceeds_income`
- AND the box is not saved

#### Scenario: Σ fixed below income is accepted

- GIVEN monthly income = 1000 and existing fixed boxes totaling 900
- WHEN a fixed box with `fixedAmount=50` is created (Σ = 950 < 1000)
- THEN the box is saved successfully

---

### Requirement: Percent Box Invariant on Remainder

Active personal PERCENT boxes MUST collectively have `pct` values that sum to exactly 100. This sum is computed ONLY among percent boxes; fixed boxes are excluded from
the invariant check. The system MUST enforce this invariant on every create, update,
activate, or deactivate that affects percent boxes.

#### Scenario: Percent boxes sum to 100 — accepted

- GIVEN three active personal percent boxes with pct 50, 30, 20
- WHEN a fourth percent box with pct=0 is activated (kept at 0 temporarily)
- THEN only boxes with pct forming 100 total are valid; the system accepts the set

#### Scenario: Percent boxes not summing to 100 — rejected

- GIVEN two active personal percent boxes with pct 60, 30 (sum=90)
- WHEN `createBox` is called with `mode=percent`, `pct=5` (total would be 95)
- THEN the request MUST be rejected with invariant error `box.percent_sum_not_100`

#### Scenario: Fixed box is excluded from percent invariant

- GIVEN active percent boxes summing to 100 and one active fixed box
- WHEN the fixed box's amount is updated
- THEN the percent invariant check is NOT triggered for the fixed box

---

### Requirement: Balance Derivation with Remaining-to-Fill

`withBalances` MUST return, per box: `allocated`, `spent`, `balance`.
For fixed boxes it MUST additionally return `remainingToFill = max(fixedAmount − amountFunded, 0)`.

| Box mode  | allocated formula |
| --------- | ----------------- |
| `fixed`   | `fixedAmount`     |
| `percent` | `pct × remainder` |

Fund-type boxes keep their existing accumulation logic unchanged.

#### Scenario: Fixed box balance includes remaining-to-fill

- GIVEN a fixed box with `fixedAmount=500`, `amountFunded=200`
- WHEN `withBalances` is called
- THEN `allocated=500`, `remainingToFill=300`

#### Scenario: Fully funded fixed box has zero remaining

- GIVEN a fixed box with `fixedAmount=500`, `amountFunded=500`
- WHEN `withBalances` is called
- THEN `remainingToFill=0`

#### Scenario: Percent box allocation uses remainder

- GIVEN monthly income=3000, fixed boxes total=800, percent box pct=50
- WHEN `withBalances` is called
- THEN `allocated = 0.50 × 2200 = 1100`; no `remainingToFill` field

---

### Requirement: Mode Switch on Existing Box

`updateBox` MUST accept a `mode` change (e.g., `percent → fixed` or `fixed → percent`)
on an existing box. After the switch, the invariant for the new mode MUST be re-checked
and enforced before persisting.

#### Scenario: Switch percent box to fixed

- GIVEN an active percent box with pct=20
- WHEN `updateBox` is called with `mode=fixed`, `fixedAmount=300`
- THEN the box becomes fixed, pct is ignored
- AND guard checks Σ fixed ≤ income; if violated, request is rejected
- AND percent invariant is re-evaluated with the box excluded

#### Scenario: Switch fixed box to percent without valid pct — rejected

- GIVEN an active fixed box
- WHEN `updateBox` is called with `mode=percent` and no `pct` (or pct causes sum ≠ 100)
- THEN the request MUST be rejected with percent invariant error

---

### Requirement: Business Scope Boxes Are Unaffected

Box `mode` and fixed funding logic apply ONLY to boxes with `scope=personal`.
Business-scope boxes MUST remain `mode=percent` and MUST NOT be subject to
off-the-top funding or the Σ-fixed guard.

#### Scenario: Business box ignores fixed mode

- GIVEN a box with `scope=business`
- WHEN `createBox` or `updateBox` is called with `mode=fixed`
- THEN the request MUST be rejected with error `box.mode_not_supported_for_scope`
