import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { UserStatus } from '@app/contracts';
import { ActiveAccountGuard } from './active-account.guard';
import { User } from '../../users/user.entity';

const makeCtx = (status?: UserStatus): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user: status ? ({ status } as Partial<User>) : undefined }),
    }),
  }) as unknown as ExecutionContext;

describe('ActiveAccountGuard', () => {
  const guard = new ActiveAccountGuard();

  it('returns true for an active user', () => {
    expect(guard.canActivate(makeCtx(UserStatus.ACTIVE))).toBe(true);
  });

  it('throws AppException account.pending_activation for a pending user', () => {
    expect(() => guard.canActivate(makeCtx(UserStatus.PENDING))).toThrow(
      expect.objectContaining({ code: 'account.pending_activation' }),
    );
  });

  it('thrown exception has FORBIDDEN status', () => {
    let caught: { getStatus: () => number } | undefined;
    try {
      guard.canActivate(makeCtx(UserStatus.PENDING));
    } catch (e: unknown) {
      caught = e as { getStatus: () => number };
    }
    expect(caught?.getStatus()).toBe(HttpStatus.FORBIDDEN);
  });

  it('throws when user is undefined', () => {
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(
      expect.objectContaining({ code: 'account.pending_activation' }),
    );
  });
});
