import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Canal } from '@app/contracts';
import { User } from '../users/user.entity';

/**
 * Sesión de conversación con el agente. El hilo de WhatsApp es único por
 * usuario, de sistema y fijado; las sesiones web se crean libremente
 * (estilo ChatGPT) y comparten el mismo agente.
 */
@Entity('conversaciones')
@Index(['userId', 'lastAt'])
export class Conversacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: Canal })
  canal: Canal;

  @Column({ type: 'varchar', length: 120, default: 'Nueva conversación' })
  titulo: string;

  @Column({ type: 'boolean', default: false })
  sistema: boolean;

  @Column({ type: 'boolean', default: false })
  fijada: boolean;

  @Column({ type: 'boolean', default: true })
  abierta: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
