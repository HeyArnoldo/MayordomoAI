import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Canal, MensajeRol } from '@app/contracts';
import { Conversacion } from './conversacion.entity';

/**
 * Mensaje de un hilo. Se registra TODO (entrante y respuesta, WhatsApp y web)
 * desde el día 1: el historial unificado del dashboard solo lee de acá.
 */
@Entity('mensajes')
@Index(['conversacionId', 'createdAt'])
export class Mensaje {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversacionId: string;

  @ManyToOne(() => Conversacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversacionId' })
  conversacion: Conversacion;

  @Column({ type: 'enum', enum: MensajeRol })
  rol: MensajeRol;

  @Column({ type: 'text' })
  contenido: string;

  // Canal por el que entró/salió este mensaje (badge WhatsApp/Web en la UI).
  @Column({ type: 'enum', enum: Canal })
  canal: Canal;

  @Column({ type: 'jsonb', nullable: true })
  toolCalls: unknown | null;

  @CreateDateColumn()
  createdAt: Date;
}
