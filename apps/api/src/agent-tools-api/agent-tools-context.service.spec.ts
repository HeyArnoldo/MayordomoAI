import { HttpStatus } from '@nestjs/common';
import { AgentToolsContextService } from './agent-tools-context.service';

const ENV_KEY = 'FOUNDRY_DEMO_USER_ID';

const makeUser = (overrides?: object) => ({
  id: 'demo-user-id',
  language: 'es' as const,
  currency: 'PEN',
  ...overrides,
});

const makeUsersService = (user?: ReturnType<typeof makeUser> | null) => ({
  findById: jest.fn().mockResolvedValue(user === undefined ? makeUser() : user),
});

const makeI18n = () => ({
  t: jest.fn().mockReturnValue('translated'),
});

function makeService(
  users?: ReturnType<typeof makeUsersService>,
  i18n?: ReturnType<typeof makeI18n>,
) {
  return new AgentToolsContextService(
    (users ?? makeUsersService()) as never,
    (i18n ?? makeI18n()) as never,
  );
}

function makeRequest(headers: Record<string, string> = {}): unknown {
  return { headers };
}

describe('AgentToolsContextService', () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  describe('userId resolution', () => {
    it('reads userId from FOUNDRY_DEMO_USER_ID env, not from request', async () => {
      process.env[ENV_KEY] = 'demo-user-id';
      const users = makeUsersService();
      const svc = makeService(users);

      // body/headers userId is ignored — we do not pass it in the request shape
      const ctx = await svc.build(makeRequest() as never);

      expect(ctx.userId).toBe('demo-user-id');
      expect(users.findById).toHaveBeenCalledWith('demo-user-id');
    });

    it('ignores any userId field that might appear in request headers', async () => {
      process.env[ENV_KEY] = 'demo-user-id';
      const users = makeUsersService();
      const svc = makeService(users);

      // Even if someone sneaks userId into custom headers, it must be ignored
      const ctx = await svc.build(makeRequest({ 'x-user-id': 'attacker-id' }) as never);

      expect(ctx.userId).toBe('demo-user-id');
      expect(users.findById).not.toHaveBeenCalledWith('attacker-id');
    });
  });

  describe('locale and currency', () => {
    it('derives locale from loaded user language', async () => {
      process.env[ENV_KEY] = 'demo-user-id';
      const user = makeUser({ language: 'en', currency: 'USD' });
      const svc = makeService(makeUsersService(user));

      const ctx = await svc.build(makeRequest() as never);

      expect(ctx.locale).toBe('en');
      expect(ctx.currency).toBe('USD');
    });

    it('applies resolveCurrency for null currency (falls back to default)', async () => {
      process.env[ENV_KEY] = 'demo-user-id';
      const user = makeUser({ language: 'es', currency: null });
      const svc = makeService(makeUsersService(user));

      const ctx = await svc.build(makeRequest() as never);

      // resolveCurrency(null) should return a non-null default currency string
      expect(ctx.currency).toBeDefined();
      expect(typeof ctx.currency).toBe('string');
      expect(ctx.currency.length).toBeGreaterThan(0);
    });
  });

  describe('conversationId', () => {
    it('is null when no x-conversation-id header is present', async () => {
      process.env[ENV_KEY] = 'demo-user-id';
      const svc = makeService();

      const ctx = await svc.build(makeRequest() as never);

      expect(ctx.conversationId).toBeNull();
    });

    it('is null when x-conversation-id is not a valid uuid', async () => {
      process.env[ENV_KEY] = 'demo-user-id';
      const svc = makeService();

      const ctx = await svc.build(makeRequest({ 'x-conversation-id': 'foundry-demo' }) as never);

      expect(ctx.conversationId).toBeNull();
    });

    it('is the uuid string when x-conversation-id is a valid uuid', async () => {
      process.env[ENV_KEY] = 'demo-user-id';
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const svc = makeService();

      const ctx = await svc.build(makeRequest({ 'x-conversation-id': validUuid }) as never);

      expect(ctx.conversationId).toBe(validUuid);
    });

    it('is the uuid string when x-foundry-thread-id is a valid uuid', async () => {
      process.env[ENV_KEY] = 'demo-user-id';
      const validUuid = '123e4567-e89b-12d3-a456-426614174001';
      const svc = makeService();

      const ctx = await svc.build(makeRequest({ 'x-foundry-thread-id': validUuid }) as never);

      expect(ctx.conversationId).toBe(validUuid);
    });
  });

  describe('error cases', () => {
    it('throws SERVICE_UNAVAILABLE when FOUNDRY_DEMO_USER_ID is not set', async () => {
      delete process.env[ENV_KEY];
      const svc = makeService();

      await expect(svc.build(makeRequest() as never)).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('throws SERVICE_UNAVAILABLE when configured demo user does not exist in DB', async () => {
      process.env[ENV_KEY] = 'nonexistent-user-id';
      const users = makeUsersService(null);
      const svc = makeService(users);

      await expect(svc.build(makeRequest() as never)).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });
  });
});
