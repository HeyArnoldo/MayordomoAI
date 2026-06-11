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
import { MovEstado, MovOrigen, MovTipo, SplitItem } from '@app/contracts';
import { Caja } from '../cajas/caja.entity';
import { User } from '../users/user.entity';

/**
 * Movimiento de dinero. Regla de oro: el saldo NUNCA se almacena — se calcula
 * con SUM() sobre los movimientos confirmados del periodo. Anular es soft
 * delete (estado='anulado'), jamás borrado físico: es data financiera.
 */
@Entity('movimientos')
@Index(['userId', 'fecha'])
@Index(['userId', 'cajaId', 'fecha'])
export class Movimiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: MovTipo })
  tipo: MovTipo;

  // Null en ingresos (se reparten por %) y tránsito.
  @Column({ type: 'uuid', nullable: true })
  cajaId: string | null;

  @ManyToOne(() => Caja, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cajaId' })
  caja: Caja | null;

  // numeric(12,2) — nunca float para dinero. TypeORM lo expone como string.
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  monto: string;

  @Column({ type: 'varchar', length: 3, default: 'PEN' })
  moneda: string;

  // Fecha CONTABLE en America/Lima (un gasto 11:58pm cuenta para ese día).
  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'timestamptz' })
  ocurridoAt: Date;

  @Column({ type: 'varchar', length: 300, nullable: true })
  nota: string | null;

  @Column({ type: 'enum', enum: MovOrigen })
  origen: MovOrigen;

  @Column({ type: 'enum', enum: MovEstado, default: MovEstado.CONFIRMADO })
  estado: MovEstado;

  // Snapshot del reparto por % al momento del ingreso: cambiar % después
  // no reescribe la historia.
  @Column({ type: 'jsonb', nullable: true })
  split: SplitItem[] | null;

  // Registrado desde una nota de voz (se muestra el ícono de mic).
  @Column({ type: 'boolean', default: false })
  voz: boolean;

  // Idempotencia del webhook: un mensaje de WhatsApp = un movimiento máx.
  @Column({ type: 'varchar', length: 120, nullable: true, unique: true })
  waMessageId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
