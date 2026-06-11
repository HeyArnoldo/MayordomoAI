import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Channel, MessageRole, UserStatus } from '@app/contracts';
import { PhoneNumber } from '../users/phone-number.entity';
import { ConversationsService } from '../chat/conversations.service';
import { RecurringService } from '../recurring/recurring.service';
import { EvolutionClient } from './evolution.client';

const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2 });

/**
 * Recordatorio de gastos fijos: cada mañana (hora de Lima) avisa por WhatsApp
 * los vencimientos del día. NO registra nada — el usuario responde "sí" y el
 * agente lo anota (el recordatorio queda en el hilo como contexto).
 */
@Injectable()
export class RecurringReminderService {
  private readonly logger = new Logger(RecurringReminderService.name);

  constructor(
    private readonly recurring: RecurringService,
    private readonly conversations: ConversationsService,
    private readonly evolution: EvolutionClient,
    @InjectRepository(PhoneNumber) private readonly phones: Repository<PhoneNumber>,
  ) {}

  @Cron('0 0 9 * * *', { timeZone: 'America/Lima' })
  async remindDueToday(): Promise<void> {
    const due = await this.recurring.dueToday();
    if (due.length === 0) return;
    this.logger.log(`${due.length} gasto(s) fijo(s) vencen hoy — enviando recordatorios`);

    for (const item of due) {
      try {
        if (item.user.status !== UserStatus.ACTIVE) continue;
        const phone = await this.phones.findOne({
          where: { userId: item.userId, verified: true },
        });
        if (!phone) continue; // sin número verificado no hay canal

        const text =
          `📌 Recordatorio: hoy vence *${item.name}* — S/${fmt(parseFloat(item.amount))} ` +
          `(caja ${item.box.name}). ¿Lo registro? Responde "sí" y lo anoto.`;

        await this.evolution.sendText(phone.e164, text);

        // Al hilo de WhatsApp: el agente ve el recordatorio cuando el usuario responda.
        const thread = await this.conversations.ensureWhatsAppThread(item.userId);
        await this.conversations.appendMessage(
          thread,
          MessageRole.ASSISTANT,
          text,
          Channel.WHATSAPP,
        );

        await this.recurring.markReminded(item.id);
      } catch (err) {
        // Un fallo con un usuario no debe frenar el resto del lote.
        this.logger.error(`recordatorio falló para ${item.name} (${item.userId}): ${err}`);
      }
    }
  }
}
