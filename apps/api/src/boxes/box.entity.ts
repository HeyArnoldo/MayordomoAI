import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BoxColorKey, BoxScope, BoxType } from '@app/contracts';
import { User } from '../users/user.entity';

/**
 * Mini-caja (sobre). Las de tipo 'expense' reinician cada mes; las 'fund'
 * acumulan (ahorro). El % es en puntos porcentuales y el set activo suma 100.
 */
@Entity('boxes')
export class Box {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  // Puntos porcentuales con 2 decimales: 25.00 = 25%
  @Column({ type: 'numeric', precision: 5, scale: 2 })
  pct: string;

  @Column({ type: 'enum', enum: BoxType, default: BoxType.EXPENSE })
  type: BoxType;

  @Column({ type: 'enum', enum: BoxScope, default: BoxScope.PERSONAL })
  scope: BoxScope;

  // Token de color del design (var(--caja-<key>)). Null = se deduce del nombre.
  @Column({ type: 'varchar', length: 20, nullable: true })
  colorKey: BoxColorKey | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
