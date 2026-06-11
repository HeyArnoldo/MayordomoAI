import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Auditoría de cada herramienta que llama el agente: qué, con qué argumentos
 * y qué devolvió. Es el "reasoning trail" visible en el dashboard y la
 * evidencia de Reliability & Safety.
 */
@Entity('tool_audits')
@Index(['userId', 'createdAt'])
export class ToolAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', length: 80 })
  tool: string;

  @Column({ type: 'jsonb' })
  args: unknown;

  @Column({ type: 'jsonb', nullable: true })
  result: unknown | null;

  @CreateDateColumn()
  createdAt: Date;
}
