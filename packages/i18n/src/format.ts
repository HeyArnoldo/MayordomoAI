import type { Locale } from '@app/contracts';

/** Locale BCP 47 para Intl según el idioma del usuario. */
export function getIntlLocale(language: Locale): string {
  return language === 'es' ? 'es-PE' : 'en-US';
}

/**
 * Formato de moneda centralizado: símbolo, posición y decimales salen de Intl
 * (CLP/PYG sin decimales gratis). Reemplaza todo `'S/' + toFixed(2)` manual.
 */
export function formatMoney(amount: number, currency: string, language: Locale): string {
  return new Intl.NumberFormat(getIntlLocale(language), {
    style: 'currency',
    currency,
  }).format(amount);
}
