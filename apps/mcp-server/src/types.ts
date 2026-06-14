/**
 * Shared response wrapper — mirrors @app/contracts CommonToolResponse
 * but declared locally to avoid pulling zod v4 contracts into any
 * runtime path that the MCP SDK might validate against.
 */
export interface CommonToolResponse<T = unknown> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
  needsConfirmation?: boolean;
}
