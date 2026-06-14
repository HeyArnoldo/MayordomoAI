import { getConfig } from './config.js';
import type { CommonToolResponse } from './types.js';

const GENERIC_ERROR = 'The finance service rejected the request.';

/**
 * Converts a non-2xx API response body into a safe `{ ok: false, error }` shape.
 * Exported so it can be unit-tested without a live config/network.
 *
 * - If `json` has a string `error` field, that value is forwarded (i18n-safe).
 * - Otherwise the generic fallback message is used.
 * - On a successful response (resOk === true) returns `{ ok: true }`.
 */
export function sanitizeApiError(json: unknown, resOk: boolean): { ok: boolean; error?: string } {
  if (resOk) return { ok: true };

  const apiError =
    json !== null &&
    typeof json === 'object' &&
    'error' in (json as object) &&
    typeof (json as Record<string, unknown>)['error'] === 'string'
      ? (json as Record<string, unknown>)['error']
      : GENERIC_ERROR;

  return { ok: false, error: apiError as string };
}

/**
 * Posts to an internal /api/agent-tools/* endpoint and returns the response.
 * Sanitizes all errors — no secrets, stack traces, or internal hostnames are
 * ever included in the returned object.
 */
async function call(tool: string, body: unknown): Promise<CommonToolResponse<unknown>> {
  const config = getConfig();

  let res: Response;
  try {
    res = await fetch(`${config.MAYORDOMO_API_BASE_URL}/api/agent-tools/${tool}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Never log this header — it is a secret.
        'x-agent-tool-key': config.AGENT_TOOL_INTERNAL_KEY,
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    // Network error — sanitized, no hostnames or secrets in message.
    return { ok: false, error: GENERIC_ERROR };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  if (!res.ok) {
    return sanitizeApiError(json, false) as CommonToolResponse<unknown>;
  }

  return json as CommonToolResponse<unknown>;
}

export const apiClient = {
  getBoxBalances: (): Promise<CommonToolResponse<unknown>> => call('get-box-balances', {}),

  queryTransactions: (args: Record<string, unknown>): Promise<CommonToolResponse<unknown>> =>
    call('query-transactions', args),

  registerTransaction: (args: Record<string, unknown>): Promise<CommonToolResponse<unknown>> =>
    call('register-transaction', args),
};
