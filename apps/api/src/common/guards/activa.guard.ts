import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserEstado } from '@app/contracts';
import { User } from '../../users/user.entity';

/**
 * Allowlist: solo cuentas 'activa' usan el dominio (cajas, movimientos, chat).
 * Una cuenta nueva por Google queda 'pendiente' hasta que un admin la active.
 */
@Injectable()
export class ActivaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: User }>();
    if (req.user?.estado !== UserEstado.ACTIVA) {
      throw new ForbiddenException('Tu cuenta está pendiente de activación.');
    }
    return true;
  }
}
