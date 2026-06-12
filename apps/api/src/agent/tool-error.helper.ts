import type { Locale } from '@app/contracts';
import { AppException } from '../common/errors/app.exception';
import type { I18nService } from '../i18n/i18n.service';

/**
 * Converts a tool-layer error into a localized string suitable for
 * returning to the LLM as a tool error message.
 *
 * - AppException → looks up `errors:<code>` in the i18n errors namespace
 *   using the user's locale, so the LLM sees the same language the user
 *   is conversing in (closes the English-leak regression).
 * - Generic Error → returns err.message as-is (dev-facing, English).
 * - Unknown (string, etc.) → returns a generic fallback.
 */
export function toolErrorMessage(
  err: unknown,
  locale: Locale,
  i18n: Pick<I18nService, 't'>,
): string {
  if (err instanceof AppException) {
    return i18n.t(locale, `errors:${err.code}`, err.params ?? undefined);
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred';
}
