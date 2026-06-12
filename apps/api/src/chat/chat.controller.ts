import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { convertToModelMessages, UIMessage } from 'ai';
import {
  Channel,
  Conversation as ConversationDto,
  CreateConversationInput,
  createConversationSchema,
  IdParam,
  idParamSchema,
  Message as MessageDto,
  MessageRole,
  RenameConversationInput,
  renameConversationSchema,
} from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveAccountGuard } from '../common/guards/active-account.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { AgentService } from '../agent/agent.service';
import { TranscriptionService } from '../whatsapp/transcription.service';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { ConversationsService } from './conversations.service';

/** Forma mínima del file de multer (evita depender de @types/multer). */
interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

function toConversationDto(c: Conversation): ConversationDto {
  return {
    id: c.id,
    channel: c.channel,
    title: c.title,
    isSystem: c.isSystem,
    pinned: c.pinned,
    open: c.open,
    lastAt: c.lastAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  };
}

function toMessageDto(m: Message): MessageDto {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role,
    content: m.content,
    channel: m.channel,
    toolCalls: m.toolCalls,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Extrae el texto plano de un UIMessage (partes de tipo text). */
function uiMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

@Controller()
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class ChatController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly agent: AgentService,
    private readonly transcription: TranscriptionService,
  ) {}

  /**
   * Nota de voz del chat web → texto. El audio NO se almacena: se transcribe
   * y se descarta; el texto vuelve al composer para que el usuario lo edite.
   */
  @Post('chat/transcribe')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async transcribe(
    @CurrentUser() user: User,
    @UploadedFile() file: UploadedAudio | undefined,
  ): Promise<{ text: string }> {
    if (!file?.buffer?.length)
      throw new AppException('chat.audio_missing', HttpStatus.BAD_REQUEST, 'Audio file is missing');
    const text = await this.transcription.transcribe(
      file.buffer,
      user.id,
      file.mimetype || 'audio/webm',
      Channel.WEB,
    );
    if (!text)
      throw new AppException(
        'chat.transcription_failed',
        HttpStatus.BAD_REQUEST,
        'Could not transcribe the audio',
      );
    return { text };
  }

  @Get('conversations')
  async list(@CurrentUser() user: User): Promise<ConversationDto[]> {
    // El hilo de WhatsApp existe siempre (se crea on-demand, idempotente).
    await this.conversations.ensureWhatsAppThread(user.id);
    return (await this.conversations.list(user.id)).map(toConversationDto);
  }

  @Post('conversations')
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createConversationSchema)) input: CreateConversationInput,
  ): Promise<ConversationDto> {
    return toConversationDto(await this.conversations.create(user.id, input.title));
  }

  @Patch('conversations/:id')
  async rename(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
    @Body(new ZodValidationPipe(renameConversationSchema)) input: RenameConversationInput,
  ): Promise<ConversationDto> {
    return toConversationDto(await this.conversations.rename(user.id, id, input.title));
  }

  @Post('conversations/:id/pin')
  async togglePin(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
  ): Promise<ConversationDto> {
    return toConversationDto(await this.conversations.togglePin(user.id, id));
  }

  @Delete('conversations/:id')
  async remove(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
  ): Promise<{ ok: true }> {
    await this.conversations.remove(user.id, id);
    return { ok: true };
  }

  @Get('conversations/:id/messages')
  async messages(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(idParamSchema)) { id }: IdParam,
  ): Promise<MessageDto[]> {
    return (await this.conversations.listMessages(user.id, id)).map(toMessageDto);
  }

  /**
   * El chat del agente (streaming UI messages para useChat). Persiste el
   * mensaje del usuario al entrar y la respuesta (+tool calls) al terminar.
   */
  @Post('chat')
  async chat(
    @CurrentUser() user: User,
    @Body() body: { conversationId: string; messages: UIMessage[] },
    @Res() res: Response,
  ): Promise<void> {
    const conv = await this.conversations.findOne(user.id, body.conversationId);

    const last = body.messages.at(-1);
    if (last?.role === 'user') {
      // En un "reintentar" el último user ya está persistido: no duplicar.
      const text = uiMessageText(last);
      const prev = await this.conversations.lastMessage(conv.id);
      if (!(prev?.role === MessageRole.USER && prev.content === text)) {
        await this.conversations.appendMessage(conv, MessageRole.USER, text, Channel.WEB);
      }
    }

    const modelMessages = await convertToModelMessages(body.messages);
    const result = this.agent.run(user.id, conv.id, modelMessages, Channel.WEB, user.name);

    result.pipeUIMessageStreamToResponse(res);

    // Persistencia post-stream: texto final + tool calls del razonamiento.
    void (async () => {
      try {
        const [text, steps] = await Promise.all([result.text, result.steps]);
        const toolCalls = steps.flatMap((s) => s.toolCalls ?? []);
        await this.conversations.appendMessage(
          conv,
          MessageRole.ASSISTANT,
          text,
          Channel.WEB,
          toolCalls.length > 0 ? toolCalls : null,
        );

        // Título según contexto tras el primer intercambio (no el mensaje a secas).
        if (conv.title === 'Nueva conversación' && last) {
          const userText = uiMessageText(last);
          const suggested = await this.agent.suggestTitle(user.id, userText, text);
          const fallback = userText.length > 60 ? `${userText.slice(0, 57)}...` : userText;
          await this.conversations.setTitle(conv, suggested ?? fallback);
        }
      } catch {
        // El stream pudo cortarse; no rompemos la respuesta HTTP.
      }
    })();
  }
}
