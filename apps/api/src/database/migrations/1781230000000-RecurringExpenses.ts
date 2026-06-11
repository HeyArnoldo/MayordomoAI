import { MigrationInterface, QueryRunner } from 'typeorm';

/** Gastos fijos mensuales con recordatorio por WhatsApp. */
export class RecurringExpenses1781230000000 implements MigrationInterface {
  name = 'RecurringExpenses1781230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "recurring_expenses" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"userId" uuid NOT NULL, ` +
        `"name" character varying(120) NOT NULL, ` +
        `"amount" numeric(12,2) NOT NULL, ` +
        `"dayOfMonth" integer NOT NULL, ` +
        `"boxId" uuid NOT NULL, ` +
        `"active" boolean NOT NULL DEFAULT true, ` +
        `"lastRemindedPeriod" character varying(7), ` +
        `"createdAt" TIMESTAMP NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_recurring_expenses" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "FK_recurring_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, ` +
        `CONSTRAINT "FK_recurring_box" FOREIGN KEY ("boxId") REFERENCES "boxes"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_recurring_user_active" ON "recurring_expenses" ("userId", "active")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_recurring_user_active"`);
    await queryRunner.query(`DROP TABLE "recurring_expenses"`);
  }
}
