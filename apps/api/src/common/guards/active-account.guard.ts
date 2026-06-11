import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserStatus } from '@app/contracts';
import { User } from '../../users/user.entity';

/**
 * Allowlist: solo cuentas 'active' usan el dominio (boxes, transactions, chat).
 * Una cuenta nueva por Google queda 'pending' hasta que un admin la active.
 */
@Injectable()
export class ActiveAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: User }>();
    if (req.user?.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Tu cuenta está pendiente de activación.');
    }
    return true;
  }
}
