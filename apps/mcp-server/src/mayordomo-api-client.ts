import { config } from './config.js';
import type { CommonToolResponse } from './types.js';

const GENERIC_ERROR = 'The finance service rejected the request.';

/**
 * Posts to an internal /api/agent-tools/* endpoint and returns the response.
 * Sanitizes all errors — no secrets, stack traces, or internal hostnames are
 * ever included in the returned object.
 */
async function call(tool: string, body: unknown): Promise<CommonToolResponse<unknown>> {
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
    // Forward the i18n-safe error from the API if present; otherwise generic.
    const apiError =
      json !== null &&
      typeof json === 'object' &&
      'error' in (json as object) &&
      typeof (json as Record<string, unknown>)['error'] === 'string'
        ? (json as Record<string, unknown>)['error']
        : GENERIC_ERROR;
    return { ok: false, error: apiError as string };
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
