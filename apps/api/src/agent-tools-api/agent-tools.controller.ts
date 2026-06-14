import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  CommonToolResponse,
  GetBoxBalancesInput,
  getBoxBalancesSchema,
  QueryTransactionsInput,
  queryTransactionsSchema,
  RegisterTransactionInput,
  registerTransactionSchema,
  toResponse,
} from '@app/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AgentToolExecutorService } from '../agent/agent-tool-executor.service';
import { AgentToolsAuthGuard } from './agent-tools-auth.guard';
import { AgentToolsContextService } from './agent-tools-context.service';

/**
 * Internal REST layer for agent tools.
 * Served at /api/agent-tools/* (global prefix applies).
 *
 * Auth: x-agent-tool-key header (AgentToolsAuthGuard).
 * Body: validated per-endpoint via ZodValidationPipe.
 * UserId: always resolved server-side from FOUNDRY_DEMO_USER_ID — never from caller.
 */
@Controller('agent-tools')
@UseGuards(AgentToolsAuthGuard)
export class AgentToolsController {
  constructor(
    private readonly executor: AgentToolExecutorService,
    private readonly ctxBuilder: AgentToolsContextService,
  ) {}

  @Post('get-box-balances')
  async getBoxBalances(
    @Req() req: Request,
    @Body(new ZodValidationPipe(getBoxBalancesSchema)) _body: GetBoxBalancesInput,
  ): Promise<CommonToolResponse<unknown>> {
    const ctx = await this.ctxBuilder.build(req);
    return toResponse(await this.executor.getBoxBalances(ctx));
  }

  @Post('query-transactions')
  async queryTransactions(
    @Req() req: Request,
    @Body(new ZodValidationPipe(queryTransactionsSchema)) body: QueryTransactionsInput,
  ): Promise<CommonToolResponse<unknown>> {
    const ctx = await this.ctxBuilder.build(req);
    return toResponse(await this.executor.queryTransactions(ctx, body));
  }

  @Post('register-transaction')
  async registerTransaction(
    @Req() req: Request,
    @Body(new ZodValidationPipe(registerTransactionSchema)) body: RegisterTransactionInput,
  ): Promise<CommonToolResponse<unknown>> {
    const ctx = await this.ctxBuilder.build(req);
    return toResponse(await this.executor.registerTransaction(ctx, body));
  }
}
