import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Slice 2: Unify recurring_expenses into fixed-mode boxes.
 *
 * Each recurring_expense row becomes a box with:
 *   mode = 'fixed', fixedAmount = recurring_expenses.amount,
 *   type = 'expense', scope = 'personal', active = true, pct = 0.
 *
 * After the data move, the recurring_expenses table is dropped.
 * The dayOfMonth / lastRemindedPeriod fields are intentionally discarded
 * per ADR-2 (reminders removed from this epic; revisit later).
 *
 * DOWN: best-effort recreation of the schema. Data cannot be auto-restored.
 */
export class UnifyRecurringIntoFixedBoxes1781600000000 implements MigrationInterface {
  name = 'UnifyRecurringIntoFixedBoxes1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Move each active recurring_expense row into a fixed box.
    // uuid_generate_v4() is available because the Domain migration enables it.
    await queryRunner.query(`
      INSERT INTO "boxes" (
        "id",
        "userId",
        "name",
        "pct",
        "type",
        "scope",
        "colorKey",
        "sortOrder",
        "active",
        "mode",
        "fixedAmount",
        "createdAt",
        "updatedAt"
      )
      SELECT
        uuid_generate_v4(),
        r."userId",
        r."name",
        0,
        'expense',
        'personal',
        NULL,
        0,
        true,
        'fixed',
        r."amount",
        now(),
        now()
      FROM "recurring_expenses" r
    `);

    // Drop the index added by BoxModeFixedAmount migration before dropping the table.
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_b2c1929735ddec571ee5a4c609"`);

    // Drop the recurring_expenses table (all data has been migrated above).
    await queryRunner.query(`DROP TABLE "recurring_expenses"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best-effort: recreate the table schema. The migrated data (now in boxes)
    // cannot be automatically restored to this table — manual intervention required.
    await queryRunner.query(
      `CREATE TABLE "recurring_expenses" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"userId" uuid NOT NULL, ` +
        `"name" character varying(120) NOT NULL, ` +
        `"amount" numeric(12,2) NOT NULL, ` +
        `"dayOfMonth" integer NOT NULL DEFAULT 1, ` +
        `"boxId" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000', ` +
        `"active" boolean NOT NULL DEFAULT true, ` +
        `"lastRemindedPeriod" character varying(7), ` +
        `"createdAt" TIMESTAMP NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_recurring_expenses" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "FK_recurring_user_down" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b2c1929735ddec571ee5a4c609" ON "recurring_expenses" ("userId", "active")`,
    );
  }
}
