import type { BoxBalance } from '@app/contracts';

/** Color de caja: las 8 del set conocido mapean a los tokens del design. */
const KNOWN = ['ahorro', 'varios', 'pasajes', 'ocio', 'diezmo', 'snacks', 'ofrenda', 'empresa'];

export function boxColor(name: string): string {
  const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return KNOWN.includes(slug) ? `var(--caja-${slug})` : 'var(--caja-varios)';
}

/** Alerta por excepción, como el design: sobregiro / agotada / queda poco. */
export function boxAlert(
  b: BoxBalance,
): { label: string; tone: 'danger' | 'warn' | 'muted' } | null {
  if (b.accumulated !== null) return null; // fondos no alertan
  if (b.balance < 0) return { label: 'Sobregiro', tone: 'danger' };
  if (b.balance === 0 && b.allocated > 0) return { label: 'Agotada', tone: 'muted' };
  if (b.allocated > 0 && b.spent / b.allocated >= 0.8) return { label: 'Queda poco', tone: 'warn' };
  return null;
}

export function monthLabel(date = new Date()): string {
  const label = date.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
