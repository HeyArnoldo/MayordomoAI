import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoxesModule } from '../boxes/boxes.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { RecurringModule } from '../recurring/recurring.module';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { ToolAudit } from './tool-audit.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ToolAudit]),
    BoxesModule,
    TransactionsModule,
    RecurringModule,
    AiUsageModule,
  ],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
