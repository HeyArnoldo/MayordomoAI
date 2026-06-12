import { z } from 'zod';

/** Idiomas soportados por la app (UI, WhatsApp y agente). */
export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';
export const localeSchema = z.enum(SUPPORTED_LOCALES);

/**
 * Lista curada de monedas (no las ~180 ISO 4217). Una sola moneda por usuario;
 * cambiarla NO convierte montos históricos.
 */
export const SUPPORTED_CURRENCIES = [
  'PEN',
  'USD',
  'EUR',
  'MXN',
  'COP',
  'ARS',
  'CLP',
  'BRL',
  'BOB',
  'UYU',
  'PYG',
  'GBP',
] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'USD';
export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

/** NULL en DB = "nunca eligió": se muestra USD y queda abierta a derivación por teléfono. */
export function resolveCurrency(currency: string | null | undefined): string {
  return currency ?? DEFAULT_CURRENCY;
}

/** es-* → es; en-* y cualquier otro idioma → en. Único criterio para registro y pre-login. */
export function mapBrowserLanguage(lang: string | null | undefined): Locale {
  return lang?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/**
 * Prefijos E.164 → moneda de la lista curada. Solo países cuya moneda soportamos;
 * un prefijo no mapeado no deriva nada (el usuario queda en NULL ⇒ USD).
 * +1 cubre USA/Canadá/Caribe → USD, limitación aceptada.
 */
export const PHONE_PREFIX_TO_CURRENCY: Readonly<Record<string, Currency>> = {
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
  // Eurozona
  '+30': 'EUR', // Grecia
  '+31': 'EUR', // Países Bajos
  '+32': 'EUR', // Bélgica
  '+33': 'EUR', // Francia
  '+34': 'EUR', // España
  '+39': 'EUR', // Italia
  '+43': 'EUR', // Austria
  '+49': 'EUR', // Alemania
  '+351': 'EUR', // Portugal
  '+352': 'EUR', // Luxemburgo
  '+353': 'EUR', // Irlanda
  '+356': 'EUR', // Malta
  '+357': 'EUR', // Chipre
  '+358': 'EUR', // Finlandia
  '+370': 'EUR', // Lituania
  '+371': 'EUR', // Letonia
  '+372': 'EUR', // Estonia
  '+385': 'EUR', // Croacia
  '+386': 'EUR', // Eslovenia
  '+421': 'EUR', // Eslovaquia
};

// Largo descendente: los prefijos E.164 tienen largo variable (+1, +51, +595)
// y el match debe ser por el más específico.
const PREFIXES_BY_LENGTH = Object.keys(PHONE_PREFIX_TO_CURRENCY).sort(
  (a, b) => b.length - a.length,
);

/** Deriva la moneda del país del número. Null si el prefijo no está mapeado. */
export function deriveCurrencyFromE164(e164: string): Currency | null {
  const prefix = PREFIXES_BY_LENGTH.find((p) => e164.startsWith(p));
  return prefix ? (PHONE_PREFIX_TO_CURRENCY[prefix] ?? null) : null;
}

/** Cambio de idioma/moneda desde Configuración o la tool del agente. */
export const updatePreferencesSchema = z
  .object({
    language: localeSchema.optional(),
    currency: currencySchema.optional(),
  })
  .refine((v) => v.language !== undefined || v.currency !== undefined, {
    message: 'Nada que actualizar',
  });
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
