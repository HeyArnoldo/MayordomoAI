import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Locale, UserRole, UserStatus } from '@app/contracts';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  // Nullable: los usuarios que entran solo con Google no tienen password.
  @Column({ type: 'varchar', length: 100, nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  googleId: string | null;

  // text: las URLs de avatar de Google pueden superar cualquier varchar fijo.
  @Column({ type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  // Allowlist: el signup queda 'pending' hasta que un admin lo active.
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  // Se setea al verificar el número u omitir ese paso. Null = onboarding pendiente.
  @Column({ type: 'timestamptz', nullable: true })
  onboardedAt: Date | null;

  // AI-driven onboarding flow. False until the agent finishes building the user's
  // box structure. Distinct from onboardedAt (phone-link step). Defaults to false
  // for all users including those created before this column was added.
  @Column({ type: 'boolean', default: false })
  onboardingCompleted: boolean;

  // Idioma de UI, WhatsApp y agente. Lo manda la web al registrarse (navigator.language).
  @Column({ type: 'varchar', length: 5, default: 'es' })
  language: Locale;

  // Null = nunca eligió: se resuelve como USD y se deriva del prefijo del
  // teléfono al verificarlo. Nunca se pisa una elección explícita.
  @Column({ type: 'char', length: 3, nullable: true })
  currency: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
