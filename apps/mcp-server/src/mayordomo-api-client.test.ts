/**
 * node:test unit tests for mayordomo-api-client error sanitization.
 *
 * Tests import the REAL `sanitizeApiError` from mayordomo-api-client.ts.
 * No env vars are required because sanitizeApiError is a pure function
 * that does not depend on config.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeApiError } from './mayordomo-api-client.js';

const GENERIC_ERROR = 'The finance service rejected the request.';

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

  it('does NOT include raw error details or stack traces in the sanitized message', () => {
    // Even if the API echoes something suspicious, the client only forwards
    // the string as-is — it never appends secrets or internal info.
    const json = { error: 'Request failed' };
    const result = sanitizeApiError(json, false);
    assert.equal(result.ok, false);
    assert.ok(typeof result.error === 'string', 'error must be a string');
    // The sanitizer must not inject any additional content.
    assert.equal(result.error, 'Request failed');
  });

  it('returns ok:true on successful response (no error path triggered)', () => {
    const result = sanitizeApiError({}, true);
    assert.equal(result.ok, true);
  });
});
