import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelMessage } from 'ai';
import {
  Channel,
  MessageRole,
  TransactionSource,
  TransactionType,
  UserStatus,
} from '@app/contracts';
import { User } from '../users/user.entity';
import { PhoneNumber } from '../users/phone-number.entity';
import { BoxesService } from '../boxes/boxes.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AgentService } from '../agent/agent.service';
import { isAiEnabled } from '../agent/ai.config';
import { ConversationsService } from '../chat/conversations.service';
import { WaInboundLog } from './wa-inbound-log.entity';
import { EvolutionClient } from './evolution.client';
import { TranscriptionService } from './transcription.service';
import { parseFastPath } from './parser';

/** Forma relevante del webhook messages.upsert de Evolution (defensivo). */
export interface EvolutionWebhookPayload {
  event?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      audioMessage?: object;
      base64?: string;
    };
    messageType?: string;
  };
}

const HISTORY_WINDOW = 12;

const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2 });

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  // Anti-spam: a un número desconocido se le responde máx. 1 vez por día.
  private readonly unknownReplied = new Map<string, string>();

  constructor(
    @InjectRepository(WaInboundLog) private readonly inboundLog: Repository<WaInboundLog>,
    @InjectRepository(PhoneNumber) private readonly phones: Repository<PhoneNumber>,
    private readonly boxes: BoxesService,
    private readonly transactions: TransactionsService,
    private readonly agent: AgentService,
    private readonly conversations: ConversationsService,
    private readonly evolution: EvolutionClient,
    private readonly transcription: TranscriptionService,
  ) {}

  /**
   * Pipeline del webhook: dedup → resolver usuario → texto o voz →
   * fast-path regex o agente → responder y persistir. Idempotente por
   * wa_message_id; los reintentos de Evolution no duplican nada.
   */
  async processInbound(payload: EvolutionWebhookPayload): Promise<void> {
    const data = payload.data;
    const key = data?.key;
    if (!key?.id || !key.remoteJid) return;
    if (key.fromMe) return; // jamás auto-procesarse (loop)
    if (key.remoteJid.endsWith('@g.us')) return; // grupos fuera de alcance

    // Dedup por PK: si ya está logueado, es un reintento.
    const exists = await this.inboundLog.exists({ where: { waMessageId: key.id } });
    if (exists) return;
    await this.inboundLog.save(
      this.inboundLog.create({ waMessageId: key.id, payload: payload as object }),
    );

    const e164 = `+${key.remoteJid.split('@')[0]}`;
    const phone = await this.phones.findOne({ where: { e164 }, relations: { user: true } });

    if (!phone || phone.user.status !== UserStatus.ACTIVE) {
      await this.replyToUnknown(e164);
      return;
    }
    const user = phone.user;

    // Texto directo o nota de voz transcrita — después comparten pipeline.
    let text = data?.message?.conversation ?? data?.message?.extendedTextMessage?.text ?? null;
    let voice = false;

    if (!text && data?.message?.audioMessage) {
      voice = true;
      const base64 = data.message.base64 ?? (await this.evolution.getBase64(key.id));
      if (base64) {
        text = await this.transcription.transcribe(Buffer.from(base64, 'base64'), user.id);
      }
      if (!text) {
        await this.evolution.sendText(e164, 'No pude escuchar esa nota de voz. ¿Me lo escribes?');
        return;
      }
    }

    if (!text) {
      await this.evolution.sendText(e164, 'Por ahora solo entiendo texto y notas de voz. 📝');
      return;
    }

    const reply = await this.handleText(user, text, voice, key.id);
    await this.evolution.sendText(e164, reply);
  }

  /** Texto → fast-path (gratis) o agente (razonamiento). Devuelve la respuesta. */
  private async handleText(
    user: User,
    text: string,
    voice: boolean,
    waMessageId: string,
  ): Promise<string> {
    const thread = await this.conversations.ensureWhatsAppThread(user.id);
    await this.conversations.appendMessage(
      thread,
      MessageRole.USER,
      voice ? `🎤 ${text}` : text,
      Channel.WHATSAPP,
    );

    const reply = await this.resolveReply(user, text, voice, waMessageId, thread.id);

    await this.conversations.appendMessage(thread, MessageRole.ASSISTANT, reply, Channel.WHATSAPP);
    return reply;
  }

  private async resolveReply(
    user: User,
    text: string,
    voice: boolean,
    waMessageId: string,
    conversationId: string,
  ): Promise<string> {
    const boxes = await this.boxes.findAll(user.id);
    const fast = parseFastPath(
      text,
      boxes.filter((b) => b.active).map((b) => b.name),
    );

    // Fast-path por voz NO registra directo: la transcripción puede fallar.
    if (fast && !(voice && fast.kind !== 'summary')) {
      if (fast.kind === 'summary') return this.summaryText(user.id);

      if (fast.kind === 'expense') {
        const box = boxes.find((b) => b.name === fast.boxName)!;
        await this.transactions.create(
          user.id,
          {
            type: TransactionType.EXPENSE,
            boxId: box.id,
            amount: fast.amount,
            note: fast.note,
            voice,
          },
          TransactionSource.WHATSAPP,
          waMessageId,
        );
        const balances = await this.boxes.withBalances(user.id);
        const updated = balances.find((b) => b.id === box.id)!;
        return `✓ Anotado S/${fmt(fast.amount)} en ${box.name}. Te quedan S/${fmt(updated.balance)}.`;
      }

      if (fast.kind === 'income') {
        const tx = await this.transactions.create(
          user.id,
          { type: TransactionType.INCOME, amount: fast.amount, note: fast.note, voice },
          TransactionSource.WHATSAPP,
          waMessageId,
        );
        const parts = (tx.split ?? [])
          .filter((s) => s.amount > 0)
          .map((s) => `${s.name} S/${fmt(s.amount)}`)
          .join(' · ');
        return `✓ S/${fmt(fast.amount)} repartidos: ${parts}`;
      }
    }

    // Lenguaje libre → el agente (mismo cerebro que el chat web).
    if (!isAiEnabled()) {
      return 'Entiendo frases como "gasté 8 en pasajes", "me entró 500" o "resumen". Para preguntas libres, el agente aún no está configurado.';
    }
    const history = await this.historyAsModelMessages(user.id, conversationId);
    const result = this.agent.run(user.id, conversationId, history, Channel.WHATSAPP);
    return (await result.text).trim();
  }

  /** Últimos N mensajes del hilo como contexto del agente (memoria). */
  private async historyAsModelMessages(
    userId: string,
    conversationId: string,
  ): Promise<ModelMessage[]> {
    const all = await this.conversations.listMessages(userId, conversationId);
    return all
      .slice(-HISTORY_WINDOW)
      .filter((m) => m.role !== MessageRole.TOOL)
      .map((m) => ({
        role: m.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }));
  }

  private async summaryText(userId: string): Promise<string> {
    const balances = await this.boxes.withBalances(userId);
    const lines = balances
      .filter((b) => b.active)
      .map((b) => {
        if (b.accumulated !== null) return `🟢 ${b.name}: S/${fmt(b.accumulated)} acumulado`;
        const flag = b.balance < 0 ? '🔴' : b.spent / (b.allocated || 1) >= 0.8 ? '🟡' : '⚪';
        return `${flag} ${b.name}: S/${fmt(b.balance)} de S/${fmt(b.allocated)}`;
      });
    const available = balances
      .filter((b) => b.accumulated === null && b.active)
      .reduce((s, b) => s + b.balance, 0);
    return [`*Tus cajas hoy:*`, ...lines, '', `Disponible: S/${fmt(available)}`].join('\n');
  }

  private async replyToUnknown(e164: string): Promise<void> {
    const today = new Date().toDateString();
    if (this.unknownReplied.get(e164) === today) return;
    this.unknownReplied.set(e164, today);
    await this.evolution.sendText(
      e164,
      'Hola 👋 No encuentro una cuenta vinculada a este número. Regístrate en https://mayordomoai.xyz y vincula tu número desde Ajustes.',
    );
  }
}
