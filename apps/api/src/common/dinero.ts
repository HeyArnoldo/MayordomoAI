import { SplitItem } from '@app/contracts';

/**
 * Lógica de dinero pura (sin IO). Todo se opera en CENTAVOS (enteros) para
 * que jamás haya aritmética de flotantes sobre montos.
 */

export const TZ_CONTABLE = 'America/Lima';

export function toCents(monto: number): number {
  return Math.round(monto * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Fecha contable (YYYY-MM-DD) de un instante, en America/Lima.
 * Un gasto a las 11:58pm de Lima cuenta para ese día, no para el día UTC.
 */
export function fechaContable(instante: Date, tz: string = TZ_CONTABLE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

/** Rango [desde, hasta] de fechas contables del mes de Lima que contiene al instante. */
export function mesContable(
  instante: Date,
  tz: string = TZ_CONTABLE,
): { desde: string; hasta: string } {
  const hoy = fechaContable(instante, tz);
  const [y, m] = hoy.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { desde: `${y}-${mm}-01`, hasta: `${y}-${mm}-${String(ultimoDia).padStart(2, '0')}` };
}

export interface CajaParaSplit {
  id: string;
  nombre: string;
  pct: number; // puntos porcentuales (25 = 25%)
}

/**
 * Reparte un ingreso entre cajas según sus %, en centavos, con método del
 * mayor residuo: la suma de las partes es EXACTAMENTE igual al monto.
 * Es el snapshot que se guarda en movimientos.split.
 */
export function calcularSplit(monto: number, cajas: CajaParaSplit[]): SplitItem[] {
  const totalCents = toCents(monto);
  const exactos = cajas.map((c) => (totalCents * c.pct) / 100);
  const pisos = exactos.map(Math.floor);
  let resto = totalCents - pisos.reduce((s, v) => s + v, 0);

  // Reparte los centavos sobrantes a los mayores residuos (estable por orden).
  const porResiduo = exactos
    .map((v, i) => ({ i, residuo: v - pisos[i] }))
    .sort((a, b) => b.residuo - a.residuo || a.i - b.i);
  for (const { i } of porResiduo) {
    if (resto <= 0) break;
    pisos[i] += 1;
    resto -= 1;
  }

  return cajas.map((c, i) => ({
    cajaId: c.id,
    nombre: c.nombre,
    pct: c.pct,
    monto: fromCents(pisos[i]),
  }));
}

/** Suma de % de cajas activas — debe dar exactamente 100.00 (en centésimas). */
export function sumaPctValida(pcts: number[]): boolean {
  const total = pcts.reduce((s, p) => s + Math.round(p * 100), 0);
  return total === 100 * 100;
}
