import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@app/contracts';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppException } from '../errors/app.exception';
import { User } from '../../users/user.entity';

/** Verifica el rol del usuario. Va DESPUÉS de JwtAuthGuard en @UseGuards. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest<{ user?: User }>();
    if (!user || !required.includes(user.role)) {
      throw new AppException('auth.forbidden', HttpStatus.FORBIDDEN, 'Forbidden');
    }
    return true;
  }
}
