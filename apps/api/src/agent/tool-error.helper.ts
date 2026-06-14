import type { Locale } from '@app/contracts';
import { AppException } from '../common/errors/app.exception';
import type { I18nService } from '../i18n/i18n.service';

/** Static last-resort fallback when i18n is unavailable (should not happen in prod). */
const STATIC_FALLBACK = 'An unexpected error occurred';

/**
 * Converts a tool-layer error into a localized string suitable for
 * returning to the caller (LLM in-app, or external REST client).
 *
 * - AppException → looks up `errors:<code>` in the i18n errors namespace
 *   using the user's locale, so the caller sees the same language the user
 *   is conversing in (closes the English-leak regression).
 * - ANY other error (generic Error, QueryFailedError, string, etc.) →
 *   localized `errors:common.unexpected`, falling back to a static string
 *   only when i18n is absent. The raw `err.message` is NEVER returned to the
 *   caller — it may contain table/column/SQL/constraint details, which must
 *   not cross the external trust boundary. Callers are expected to log the
 *   real error server-side.
 */
export function toolErrorMessage(
  err: unknown,
  locale: Locale,
  i18n?: Pick<I18nService, 't'>,
): string {
  if (err instanceof AppException) {
    return i18n ? i18n.t(locale, `errors:${err.code}`, err.params ?? undefined) : err.message;
  }
  return i18n ? i18n.t(locale, 'errors:common.unexpected', undefined) : STATIC_FALLBACK;
}
