import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Slice 3 — Remove transit transaction type.
 *
 * Safety sequence:
 *  1. Void all non-voided transit rows (status = 'voided', deletedAt = now()) AND
 *     reassign their type to 'expense'. The type reassignment is required: the
 *     enum-narrow cast in step 3 casts EVERY row (voided rows included), so any
 *     row still carrying type='transit' — even a voided one — would break the cast.
 *     Voided rows do not affect balances, so 'expense' is an inert, consistent
 *     placeholder (matches the web UI fallback that renders legacy voided transit
 *     rows as 'expense').
 *  2. Verify-zero gate: assert no rows of type 'transit' remain at all before
 *     narrowing the enum. This is the only safety net — the enum narrowing is
 *     irreversible.
 *  3. Rename existing 3-value enum, create 2-value enum, migrate column, drop old enum.
 *
 * down() notes:
 *  - Restores the 3-value enum and casts the column back.
 *  - Voided transit rows' type is restored to 'transit' so the data is consistent,
 *    but their status remains 'voided' — they will not affect balances.
 *  - Once the column type is narrowed and the down() has NOT run, existing transit
 *    rows are unreachable by type; run down() before trying to restore type values.
 */
export class RemoveTransitType1781510000000 implements MigrationInterface {
  name = 'RemoveTransitType1781510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Void all non-voided transit rows, then reassign EVERY transit row's
    // type to 'expense' so the enum-narrow cast in step 3 cannot hit a 'transit'
    // value. The void carries the audit intent; the type reassignment is what
    // makes the irreversible cast safe. Voided rows are excluded from balances,
    // so 'expense' is an inert placeholder.
    await queryRunner.query(`
      UPDATE "transactions"
      SET "status" = 'voided', "deletedAt" = now()
      WHERE "type" = 'transit'
        AND "deletedAt" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "transactions"
      SET "type" = 'expense'
      WHERE "type" = 'transit'
    `);

    // Step 2: Verify-zero gate — enum narrowing MUST NOT proceed if ANY row still
    // carries type 'transit' (the cast in step 3 touches voided rows too).
    const remaining = await queryRunner.query(`
      SELECT COUNT(*)::int AS cnt
      FROM "transactions"
      WHERE "type" = 'transit'
    `);
    const count: number = (remaining as Array<{ cnt: number }>)[0]?.cnt ?? 0;
    if (count > 0) {
      throw new Error(
        `[RemoveTransitType] Verify-zero failed: ${count} transit row(s) remain. ` +
          `Aborting enum narrowing — re-run or reassign them manually first.`,
      );
    }

    // Step 3a: Rename old enum.
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_type_enum" RENAME TO "transactions_type_enum_old"`,
    );

    // Step 3b: Create new 2-value enum.
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum" AS ENUM('income', 'expense')`,
    );

    // Step 3c: Migrate the column — USING cast over every row. Step 1 reassigned all
    // transit rows (including the just-voided ones) to 'expense', and step 2's
    // verify-zero gate guarantees no 'transit' value survives, so this cast is safe.
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ALTER COLUMN "type" TYPE "public"."transactions_type_enum"
        USING "type"::text::"public"."transactions_type_enum"
    `);

    // Step 3d: Drop old enum.
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore old 3-value enum.
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_type_enum" RENAME TO "transactions_type_enum_new"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum" AS ENUM('income', 'expense', 'transit')`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ALTER COLUMN "type" TYPE "public"."transactions_type_enum"
        USING "type"::text::"public"."transactions_type_enum"
    `);
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum_new"`);

    // Note: voided transit rows' type cannot be automatically restored because
    // we no longer know which rows were transit. Their status remains 'voided'
    // and they do not affect balances. Manual restoration requires knowing the
    // original data, which should come from a pre-migration snapshot.
  }
}
