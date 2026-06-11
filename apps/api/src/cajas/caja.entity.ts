import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CajaAmbito, CajaTipo } from '@app/contracts';
import { User } from '../users/user.entity';

/**
 * Mini-caja (sobre). Las de tipo 'gasto' reinician cada mes; las 'fondo'
 * acumulan (ahorro). El % es en puntos porcentuales y el set activo suma 100.
 */
@Entity('cajas')
export class Caja {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 60 })
  nombre: string;

  // Puntos porcentuales con 2 decimales: 25.00 = 25%
  @Column({ type: 'numeric', precision: 5, scale: 2 })
  pct: string;

  @Column({ type: 'enum', enum: CajaTipo, default: CajaTipo.GASTO })
  tipo: CajaTipo;

  @Column({ type: 'enum', enum: CajaAmbito, default: CajaAmbito.PERSONAL })
  ambito: CajaAmbito;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
