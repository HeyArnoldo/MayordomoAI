import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@app/contracts';
import { RolesGuard } from './roles.guard';
import { User } from '../../users/user.entity';

const makeCtx = (role?: UserRole, requiredRoles?: UserRole[]): ExecutionContext => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;

  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? ({ role } as Partial<User>) : undefined }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    _reflector: reflector,
  } as unknown as ExecutionContext;

  return ctx;
};

describe('RolesGuard', () => {
  it('returns true when no roles are required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.USER } }) }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns true when user has the required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.ADMIN } }) }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws AppException auth.forbidden when user lacks required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.USER } }) }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow(
      expect.objectContaining({ code: 'auth.forbidden' }),
    );
  });

  it('thrown exception has FORBIDDEN status', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.USER } }) }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
    try {
      guard.canActivate(ctx);
    } catch (e: unknown) {
      const ex = e as { getStatus: () => number };
      expect(ex.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });
});
