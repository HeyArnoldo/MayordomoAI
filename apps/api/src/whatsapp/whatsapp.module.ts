import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhoneNumber } from '../users/phone-number.entity';
import { BoxesModule } from '../boxes/boxes.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AgentModule } from '../agent/agent.module';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { ChatModule } from '../chat/chat.module';
import { RecurringModule } from '../recurring/recurring.module';
import { WaInboundLog } from './wa-inbound-log.entity';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { EvolutionClient } from './evolution.client';
import { TranscriptionService } from './transcription.service';
import { RecurringReminderService } from './recurring-reminder.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaInboundLog, PhoneNumber]),
    BoxesModule,
    TransactionsModule,
    AgentModule,
    AiUsageModule,
    ChatModule,
    RecurringModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, EvolutionClient, TranscriptionService, RecurringReminderService],
})
export class WhatsappModule {}
