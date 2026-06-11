import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  AdminUser,
  IdParam,
  idParamSchema,
  UpdateUserRoleInput,
  updateUserRoleSchema,
  UpdateUserStatusInput,
  updateUserStatusSchema,
  UserRole,
  UserStatus,
} from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { AdminService } from './admin.service';

/**
 * Panel de administración. El rol se lee fresco de BD en cada request
 * (jwt.strategy hace findById), así que degradar un admin surte efecto
 * en su siguiente request — sin re-login.
 */
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Lista usuarios; ?status=pending para la cola de aprobación. */
  @Get()
  list(@Query('status') status?: string): Promise<AdminUser[]> {
    const parsed = Object.values(UserStatus).includes(status as UserStatus)
      ? (status as UserStatus)
      : undefined;
    return this.admin.list(parsed);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() actor: User,
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(updateUserStatusSchema)) input: UpdateUserStatusInput,
  ): Promise<AdminUser> {
    return this.admin.updateStatus(actor, params.id, input.status);
  }

  @Patch(':id/role')
  updateRole(
    @CurrentUser() actor: User,
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(updateUserRoleSchema)) input: UpdateUserRoleInput,
  ): Promise<AdminUser> {
    return this.admin.updateRole(actor, params.id, input.role);
  }
}
