/**
 * Fast-path de WhatsApp: frases estructuradas comunes se resuelven con regex,
 * sin llamar a la IA (gratis y <10ms). Solo lo ambiguo cae al agente.
 */

export type FastPathResult =
  | { kind: 'expense'; amount: number; boxName: string; note: string }
  | { kind: 'income'; amount: number; note: string }
  | { kind: 'summary' }
  | null;

const AMOUNT = String.raw`(?:s/\.?\s*)?(\d+(?:[.,]\d{1,2})?)`;

const EXPENSE_RE = new RegExp(
  String.raw`^\s*(?:gast[eé]|pagu[eé]|compr[eé]|anota)\s+${AMOUNT}\s+(?:en|de|para)\s+(.+?)\s*$`,
  'i',
);

const INCOME_RE = new RegExp(
  String.raw`^\s*(?:me\s+(?:entr[oó]|lleg[oó]|pagaron)|ingreso(?:\s+de)?|cobr[eé])\s+${AMOUNT}\s*(.*)$`,
  'i',
);

const SUMMARY_RE = /^\s*(?:resumen|saldo|saldos|balance|c[oó]mo voy)\s*\??\s*$/i;

function parseAmount(raw: string): number {
  return Math.round(parseFloat(raw.replace(',', '.')) * 100) / 100;
}

/**
 * Intenta resolver el mensaje sin IA. boxNames son las cajas activas del
 * usuario: el gasto solo matchea si la caja existe (si no, que decida el
 * agente — puede ser una nota libre o una caja mal escrita).
 */
export function parseFastPath(text: string, boxNames: string[]): FastPathResult {
  const clean = text.trim();

  if (SUMMARY_RE.test(clean)) return { kind: 'summary' };

  const expense = EXPENSE_RE.exec(clean);
  if (expense) {
    const amount = parseAmount(expense[1]);
    const rest = expense[2].trim();
    const box = boxNames.find((b) => b.toLowerCase() === rest.toLowerCase());
    if (box && amount > 0) {
      return { kind: 'expense', amount, boxName: box, note: box };
    }
    return null; // caja desconocida → agente
  }

  const income = INCOME_RE.exec(clean);
  if (income) {
    const amount = parseAmount(income[1]);
    if (amount > 0) {
      return { kind: 'income', amount, note: income[2]?.trim() || 'Ingreso' };
    }
  }

  return null;
}
