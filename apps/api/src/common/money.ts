import { SplitItem } from '@app/contracts';

/**
 * Lógica de dinero pura (sin IO). Todo se opera en CENTAVOS (enteros) para
 * que jamás haya aritmética de flotantes sobre montos.
 */

// ─── S1-D1: Income source resolution ─────────────────────────────────────────
//
// Income used for funding-math remainder computation is the SAME source that
// withBalances has always used: the SUM of income transaction split amounts
// per box for the accounting month (allocM in withBalances). The total
// income for funding purposes = Σ allocM.values() across all personal boxes.
//
// This is the accounting-month income SUM — not a single income event.
// The 4 SUM queries in withBalances remain the source of truth for actual
// money moved; funding targets are derived in TypeScript (ADR-1).
// ─────────────────────────────────────────────────────────────────────────────

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

/**
 * Suma de % de cajas activas — debe dar exactamente 100.00 (en centésimas).
 *
 * S1 change: caller is responsible for passing ONLY the pcts of active personal
 * PERCENT boxes (fixed boxes are excluded from this check by the service layer).
 */
export function isValidPctSum(pcts: number[]): boolean {
  if (pcts.length === 0) return false;
  const total = pcts.reduce((s, p) => s + Math.round(p * 100), 0);
  return total === 100 * 100;
}

// ─── S1-T4: Funding-math functions (boxes-v2) ────────────────────────────────

/**
 * A box with mode and fixedAmount, used for pure funding-math computations.
 * Mirrors box.entity.ts fields but is IO-free (no TypeORM dependency).
 */
export interface FundingBox {
  id: string;
  name: string;
  mode: 'percent' | 'fixed';
  /** Percentage points. Ignored for fixed boxes. */
  pct: number;
  /** Monthly fixed amount in the user's currency. Required when mode='fixed'. */
  fixedAmount: number | null;
}

/**
 * Sum of fixedAmount across all fixed-mode boxes, in CENTS.
 * Excludes percent-mode boxes.
 */
export function sumFixedCents(boxes: FundingBox[]): number {
  return boxes
    .filter((b) => b.mode === 'fixed')
    .reduce((s, b) => s + toCents(b.fixedAmount ?? 0), 0);
}

/**
 * How much a fixed box still needs to be funded this month.
 * remainingToFill = max(fixedAmount − amountFunded, 0).
 * Both args are in the user's currency (NOT cents); the function returns in currency.
 */
export function remainingToFill(fixedAmount: number, amountFunded: number): number {
  return fromCents(Math.max(0, toCents(fixedAmount) - toCents(amountFunded)));
}

/** Per-box result from computeAllocation. */
export interface AllocationResult {
  id: string;
  name: string;
  mode: 'percent' | 'fixed';
  /** Target allocation for this box this month, in the user's currency. */
  allocated: number;
  /**
   * For fixed boxes: how much remains to be funded (max(fixedAmount − allocated, 0)).
   * For percent boxes: null.
   * Note: this field uses `allocated` as a proxy for amountFunded when called from
   * funding math; withBalances passes the actual SUM-queried amountFunded separately.
   */
  remainingToFill: number | null;
}

/**
 * Compute target allocations for a set of active personal boxes given monthly income.
 *
 * Algorithm (per design ADR-1 + spec §funding-math):
 *   1. fixedBoxes = boxes where mode='fixed'
 *   2. pctBoxes   = boxes where mode='percent'
 *   3. fixedTotal = Σ fixedAmount(fixedBoxes) in cents
 *   4. remainder  = max(0, toCents(income) − fixedTotal)  — never negative
 *   5. fixed box  allocated = fixedAmount
 *   6. percent box allocated = largest-remainder split of remainder by pct
 *
 * Guard (box.fixed_exceeds_income): NOT raised here — this is pure math.
 * The service layer raises the error on mutation. On read, remainder clamps to 0.
 *
 * @param income Monthly income in the user's currency (accounting-month SUM from allocM)
 * @param boxes  Active personal boxes (all modes)
 */
export function computeAllocation(income: number, boxes: FundingBox[]): AllocationResult[] {
  const fixedBoxes = boxes.filter((b) => b.mode === 'fixed');
  const pctBoxes = boxes.filter((b) => b.mode === 'percent');

  const fixedTotalCents = sumFixedCents(fixedBoxes);
  const incomeCents = toCents(income);
  const remainderCents = Math.max(0, incomeCents - fixedTotalCents);

  // Largest-remainder split for percent boxes (reuses computeSplit algorithm)
  const pctSplits =
    pctBoxes.length > 0 && remainderCents > 0
      ? computeSplit(fromCents(remainderCents), pctBoxes)
      : pctBoxes.map((b) => ({ boxId: b.id, name: b.name, pct: b.pct, amount: 0 }));

  const pctResultMap = new Map(pctSplits.map((s) => [s.boxId, s.amount]));

  const fixedResults: AllocationResult[] = fixedBoxes.map((b) => ({
    id: b.id,
    name: b.name,
    mode: 'fixed',
    allocated: b.fixedAmount ?? 0,
    // remainingToFill: here allocated IS the target; actual fill computed in withBalances
    remainingToFill: 0,
  }));

  const pctResults: AllocationResult[] = pctBoxes.map((b) => ({
    id: b.id,
    name: b.name,
    mode: 'percent',
    allocated: pctResultMap.get(b.id) ?? 0,
    remainingToFill: null,
  }));

  return [...fixedResults, ...pctResults];
}
