import type { IncomingMessage } from 'node:http';
import { config } from './config.js';

/**
 * Validates the Authorization: Bearer <token> header against MCP_AUTH_TOKEN.
 * Returns true if the bearer matches, false otherwise.
 * Never logs the header value or the token.
 */
export function checkBearer(req: IncomingMessage): boolean {
  const header = req.headers['authorization'];
  if (typeof header !== 'string') return false;
  return header === `Bearer ${config.MCP_AUTH_TOKEN}`;
}
