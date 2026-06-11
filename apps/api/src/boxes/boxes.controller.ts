import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import {
  AllocationInput,
  allocationSchema,
  Box as BoxDto,
  BoxBalance,
  CreateBoxInput,
  createBoxSchema,
  IdParam,
  idParamSchema,
  UpdateBoxInput,
  updateBoxSchema,
} from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveAccountGuard } from '../common/guards/active-account.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { BoxesService, toBoxDto } from './boxes.service';

@Controller('boxes')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class BoxesController {
  constructor(private readonly boxes: BoxesService) {}

  @Get()
  async findAll(@CurrentUser() user: User): Promise<BoxDto[]> {
    return (await this.boxes.findAll(user.id)).map(toBoxDto);
  }

  /** Cajas con asignado/gastado/saldo del mes contable — la vista del dashboard. */
  @Get('balances')
  balances(@CurrentUser() user: User): Promise<BoxBalance[]> {
    return this.boxes.withBalances(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createBoxSchema)) input: CreateBoxInput,
  ): Promise<BoxDto> {
    return toBoxDto(await this.boxes.create(user.id, input));
  }

  /** Reparto masivo de % — valida que el set personal activo sume 100. */
  @Put('allocation')
  async updateAllocation(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(allocationSchema)) input: AllocationInput,
  ): Promise<BoxDto[]> {
    return (await this.boxes.updateAllocation(user.id, input)).map(toBoxDto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
    @Body(new ZodValidationPipe(updateBoxSchema)) input: UpdateBoxInput,
  ): Promise<BoxDto> {
    return toBoxDto(await this.boxes.update(user.id, id, input));
  }
}
