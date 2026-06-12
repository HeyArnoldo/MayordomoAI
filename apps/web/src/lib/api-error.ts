import { isAxiosError } from 'axios';
import i18next from 'i18next';
import type { ApiError } from '@app/contracts';

/** Fallback translation key for all unknown or missing codes. */
const FALLBACK_KEY = 'errors:server.internal_error';

/**
 * Resolves the `code` from an unknown error (axios response, AI SDK stream error,
 * or anything else) and returns a user-facing translated string.
 *
 * Resolution order:
 *  1. Axios error with a `code` in the response body   → `t('errors:<code>')`
 *  2. AI SDK / useChat error whose `message` is a JSON string with `code`  → same
 *  3. ZodValidationPipe 400 shape (`{ statusCode, message: string[], error }`)
 *     → first validation message string (no `code` field), as-is (dev message)
 *  4. Anything else → `t('errors:server.internal_error')`
 */
export function translateApiError(err: unknown): string {
  // --- Axios error ---
  if (isAxiosError(err)) {
    const data = err.response?.data as Partial<ApiError & { message: unknown }> | undefined;

    if (data) {
      // AppException shape: { statusCode, code, message, params? }
      if (typeof data.code === 'string') {
        return i18next.t(`errors:${data.code}`, {
          ...(data.params ?? {}),
          defaultValue: i18next.t(FALLBACK_KEY),
        });
      }

      // ZodValidationPipe shape: { statusCode, message: string[], error }
      // No `code` field — keep existing behavior: show first validation message.
      if (Array.isArray(data.message) && data.message.length > 0) {
        return String(data.message[0]);
      }

      // Codeless body with a plain string message (e.g. a legacy 500 fallback):
      // do not leak the raw English string — route to the generic translated fallback.
    }
  }

  // --- AI SDK / useChat error: message carries the raw JSON response body ---
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message) as Partial<ApiError>;
      if (typeof parsed.code === 'string') {
        return i18next.t(`errors:${parsed.code}`, {
          ...(parsed.params ?? {}),
          defaultValue: i18next.t(FALLBACK_KEY),
        });
      }
    } catch {
      // message is not JSON — fall through to generic fallback
    }
  }

  return i18next.t(FALLBACK_KEY);
}
