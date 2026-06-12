import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { UserStatus } from '@app/contracts';
import { AppException } from '../errors/app.exception';
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
      throw new AppException(
        'account.pending_activation',
        HttpStatus.FORBIDDEN,
        'Account pending activation',
      );
    }
    return true;
  }
}
