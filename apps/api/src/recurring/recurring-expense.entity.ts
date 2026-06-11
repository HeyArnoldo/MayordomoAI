import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Box } from '../boxes/box.entity';

/**
 * Gasto fijo mensual (línea celular, suscripciones, alquiler). NO se registra
 * solo: el cron recuerda por WhatsApp el día del vencimiento y el usuario
 * confirma — el sistema solo anota realidad.
 */
@Entity('recurring_expenses')
@Index(['userId', 'active'])
export class RecurringExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  // Día de vencimiento; en meses cortos se recuerda el último día (clamp).
  @Column({ type: 'int' })
  dayOfMonth: number;

  @Column({ type: 'uuid' })
  boxId: string;

  @ManyToOne(() => Box, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'boxId' })
  box: Box;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  // Último periodo (YYYY-MM, mes de Lima) en que se envió recordatorio. Dedup del cron.
  @Column({ type: 'varchar', length: 7, nullable: true })
  lastRemindedPeriod: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
