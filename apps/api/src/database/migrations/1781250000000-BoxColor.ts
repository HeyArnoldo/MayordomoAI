import { MigrationInterface, QueryRunner } from 'typeorm';

/** Color elegible por caja (token del design, no hex). */
export class BoxColor1781250000000 implements MigrationInterface {
  name = 'BoxColor1781250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "boxes" ADD "colorKey" character varying(20)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "boxes" DROP COLUMN "colorKey"`);
  }
}
