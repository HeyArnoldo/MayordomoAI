import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AgentToolsAuthGuard } from './agent-tools-auth.guard';

function makeCtx(headerValue?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: headerValue !== undefined ? { 'x-agent-tool-key': headerValue } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('AgentToolsAuthGuard', () => {
  let guard: AgentToolsAuthGuard;
  const ENV_KEY = 'AGENT_TOOL_INTERNAL_KEY';

  beforeEach(() => {
    guard = new AgentToolsAuthGuard();
  });

  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it('returns true when correct key is provided', () => {
    process.env[ENV_KEY] = 'my-secret-key';
    const ctx = makeCtx('my-secret-key');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws 401 when x-agent-tool-key header is missing', () => {
    process.env[ENV_KEY] = 'my-secret-key';
    const ctx = makeCtx(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws 401 when wrong key is provided', () => {
    process.env[ENV_KEY] = 'my-secret-key';
    const ctx = makeCtx('wrong-key');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws 401 (fail-closed) when AGENT_TOOL_INTERNAL_KEY env var is unset', () => {
    // Ensure env var is not set
    delete process.env[ENV_KEY];
    const ctx = makeCtx('any-key');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws 401 (fail-closed) when AGENT_TOOL_INTERNAL_KEY is empty string', () => {
    process.env[ENV_KEY] = '';
    const ctx = makeCtx('');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
