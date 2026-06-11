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

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  // Hash bcrypt del código de 6 dígitos enviado por WhatsApp. Null = sin código vigente.
  @Column({ type: 'varchar', length: 100, nullable: true })
  verificationCodeHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  codeExpiresAt: Date | null;

  // Última vez que se envió un código (cooldown de reenvío).
  @Column({ type: 'timestamptz', nullable: true })
  codeSentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
