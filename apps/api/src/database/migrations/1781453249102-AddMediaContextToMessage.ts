import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaContextToMessage1781453249102 implements MigrationInterface {
  name = 'AddMediaContextToMessage1781453249102';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "recurring_expenses" DROP CONSTRAINT "FK_recurring_user"`);
    await queryRunner.query(`ALTER TABLE "recurring_expenses" DROP CONSTRAINT "FK_recurring_box"`);
    await queryRunner.query(`ALTER TABLE "ai_usage_log" DROP CONSTRAINT "FK_ai_usage_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_recurring_user_active"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_usage_user_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_usage_date"`);
    await queryRunner.query(`ALTER TABLE "messages" ADD "mediaContext" jsonb`);
    await queryRunner.query(
      `CREATE INDEX "IDX_b2c1929735ddec571ee5a4c609" ON "recurring_expenses" ("userId", "active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_277ccdfaefa56aef1b807de05c" ON "ai_usage_log" ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5eaf0d2f9f9cd4f2c9b2a0d5a6" ON "ai_usage_log" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_expenses" ADD CONSTRAINT "FK_c3a0703f52dda84b1df25ce1959" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_expenses" ADD CONSTRAINT "FK_7a8dc6d11400897168f19b06c4f" FOREIGN KEY ("boxId") REFERENCES "boxes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recurring_expenses" DROP CONSTRAINT "FK_7a8dc6d11400897168f19b06c4f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_expenses" DROP CONSTRAINT "FK_c3a0703f52dda84b1df25ce1959"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_5eaf0d2f9f9cd4f2c9b2a0d5a6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_277ccdfaefa56aef1b807de05c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b2c1929735ddec571ee5a4c609"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "mediaContext"`);
    await queryRunner.query(`CREATE INDEX "IDX_ai_usage_date" ON "ai_usage_log" ("createdAt") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_usage_user_date" ON "ai_usage_log" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_recurring_user_active" ON "recurring_expenses" ("userId", "active") `,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_log" ADD CONSTRAINT "FK_ai_usage_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_expenses" ADD CONSTRAINT "FK_recurring_box" FOREIGN KEY ("boxId") REFERENCES "boxes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_expenses" ADD CONSTRAINT "FK_recurring_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
