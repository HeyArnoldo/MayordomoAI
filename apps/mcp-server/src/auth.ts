import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { getConfig } from './config.js';

/**
 * Pure bearer-validation function — no config dependency.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * Returns true only when:
 *   - authHeader is a string
 *   - it starts with "Bearer "
 *   - the token part equals `expectedToken` (constant-time)
 */
export function isValidBearer(authHeader: string | undefined, expectedToken: string): boolean {
  if (typeof authHeader !== 'string') return false;

  const prefix = 'Bearer ';
  if (!authHeader.startsWith(prefix)) return false;

  const provided = authHeader.slice(prefix.length);

  // Constant-time compare — buffers must be the same length or timingSafeEqual throws.
  const a = Buffer.from(provided);
  const b = Buffer.from(expectedToken);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Validates the Authorization: Bearer <token> header against MCP_AUTH_TOKEN.
 * Never logs the header value or the token.
 */
export function checkBearer(req: IncomingMessage): boolean {
  return isValidBearer(req.headers['authorization'], getConfig().MCP_AUTH_TOKEN);
}
