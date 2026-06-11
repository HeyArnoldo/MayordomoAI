import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PendienteEstado } from '@app/contracts';
import { User } from '../users/user.entity';

/**
 * Aclaración pendiente del agente (adaptive clarification loop): lo dudoso
 * no se descarta — se acumula y se pregunta en una sola tanda. Expira para
 * no vivir colgado para siempre.
 */
@Entity('pendientes')
@Index(['userId', 'estado'])
export class Pendiente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  conversacionId: string | null;

  @Column({ type: 'varchar', length: 300 })
  descripcion: string;

  // Datos parciales del movimiento propuesto (monto, nota, candidatas, etc.)
  @Column({ type: 'jsonb', nullable: true })
  payload: unknown | null;

  @Column({ type: 'enum', enum: PendienteEstado, default: PendienteEstado.ABIERTO })
  estado: PendienteEstado;

  @Column({ type: 'timestamptz', nullable: true })
  expiraAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
