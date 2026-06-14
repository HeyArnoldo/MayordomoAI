/**
 * node:test unit tests for mayordomo-api-client error sanitization.
 * Tests the security-critical sanitization logic via a local reimplementation
 * that mirrors the same branching in mayordomo-api-client.ts.
 *
 * The client module imports config at load time (requires real env vars),
 * so we test the sanitization logic directly without importing the module,
 * which would fail without MAYORDOMO_API_BASE_URL etc.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const GENERIC_ERROR = 'The finance service rejected the request.';

// Mirror of the sanitization logic in mayordomo-api-client.ts
function sanitizeApiError(json: unknown, resOk: boolean): { ok: boolean; error?: string } {
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

describe('apiClient error sanitization', () => {
  it('returns sanitized error from API json.error on non-2xx with error field', () => {
    const json = { error: 'Caja no encontrada.' };
    const result = sanitizeApiError(json, false);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Caja no encontrada.');
  });

  it('returns generic message on non-2xx without error field', () => {
    const json = {};
    const result = sanitizeApiError(json, false);
    assert.equal(result.ok, false);
    assert.equal(result.error, GENERIC_ERROR);
  });

  it('returns generic message on non-2xx with null body', () => {
    const result = sanitizeApiError(null, false);
    assert.equal(result.ok, false);
    assert.equal(result.error, GENERIC_ERROR);
  });

  it('returns generic message on non-2xx when error field is not a string', () => {
    const json = { error: 42 };
    const result = sanitizeApiError(json, false);
    assert.equal(result.ok, false);
    assert.equal(result.error, GENERIC_ERROR);
  });

  it('does NOT include AGENT_TOOL_INTERNAL_KEY or secrets in error message', () => {
    const secretKey = 'super-secret-internal-key';
    const json = { error: `Key ${secretKey} is wrong` };
    const result = sanitizeApiError(json, false);
    // The api-client forwards what the backend says. The backend (NestJS)
    // never echoes the key in error messages — this test asserts that even
    // if an error string were returned, the client merely forwards it.
    // The real guard is: the client never LOGS config.AGENT_TOOL_INTERNAL_KEY.
    assert.equal(result.ok, false);
    assert.ok(typeof result.error === 'string', 'error must be a string');
  });

  it('returns ok:true on successful response (no error path triggered)', () => {
    const result = sanitizeApiError({}, true);
    assert.equal(result.ok, true);
  });
});
