import type { Locale } from '@app/contracts';

/**
 * Canonical BCP-47 locale for Intl formatting, keyed by app locale.
 *
 * es-PE chosen for number/currency formatting conventions (sol as default currency);
 * adjust if a different Spanish region becomes primary.
 *
 * All BCP-47 locale tags used for Intl formatting MUST be defined here and only here.
 * No other file in the codebase may hardcode a BCP-47 tag for formatting purposes.
 */
export function getIntlLocale(language: Locale): string {
  // es-PE chosen for number/currency formatting conventions (sol as default currency);
  // adjust if a different Spanish region becomes primary.
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
