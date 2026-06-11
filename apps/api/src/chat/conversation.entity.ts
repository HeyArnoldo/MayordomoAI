import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channel } from '@app/contracts';
import { User } from '../users/user.entity';

/**
 * Sesión de conversación con el agente. El hilo de WhatsApp es único por
 * usuario, de sistema y fijado; las sesiones web se crean libremente
 * (estilo ChatGPT) y comparten el mismo agente.
 */
@Entity('conversations')
@Index(['userId', 'lastAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: Channel })
  channel: Channel;

  @Column({ type: 'varchar', length: 120, default: 'Nueva conversación' })
  title: string;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ type: 'boolean', default: false })
  pinned: boolean;

  @Column({ type: 'boolean', default: true })
  open: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
