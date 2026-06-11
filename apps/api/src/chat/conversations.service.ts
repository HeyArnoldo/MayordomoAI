import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel, MessageRole } from '@app/contracts';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
  ) {}

  /** Lista: hilo de WhatsApp fijado primero, luego por actividad. */
  list(userId: string): Promise<Conversation[]> {
    return this.conversations.find({
      where: { userId },
      order: { isSystem: 'DESC', pinned: 'DESC', lastAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Conversation> {
    const conv = await this.conversations.findOne({ where: { id, userId } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv;
  }

  create(userId: string, title?: string): Promise<Conversation> {
    return this.conversations.save(
      this.conversations.create({
        userId,
        channel: Channel.WEB,
        title: title ?? 'Nueva conversación',
      }),
    );
  }

  /** Hilo único de WhatsApp por usuario: de sistema, fijado, se crea on-demand. */
  async ensureWhatsAppThread(userId: string): Promise<Conversation> {
    const existing = await this.conversations.findOne({
      where: { userId, channel: Channel.WHATSAPP, isSystem: true },
    });
    if (existing) return existing;
    return this.conversations.save(
      this.conversations.create({
        userId,
        channel: Channel.WHATSAPP,
        title: 'Hilo principal',
        isSystem: true,
        pinned: true,
      }),
    );
  }

  async rename(userId: string, id: string, title: string): Promise<Conversation> {
    const conv = await this.findOne(userId, id);
    if (conv.isSystem) throw new BadRequestException('El hilo de WhatsApp no se renombra');
    conv.title = title;
    return this.conversations.save(conv);
  }

  async togglePin(userId: string, id: string): Promise<Conversation> {
    const conv = await this.findOne(userId, id);
    if (conv.isSystem) return conv; // siempre fijado
    conv.pinned = !conv.pinned;
    return this.conversations.save(conv);
  }

  async remove(userId: string, id: string): Promise<void> {
    const conv = await this.findOne(userId, id);
    if (conv.isSystem) throw new BadRequestException('El hilo de WhatsApp no se borra');
    await this.conversations.remove(conv);
  }

  listMessages(userId: string, conversationId: string): Promise<Message[]> {
    return this.messages.find({
      where: { conversationId, conversation: { userId } },
      relations: { conversation: true },
      order: { createdAt: 'ASC' },
    });
  }

  /** Persiste un mensaje y refresca lastAt. */
  async appendMessage(
    conv: Conversation,
    role: MessageRole,
    content: string,
    channel: Channel,
    toolCalls: unknown | null = null,
  ): Promise<Message> {
    const msg = await this.messages.save(
      this.messages.create({ conversationId: conv.id, role, content, channel, toolCalls }),
    );
    conv.lastAt = new Date();
    await this.conversations.save(conv);
    return msg;
  }

  /** Título automático (generado por IA tras el primer intercambio). */
  async setTitle(conv: Conversation, title: string): Promise<void> {
    if (conv.isSystem) return;
    conv.title = title;
    await this.conversations.save(conv);
  }
}
