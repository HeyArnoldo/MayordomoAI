import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channel, MessageRole } from '@app/contracts';
import { Conversation } from './conversation.entity';

/**
 * Mensaje de un hilo. Se registra TODO (entrante y respuesta, WhatsApp y web)
 * desde el día 1: el historial unificado del dashboard solo lee de acá.
 */
@Entity('messages')
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column({ type: 'enum', enum: MessageRole })
  role: MessageRole;

  @Column({ type: 'text' })
  content: string;

  // Canal por el que entró/salió este mensaje (badge WhatsApp/Web en la UI).
  @Column({ type: 'enum', enum: Channel })
  channel: Channel;

  @Column({ type: 'jsonb', nullable: true })
  toolCalls: unknown | null;

  @CreateDateColumn()
  createdAt: Date;
}
