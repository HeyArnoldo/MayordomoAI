import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoxesModule } from '../boxes/boxes.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { UsersModule } from '../users/users.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentToolExecutorService } from './agent-tool-executor.service';
import { ToolAudit } from './tool-audit.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ToolAudit]),
    BoxesModule,
    TransactionsModule,
    AiUsageModule,
    UsersModule,
  ],
  controllers: [AgentController],
  providers: [AgentService, AgentToolExecutorService],
  exports: [AgentService, AgentToolExecutorService],
})
export class AgentModule {}
