# Delta for Transactions

## MODIFIED Requirements

### Requirement: Transaction Type Enum

The valid values for `transaction_type` MUST be `income` and `expense` only.
The value `transit` is no longer valid and MUST NOT be accepted by any create or
query endpoint or agent tool.

(Previously: `transit` was a valid type representing internal transfers; it was
inert — no balance effect — and primarily used for historical pass-through records.)

#### Scenario: Create income transaction

- GIVEN a valid user and box
- WHEN a transaction is created with `type=income`
- THEN it is persisted and returned with `type=income`

#### Scenario: Create expense transaction

- GIVEN a valid user and box
- WHEN a transaction is created with `type=expense`
- THEN it is persisted and returned with `type=expense`

#### Scenario: Create transit transaction is rejected

- GIVEN a valid user
- WHEN a transaction is created with `type=transit`
- THEN the request MUST be rejected with validation error `transaction.invalid_type`

#### Scenario: Query with transit type filter is rejected

- GIVEN a valid user
- WHEN a list/query endpoint is called with `type=transit` as a filter
- THEN the request MUST be rejected with `transaction.invalid_type`

---

## ADDED Requirements

### Requirement: Legacy Transit Row Migration

All existing `transit` transactions in the database MUST be set to `status=voided`
before the enum is narrowed. No transit transaction MAY remain in a non-voided state
after migration runs.

(This is a one-time migration; no new transit rows can be created post-migration.)

#### Scenario: Migration voids all transit rows

- GIVEN a database with N rows where `type=transit` and `status != voided`
- WHEN the migration script runs
- THEN all N rows have `status=voided`
- AND their `type` column value is preserved as-is until the enum narrowing step

#### Scenario: Enum narrowed only after all transit rows are voided

- GIVEN the migration has run and zero transit rows are non-voided
- WHEN the `transactions_type_enum` is altered to remove `transit`
- THEN the enum change succeeds with no FK or constraint violations

#### Scenario: Zero transit rows post-migration check

- GIVEN the migration has completed
- WHEN the database is queried for `type=transit AND status != 'voided'`
- THEN the result set MUST be empty
