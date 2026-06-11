import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Channel } from '@app/contracts';

export type AiUsageKind = 'agent' | 'title' | 'transcription';

/**
 * Registro de cada llamada a IA con su costo estimado. Es la fuente del
 * tab "Uso" del panel admin: el provider factura por API key, así que la
 * atribución por usuario solo existe si la registramos nosotros.
 */
@Entity('ai_usage_log')
@Index(['userId', 'createdAt'])
@Index(['createdAt'])
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  kind: AiUsageKind;

  @Column({ type: 'varchar', length: 80 })
  model: string;

  @Column({ type: 'int', nullable: true })
  inputTokens: number | null;

  @Column({ type: 'int', nullable: true })
  outputTokens: number | null;

  // Estimado con la tabla de precios local. Null = modelo sin precio conocido.
  @Column({ type: 'numeric', precision: 12, scale: 6, nullable: true })
  costUsd: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  channel: Channel | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
