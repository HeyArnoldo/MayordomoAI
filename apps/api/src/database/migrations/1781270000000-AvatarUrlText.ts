import { MigrationInterface, QueryRunner } from 'typeorm';

/** Google puede devolver URLs de avatar de más de 500 caracteres. */
export class AvatarUrlText1781270000000 implements MigrationInterface {
  name = 'AvatarUrlText1781270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "avatarUrl" TYPE text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "avatarUrl" TYPE character varying(500) USING left("avatarUrl", 500)`,
    );
  }
}
