import { Controller, Delete, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { cookieOptions, SESSION_COOKIE } from '../config/app.config';
import { User } from './user.entity';
import { UsersService } from './users.service';

/**
 * Controller SEPARADO de UsersController a propósito: aquel exige cuenta
 * ACTIVE, pero eliminar la cuenta debe poder hacerlo también un usuario
 * pendiente o suspendido (es su derecho, y libera su número).
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly users: UsersService) {}

  @Delete()
  async remove(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await this.users.deleteAccount(user);
    const { maxAge: _omit, ...clear } = cookieOptions();
    res.clearCookie(SESSION_COOKIE, clear);
    return { ok: true };
  }
}
