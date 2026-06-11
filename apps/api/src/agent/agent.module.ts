import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoxesModule } from '../boxes/boxes.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { ToolAudit } from './tool-audit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ToolAudit]), BoxesModule, TransactionsModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
