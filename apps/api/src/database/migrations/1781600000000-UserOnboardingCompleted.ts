import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `onboardingCompleted` boolean column to the `users` table.
 *
 * Distinct from `onboardedAt` (which records the phone-link step).
 * This flag tracks completion of the AI-driven box-setup onboarding flow.
 * Default = false so all existing users are treated as needing onboarding
 * until they explicitly complete it (or an admin sets it via data migration).
 */
export class UserOnboardingCompleted1781600000000 implements MigrationInterface {
  name = 'UserOnboardingCompleted1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "onboardingCompleted" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "onboardingCompleted"`);
  }
}
