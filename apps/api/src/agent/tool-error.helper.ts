import type { Locale } from '@app/contracts';
import { AppException } from '../common/errors/app.exception';
import type { I18nService } from '../i18n/i18n.service';

/** Static last-resort fallback when i18n is unavailable (should not happen in prod). */
const STATIC_FALLBACK = 'An unexpected error occurred';

/**
 * Converts a tool-layer error into a localized string suitable for
 * returning to the LLM as a tool error message.
 *
 * - AppException → looks up `errors:<code>` in the i18n errors namespace
 *   using the user's locale, so the LLM sees the same language the user
 *   is conversing in (closes the English-leak regression).
 * - Generic Error → returns err.message as-is (dev-facing, English).
 * - Unknown (string, etc.) → localized `errors:common.unexpected`, falling
 *   back to a static English string only when i18n is absent.
 */
export function toolErrorMessage(
  err: unknown,
  locale: Locale,
  i18n?: Pick<I18nService, 't'>,
): string {
  if (err instanceof AppException) {
    return i18n ? i18n.t(locale, `errors:${err.code}`, err.params ?? undefined) : err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return i18n ? i18n.t(locale, 'errors:common.unexpected', undefined) : STATIC_FALLBACK;
}
