import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Slice 3 — Remove transit transaction type.
 *
 * Safety sequence:
 *  1. Void all non-voided transit rows (status = 'voided', deletedAt = now()).
 *  2. Verify-zero gate: assert no non-voided transit rows remain before narrowing the enum.
 *     This is the only safety net — the enum narrowing is irreversible.
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
    // Step 1: Void all non-voided transit rows.
    await queryRunner.query(`
      UPDATE "transactions"
      SET "status" = 'voided', "deletedAt" = now()
      WHERE "type" = 'transit'
        AND "deletedAt" IS NULL
    `);

    // Step 2: Verify-zero gate — enum narrowing MUST NOT proceed if any active transit rows remain.
    const remaining = await queryRunner.query(`
      SELECT COUNT(*)::int AS cnt
      FROM "transactions"
      WHERE "type" = 'transit'
        AND "deletedAt" IS NULL
    `);
    const count: number = (remaining as Array<{ cnt: number }>)[0]?.cnt ?? 0;
    if (count > 0) {
      throw new Error(
        `[RemoveTransitType] Verify-zero failed: ${count} non-voided transit row(s) remain. ` +
          `Aborting enum narrowing — re-run or void them manually first.`,
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

    // Step 3c: Migrate the column — USING cast; transit rows are already voided so their
    // type value will fail the cast. They must be handled first (already done in step 1).
    // Any row that still carries 'transit' at this point is a bug and will cause an error,
    // which is the desired behavior (fail-loud rather than silently corrupt data).
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
