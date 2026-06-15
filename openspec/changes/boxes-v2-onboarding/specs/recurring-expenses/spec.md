# Delta for Recurring Expenses

## REMOVED Requirements

### Requirement: Recurring Expense Management

(Reason: The standalone recurring-expenses module is removed. Its data and
business purpose are fully covered by fixed-mode boxes introduced in Slice 1.
Maintaining a duplicate concept creates confusion and requires syncing two
representations of the same financial intent.)

(Migration: All rows in the `recurring_expenses` table MUST be migrated to fixed boxes
before the module is deleted. Each row becomes a box with `mode=fixed`,
`type=expense`, `fixedAmount=recurring_expense.amount`, and `name=recurring_expense.name`.
After migration the `recurring_expenses` table MAY be dropped.)

### Requirement: Add Recurring Expense via Agent Tool

(Reason: Removed — `createBox` with `mode=fixed` replaces this action.)

(Migration: Agent callers that previously invoked `addRecurringExpense` MUST switch
to `createBox` with `mode=fixed`, `type=expense`, and the desired `fixedAmount`.)

### Requirement: Remove Recurring Expense via Agent Tool

(Reason: Removed — `updateBox` / archive-box replaces this action.)

(Migration: Agent callers that previously invoked `removeRecurringExpense` MUST switch
to the box archive or update operations.)

---

## MODIFIED Requirements

### Requirement: List Recurring Expenses Agent Tool Remapped

The `listRecurringExpenses` agent tool MUST be remapped to return the list of fixed
boxes (`mode=fixed`, `type=expense`) for the current user's personal scope.
The tool name MAY be retained temporarily for backward compatibility, but its
implementation MUST delegate to the fixed-box list query.

(Previously: queried the `recurring_expenses` table directly.)

#### Scenario: listRecurringExpenses returns fixed expense boxes

- GIVEN a user with three active fixed-expense boxes
- WHEN the agent invokes `listRecurringExpenses`
- THEN the response contains those three boxes in fixed-box format
- AND no `recurring_expenses` table rows are read

#### Scenario: listRecurringExpenses returns empty when no fixed-expense boxes exist

- GIVEN a user with no fixed-expense boxes (only percent or fund boxes)
- WHEN the agent invokes `listRecurringExpenses`
- THEN the response is an empty list

---

## ADDED Requirements

### Requirement: Recurring Expenses Data Migration

The migration MUST run before the recurring-expenses module is deleted.
Every `recurring_expense` row MUST produce exactly one fixed box record.
The migration MUST be idempotent (re-running does not duplicate boxes).

#### Scenario: Each recurring expense creates one fixed box

- GIVEN 5 rows in `recurring_expenses`
- WHEN the migration runs
- THEN 5 fixed boxes exist with matching name and fixedAmount
- AND the recurring expense rows are no longer authoritative

#### Scenario: Migration is idempotent

- GIVEN the migration has already run once (5 fixed boxes created)
- WHEN the migration runs a second time
- THEN no additional boxes are created (total remains 5)
