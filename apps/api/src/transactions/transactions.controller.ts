import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  CreateTransactionInput,
  createTransactionSchema,
  IdParam,
  idParamSchema,
  ListTransactionsInput,
  listTransactionsSchema,
  Transaction as TransactionDto,
  TransactionSource,
} from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveAccountGuard } from '../common/guards/active-account.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { TransactionsService, toTransactionDto } from './transactions.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(listTransactionsSchema)) filters: ListTransactionsInput,
  ): Promise<TransactionDto[]> {
    return (await this.transactions.list(user.id, filters)).map(toTransactionDto);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
  ): Promise<TransactionDto> {
    return toTransactionDto(await this.transactions.findOne(user.id, id));
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createTransactionSchema)) input: CreateTransactionInput,
  ): Promise<TransactionDto> {
    return toTransactionDto(await this.transactions.create(user.id, input, TransactionSource.PWA));
  }

  /** Anula (soft delete) — la transacción queda visible como 'voided'. */
  @Delete(':id')
  async void(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
  ): Promise<TransactionDto> {
    return toTransactionDto(await this.transactions.void(user.id, id));
  }
}
