import { SplitItem } from '@app/contracts';

/**
 * Lógica de dinero pura (sin IO). Todo se opera en CENTAVOS (enteros) para
 * que jamás haya aritmética de flotantes sobre montos.
 */

export const ACCOUNTING_TZ = 'America/Lima';

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Fecha contable (YYYY-MM-DD) de un instante, en America/Lima.
 * Un gasto a las 11:58pm de Lima cuenta para ese día, no para el día UTC.
 */
export function accountingDate(instant: Date, tz: string = ACCOUNTING_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Rango [from, to] de fechas contables del mes de Lima que contiene al instante. */
export function accountingMonth(
  instant: Date,
  tz: string = ACCOUNTING_TZ,
): { from: string; to: string } {
  const today = accountingDate(instant, tz);
  const [y, m] = today.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

export interface SplitBox {
  id: string;
  name: string;
  pct: number; // puntos porcentuales (25 = 25%)
}

/**
 * Reparte un ingreso entre cajas según sus %, en centavos, con método del
 * mayor residuo: la suma de las partes es EXACTAMENTE igual al monto.
 * Es el snapshot que se guarda en transactions.split.
 */
export function computeSplit(amount: number, boxes: SplitBox[]): SplitItem[] {
  const totalCents = toCents(amount);
  const exact = boxes.map((b) => (totalCents * b.pct) / 100);
  const floors = exact.map(Math.floor);
  let remainder = totalCents - floors.reduce((s, v) => s + v, 0);

  // Reparte los centavos sobrantes a los mayores residuos (estable por orden).
  const byRemainder = exact
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byRemainder) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }

  return boxes.map((b, i) => ({
    boxId: b.id,
    name: b.name,
    pct: b.pct,
    amount: fromCents(floors[i]),
  }));
}

/** Suma de % de cajas activas — debe dar exactamente 100.00 (en centésimas). */
export function isValidPctSum(pcts: number[]): boolean {
  const total = pcts.reduce((s, p) => s + Math.round(p * 100), 0);
  return total === 100 * 100;
}
