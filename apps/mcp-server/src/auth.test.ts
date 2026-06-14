/**
 * node:test unit tests for auth.ts — run after build:
 *   node --test dist/auth.test.js
 *
 * Tests import the REAL `isValidBearer` from auth.ts.
 * No env vars are required because isValidBearer is a pure function
 * that does not depend on config.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isValidBearer } from './auth.js';

const KNOWN_TOKEN = 'test-token-abc123';

describe('isValidBearer', () => {
  it('returns true when Authorization header matches Bearer token', () => {
    assert.equal(isValidBearer(`Bearer ${KNOWN_TOKEN}`, KNOWN_TOKEN), true);
  });

  it('returns false when Authorization header has wrong token', () => {
    assert.equal(isValidBearer('Bearer wrong', KNOWN_TOKEN), false);
  });

  it('returns false when Authorization header is missing (undefined)', () => {
    assert.equal(isValidBearer(undefined, KNOWN_TOKEN), false);
  });

  it('returns false when Authorization header is empty string', () => {
    assert.equal(isValidBearer('', KNOWN_TOKEN), false);
  });

  it('returns false when Authorization is not Bearer scheme', () => {
    assert.equal(isValidBearer('Basic dXNlcjpwYXNz', KNOWN_TOKEN), false);
  });

  it('returns false when provided token is empty (Bearer with no value)', () => {
    // "Bearer " → provided = "", expected = KNOWN_TOKEN → length mismatch → false
    assert.equal(isValidBearer('Bearer ', KNOWN_TOKEN), false);
  });
});
