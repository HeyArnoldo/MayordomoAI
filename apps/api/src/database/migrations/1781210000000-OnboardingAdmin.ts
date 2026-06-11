import { MigrationInterface, QueryRunner } from 'typeorm';

/** Onboarding multiusuario: verificación de número por código + marca de onboarding. */
export class OnboardingAdmin1781210000000 implements MigrationInterface {
  name = 'OnboardingAdmin1781210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "onboardedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `ALTER TABLE "phone_numbers" ADD "verificationCodeHash" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "phone_numbers" ADD "codeExpiresAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "phone_numbers" ADD "codeSentAt" TIMESTAMP WITH TIME ZONE`,
    );
    // Cuentas existentes ya estaban operando: no las mandes al onboarding.
    await queryRunner.query(`UPDATE "users" SET "onboardedAt" = now() WHERE "status" = 'active'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "phone_numbers" DROP COLUMN "codeSentAt"`);
    await queryRunner.query(`ALTER TABLE "phone_numbers" DROP COLUMN "codeExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "phone_numbers" DROP COLUMN "verificationCodeHash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "onboardedAt"`);
  }
}
