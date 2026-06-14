import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaContextToMessage1781453249102 implements MigrationInterface {
  name = 'AddMediaContextToMessage1781453249102';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" ADD "mediaContext" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "mediaContext"`);
  }
}
