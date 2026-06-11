import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../agent/agent.module';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
// Stateless (REST + env): se provee aquí para el mic del chat web,
// igual que EvolutionClient en UsersModule.
import { TranscriptionService } from '../whatsapp/transcription.service';
import { ChatController } from './chat.controller';
import { Clarification } from './clarification.entity';
import { Conversation } from './conversation.entity';
import { ConversationsService } from './conversations.service';
import { Message } from './message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, Clarification]),
    AgentModule,
    AiUsageModule,
  ],
  controllers: [ChatController],
  providers: [ConversationsService, TranscriptionService],
  exports: [ConversationsService],
})
export class ChatModule {}
