import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tracking de uso/costos de IA por usuario (tab "Uso" del panel admin). */
export class AiUsage1781220000000 implements MigrationInterface {
  name = 'AiUsage1781220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_usage_log" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"userId" uuid NOT NULL, ` +
        `"kind" character varying(20) NOT NULL, ` +
        `"model" character varying(80) NOT NULL, ` +
        `"inputTokens" integer, ` +
        `"outputTokens" integer, ` +
        `"costUsd" numeric(12,6), ` +
        `"channel" character varying(10), ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_ai_usage_log" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_usage_user_date" ON "ai_usage_log" ("userId", "createdAt")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_ai_usage_date" ON "ai_usage_log" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ai_usage_date"`);
    await queryRunner.query(`DROP INDEX "IDX_ai_usage_user_date"`);
    await queryRunner.query(`DROP TABLE "ai_usage_log"`);
  }
}
