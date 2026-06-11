import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Número de WhatsApp vinculado a una cuenta. Es la llave que resuelve
 * "remitente del webhook → user_id". Un número pertenece a UNA sola cuenta.
 */
@Entity('phone_numbers')
export class PhoneNumber {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Formato E.164: +51987654321
  @Column({ type: 'varchar', length: 20, unique: true })
  e164: string;

  // La verificación por código queda post-hackathon; en el sprint se marca a mano.
  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
