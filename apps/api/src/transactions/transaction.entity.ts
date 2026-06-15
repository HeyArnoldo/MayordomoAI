import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SplitItem, TransactionSource, TransactionStatus, TransactionType } from '@app/contracts';
import { Box } from '../boxes/box.entity';
import { User } from '../users/user.entity';

/**
 * Movimiento de dinero. Regla de oro: el saldo NUNCA se almacena — se calcula
 * con SUM() sobre las transacciones confirmadas del periodo. Anular es soft
 * delete (status='voided'), jamás borrado físico: es data financiera.
 */
@Entity('transactions')
@Index(['userId', 'date'])
@Index(['userId', 'boxId', 'date'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  // Null en ingresos (se reparten por %).
  @Column({ type: 'uuid', nullable: true })
  boxId: string | null;

  @ManyToOne(() => Box, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'boxId' })
  box: Box | null;

  // numeric(12,2) — nunca float para dinero. TypeORM lo expone como string.
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3, default: 'PEN' })
  currency: string;

  // Fecha CONTABLE en America/Lima (un gasto 11:58pm cuenta para ese día).
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @Column({ type: 'varchar', length: 300, nullable: true })
  note: string | null;

  @Column({ type: 'enum', enum: TransactionSource })
  source: TransactionSource;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.CONFIRMED })
  status: TransactionStatus;

  // Snapshot del reparto por % al momento del ingreso: cambiar % después
  // no reescribe la historia.
  @Column({ type: 'jsonb', nullable: true })
  split: SplitItem[] | null;

  // Registrado desde una nota de voz (se muestra el ícono de mic).
  @Column({ type: 'boolean', default: false })
  voice: boolean;

  // Idempotencia del webhook: un mensaje de WhatsApp = una transacción máx.
  @Column({ type: 'varchar', length: 120, nullable: true, unique: true })
  waMessageId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
