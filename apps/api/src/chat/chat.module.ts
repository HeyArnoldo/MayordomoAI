import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../agent/agent.module';
import { ChatController } from './chat.controller';
import { Clarification } from './clarification.entity';
import { Conversation } from './conversation.entity';
import { ConversationsService } from './conversations.service';
import { Message } from './message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, Clarification]), AgentModule],
  controllers: [ChatController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ChatModule {}
