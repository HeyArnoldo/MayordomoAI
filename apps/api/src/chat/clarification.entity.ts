import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClarificationStatus } from '@app/contracts';
import { User } from '../users/user.entity';

/**
 * Aclaración pendiente del agente (adaptive clarification loop): lo dudoso
 * no se descarta — se acumula y se pregunta en una sola tanda. Expira para
 * no vivir colgado para siempre.
 */
@Entity('clarifications')
@Index(['userId', 'status'])
export class Clarification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', length: 300 })
  description: string;

  // Datos parciales de la transacción propuesta (monto, nota, candidatas, etc.)
  @Column({ type: 'jsonb', nullable: true })
  payload: unknown | null;

  @Column({ type: 'enum', enum: ClarificationStatus, default: ClarificationStatus.OPEN })
  status: ClarificationStatus;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
