import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { ToolAudit as ToolAuditDto } from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveAccountGuard } from '../common/guards/active-account.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { ToolAudit } from './tool-audit.entity';

const listAuditsSchema = z.object({
  conversationId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/**
 * Reasoning trail: expone la auditoría de herramientas del agente para que
 * el dashboard muestre el razonamiento paso a paso (replayability).
 */
@Controller('agent')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class AgentController {
  constructor(@InjectRepository(ToolAudit) private readonly audits: Repository<ToolAudit>) {}

  @Get('audits')
  async list(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(listAuditsSchema))
    query: z.infer<typeof listAuditsSchema>,
  ): Promise<ToolAuditDto[]> {
    const rows = await this.audits.find({
      where: {
        userId: user.id,
        ...(query.conversationId ? { conversationId: query.conversationId } : {}),
      },
      order: { createdAt: 'DESC' },
      take: query.limit,
    });
    return rows.map((a) => ({
      id: a.id,
      tool: a.tool,
      args: a.args,
      result: a.result,
      conversationId: a.conversationId,
      createdAt: a.createdAt.toISOString(),
    }));
  }
}
