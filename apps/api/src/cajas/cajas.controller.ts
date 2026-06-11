import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import {
  Caja as CajaDto,
  CajaSaldo,
  CreateCajaInput,
  createCajaSchema,
  IdParam,
  idParamSchema,
  RepartoInput,
  repartoSchema,
  UpdateCajaInput,
  updateCajaSchema,
} from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivaGuard } from '../common/guards/activa.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { CajasService, toCajaDto } from './cajas.service';

@Controller('cajas')
@UseGuards(JwtAuthGuard, ActivaGuard)
export class CajasController {
  constructor(private readonly cajas: CajasService) {}

  @Get()
  async findAll(@CurrentUser() user: User): Promise<CajaDto[]> {
    return (await this.cajas.findAll(user.id)).map(toCajaDto);
  }

  /** Cajas con asignado/gastado/saldo del mes contable — la vista del dashboard. */
  @Get('saldo')
  saldo(@CurrentUser() user: User): Promise<CajaSaldo[]> {
    return this.cajas.conSaldo(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createCajaSchema)) input: CreateCajaInput,
  ): Promise<CajaDto> {
    return toCajaDto(await this.cajas.create(user.id, input));
  }

  /** Reparto masivo de % — valida que el set personal activo sume 100. */
  @Put('reparto')
  async reparto(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(repartoSchema)) input: RepartoInput,
  ): Promise<CajaDto[]> {
    return (await this.cajas.reparto(user.id, input)).map(toCajaDto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
    @Body(new ZodValidationPipe(updateCajaSchema)) input: UpdateCajaInput,
  ): Promise<CajaDto> {
    return toCajaDto(await this.cajas.update(user.id, id, input));
  }
}
