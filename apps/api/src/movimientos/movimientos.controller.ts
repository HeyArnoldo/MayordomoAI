import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  CreateMovimientoInput,
  createMovimientoSchema,
  IdParam,
  idParamSchema,
  ListMovimientosInput,
  listMovimientosSchema,
  MovOrigen,
  Movimiento as MovimientoDto,
} from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivaGuard } from '../common/guards/activa.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { MovimientosService, toMovDto } from './movimientos.service';

@Controller('movimientos')
@UseGuards(JwtAuthGuard, ActivaGuard)
export class MovimientosController {
  constructor(private readonly movs: MovimientosService) {}

  @Get()
  async listar(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(listMovimientosSchema)) filtros: ListMovimientosInput,
  ): Promise<MovimientoDto[]> {
    return (await this.movs.listar(user.id, filtros)).map(toMovDto);
  }

  @Get(':id')
  async detalle(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
  ): Promise<MovimientoDto> {
    return toMovDto(await this.movs.detalle(user.id, id));
  }

  @Post()
  async crear(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createMovimientoSchema)) input: CreateMovimientoInput,
  ): Promise<MovimientoDto> {
    return toMovDto(await this.movs.crear(user.id, input, MovOrigen.PWA));
  }

  /** Anula (soft delete) — el movimiento queda visible como 'anulado'. */
  @Delete(':id')
  async anular(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
  ): Promise<MovimientoDto> {
    return toMovDto(await this.movs.anular(user.id, id));
  }
}
