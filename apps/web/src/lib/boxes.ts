import type { BoxBalance, BoxColorKey } from '@app/contracts';
import { BOX_COLOR_KEYS } from '@app/contracts';

/**
 * Color de caja: el colorKey elegido por el usuario manda; sin él, las 8 del
 * set conocido mapean por nombre a los tokens del design. Siempre CSS vars —
 * se adaptan solas al modo oscuro.
 */
export function boxColor(name: string, colorKey?: BoxColorKey | null): string {
  if (colorKey) return `var(--caja-${colorKey})`;
  const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return (BOX_COLOR_KEYS as readonly string[]).includes(slug)
    ? `var(--caja-${slug})`
    : 'var(--caja-varios)';
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
