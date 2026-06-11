import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FK faltante de ai_usage_log → users. Con esto "eliminar cuenta" es un solo
 * DELETE sobre users y Postgres limpia todo en cascada.
 */
export class AiUsageFk1781240000000 implements MigrationInterface {
  name = 'AiUsageFk1781240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Huérfanos previos (usuarios ya borrados a mano) bloquearían el constraint.
    await queryRunner.query(
      `DELETE FROM "ai_usage_log" WHERE "userId" NOT IN (SELECT "id" FROM "users")`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_log" ADD CONSTRAINT "FK_ai_usage_user" ` +
        `FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_usage_log" DROP CONSTRAINT "FK_ai_usage_user"`);
  }
}
