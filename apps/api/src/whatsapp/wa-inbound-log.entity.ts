import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Log de webhooks entrantes de Evolution. La PK por wa_message_id hace el
 * procesamiento idempotente: un reintento del webhook no duplica nada.
 */
@Entity('wa_inbound_log')
export class WaInboundLog {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  waMessageId: string;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  processedAt: Date;
}
