import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Guards /api/agent-tools/* endpoints with a shared internal key.
 *
 * Callers (e.g. the MCP server) must send:
 *   x-agent-tool-key: <AGENT_TOOL_INTERNAL_KEY>
 *
 * Fail-closed: if the env var is unset or empty, ALL requests are rejected (401).
 * The key is never logged.
 */
@Injectable()
export class AgentToolsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-agent-tool-key'];
    const expected = process.env.AGENT_TOOL_INTERNAL_KEY;

    // Fail-closed: reject if env var is missing/empty, header is missing,
    // or they do not match.
    if (!expected || !provided || provided !== expected) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
