import { MigrationInterface, QueryRunner } from 'typeorm';

// Copia congelada del mapa de @app/contracts: una migración es una foto del
// momento — si el mapa vivo cambia, esta migración no debe cambiar con él.
const PREFIX_TO_CURRENCY: Record<string, string> = {
  '+1': 'USD',
  '+44': 'GBP',
  '+51': 'PEN',
  '+52': 'MXN',
  '+54': 'ARS',
  '+55': 'BRL',
  '+56': 'CLP',
  '+57': 'COP',
  '+591': 'BOB',
  '+595': 'PYG',
  '+598': 'UYU',
  '+30': 'EUR',
  '+31': 'EUR',
  '+32': 'EUR',
  '+33': 'EUR',
  '+34': 'EUR',
  '+39': 'EUR',
  '+43': 'EUR',
  '+49': 'EUR',
  '+351': 'EUR',
  '+352': 'EUR',
  '+353': 'EUR',
  '+356': 'EUR',
  '+357': 'EUR',
  '+358': 'EUR',
  '+370': 'EUR',
  '+371': 'EUR',
  '+372': 'EUR',
  '+385': 'EUR',
  '+386': 'EUR',
  '+421': 'EUR',
};

const PREFIXES_BY_LENGTH = Object.keys(PREFIX_TO_CURRENCY).sort((a, b) => b.length - a.length);

function deriveCurrency(e164: string): string | null {
  const prefix = PREFIXES_BY_LENGTH.find((p) => e164.startsWith(p));
  return prefix ? (PREFIX_TO_CURRENCY[prefix] ?? null) : null;
}

/**
 * Preferencias de idioma y moneda por usuario.
 * - language: existentes quedan en 'es' (público actual hispano).
 * - currency: NULL = nunca eligió (se resuelve como USD). Backfill: a quien ya
 *   tiene teléfono verificado se le deriva la moneda del prefijo del número;
 *   sin teléfono queda NULL para derivarse cuando verifique uno.
 */
export class UserPreferences1781260000000 implements MigrationInterface {
  name = 'UserPreferences1781260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "language" character varying(5) NOT NULL DEFAULT 'es'`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "currency" character(3)`);

    const rows: Array<{ userId: string; e164: string }> = await queryRunner.query(
      `SELECT p."userId" AS "userId", p."e164" AS "e164"
       FROM "phone_numbers" p
       WHERE p."verified" = true`,
    );
    for (const row of rows) {
      const currency = deriveCurrency(row.e164);
      if (currency) {
        await queryRunner.query(`UPDATE "users" SET "currency" = $1 WHERE "id" = $2`, [
          currency,
          row.userId,
        ]);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "currency"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "language"`);
  }
}
