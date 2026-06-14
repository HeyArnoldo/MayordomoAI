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
  MediaItem,
  Message as MessageDto,
  MessageRole,
  RenameConversationInput,
  renameConversationSchema,
  resolveCurrency,
} from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveAccountGuard } from '../common/guards/active-account.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { AgentService } from '../agent/agent.service';
import { TranscriptionService } from '../whatsapp/transcription.service';
import {
  validateImageParts,
  validateDocument,
  isLowText,
  stripMediaFromHistory,
} from '../agent/media.helpers';
import { extractDocumentText, DocumentExtractionError } from '../agent/document.extract';
import { MAX_DOCUMENTS, DOCUMENT_MIME_ALLOWLIST } from '../agent/media.constants';
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
    mediaContext: m.mediaContext,
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
   * Valida y extrae metadatos de imagen (file parts) del último mensaje de usuario.
   */
  @Post('chat')
  async chat(
    @CurrentUser() user: User,
    @Body() body: { conversationId: string; messages: UIMessage[] },
    @Res() res: Response,
  ): Promise<void> {
    const conv = await this.conversations.findOne(user.id, body.conversationId);

    const last = body.messages.at(-1);

    // Extract file parts from the last user message and validate them.
    let mediaContext: MediaItem[] | null = null;
    if (last?.role === 'user') {
      const fileParts = last.parts.filter(
        (p): p is Extract<typeof p, { type: 'file' }> => p.type === 'file',
      );

      if (fileParts.length > 0) {
        // Branch file parts into images vs documents by MIME type.
        // Anything with an image/* MIME that is NOT in the document allowlist = image.
        // Anything in the DOCUMENT_MIME_ALLOWLIST = document.
        // Anything else (e.g. application/msword — unsupported doc format) = document attempt,
        // which will fail validateDocument with document_rejected.
        const imageParts = fileParts.filter(
          (p) =>
            (p.mediaType ?? '').startsWith('image/') &&
            !(DOCUMENT_MIME_ALLOWLIST as readonly string[]).includes(p.mediaType ?? ''),
        );
        const documentParts = fileParts.filter((p) => !(p.mediaType ?? '').startsWith('image/'));

        // Mixed image+document in one turn: reject with document_rejected (design §5.2).
        if (imageParts.length > 0 && documentParts.length > 0) {
          throw new AppException(
            'chat.document_rejected',
            HttpStatus.BAD_REQUEST,
            'Mixed image and document attachments in a single turn are not supported.',
          );
        }

        if (documentParts.length > 0) {
          // ── Document branch ────────────────────────────────────────────────
          if (documentParts.length > MAX_DOCUMENTS) {
            throw new AppException(
              'chat.document_rejected',
              HttpStatus.BAD_REQUEST,
              `Too many documents: maximum ${MAX_DOCUMENTS} allowed per turn.`,
            );
          }

          const docPart = documentParts[0];
          const partUrl = docPart.url ?? '';
          const partFilename =
            'filename' in docPart && typeof docPart.filename === 'string'
              ? docPart.filename
              : undefined;

          let docMeta: MediaItem;
          try {
            docMeta = validateDocument({
              mediaType: docPart.mediaType ?? '',
              filename: partFilename,
              url: partUrl,
            });
          } catch {
            throw new AppException(
              'chat.document_rejected',
              HttpStatus.BAD_REQUEST,
              'Document validation failed: unsupported type, size, or format.',
            );
          }

          // Decode base64 buffer from data URL
          const commaIdx = partUrl.indexOf(',');
          const b64 = commaIdx >= 0 ? partUrl.slice(commaIdx + 1) : '';
          const buffer = Buffer.from(b64, 'base64');

          let extractResult: Awaited<ReturnType<typeof extractDocumentText>>;
          try {
            extractResult = await extractDocumentText(buffer, docPart.mediaType ?? '');
          } catch (err) {
            if (err instanceof DocumentExtractionError) {
              throw new AppException(
                'chat.document_rejected',
                HttpStatus.BAD_REQUEST,
                'Document text extraction failed.',
              );
            }
            throw new AppException(
              'chat.document_rejected',
              HttpStatus.BAD_REQUEST,
              'Document text extraction failed.',
            );
          }

          if (isLowText(extractResult.text)) {
            throw new AppException(
              'chat.document_rejected',
              HttpStatus.BAD_REQUEST,
              'The document contains no selectable text (possible scanned/image-only PDF).',
            );
          }

          // Build mediaContext item (no binary, no extracted text)
          const docMediaItem: MediaItem = {
            type: 'document',
            mediaType: docMeta.mediaType,
            filename: docMeta.filename,
            size: docMeta.size,
            pageCount: extractResult.pageCount ?? null,
          };
          mediaContext = [docMediaItem];

          // Inject extracted text into the user's message parts (replace the file part).
          // The injected text is only for the model turn — it is NOT persisted.
          const extractedText = extractResult.truncated
            ? `${extractResult.text}\n\n[Note: document truncated to fit limits — some content omitted]`
            : extractResult.text;

          const filename = partFilename ?? docPart.mediaType ?? 'document';
          const injectedTextPart = {
            type: 'text' as const,
            text: `Document: ${filename}\n\n${extractedText}`,
          };

          // Replace the document file part with the injected text part in last.parts.
          const newParts = last.parts
            .filter((p) => p !== docPart)
            .concat(injectedTextPart as (typeof last.parts)[number]);
          // Mutate body.messages so convertToModelMessages sees the injected text
          body.messages[body.messages.length - 1] = { ...last, parts: newParts };
        } else if (imageParts.length > 0) {
          // ── Image branch (unchanged) ───────────────────────────────────────
          try {
            mediaContext = validateImageParts(
              imageParts.map((p) => ({
                type: 'file' as const,
                mediaType: p.mediaType ?? '',
                filename:
                  'filename' in p && typeof p.filename === 'string' ? p.filename : undefined,
                url: p.url ?? '',
              })),
            );
          } catch {
            throw new AppException(
              'chat.image_rejected',
              HttpStatus.BAD_REQUEST,
              'Image validation failed: unsupported type, size, or count.',
            );
          }
        }
      }
    }

    if (last?.role === 'user') {
      // En un "reintentar" el último user ya está persistido: no duplicar.
      // For the document branch we persist ONLY the caption (or placeholder),
      // never the injected extracted text. We read the caption from the ORIGINAL
      // `last` message (before we replaced its parts with the injected text).
      const persistContent = (() => {
        if (mediaContext?.length && mediaContext[0].type === 'document') {
          // Caption = any text part in the ORIGINAL last message (before injection)
          const caption = uiMessageText(last);
          if (caption.trim()) return caption;
          const fname = mediaContext[0].filename ?? 'document';
          return `[document: ${fname}]`;
        }
        return uiMessageText(last);
      })();
      const prev = await this.conversations.lastMessage(conv.id);
      if (!(prev?.role === MessageRole.USER && prev.content === persistContent)) {
        await this.conversations.appendMessage(
          conv,
          MessageRole.USER,
          persistContent,
          Channel.WEB,
          null,
          mediaContext,
        );
      }
    }

    // Strip media (image/document) binaries from past messages (cost guardrail);
    // keep last user's file parts intact for the current model turn.
    const stripped = stripMediaFromHistory(body.messages);
    const modelMessages = await convertToModelMessages(stripped);
    const result = this.agent.run(
      user.id,
      conv.id,
      modelMessages,
      Channel.WEB,
      user.name,
      user.language,
      resolveCurrency(user.currency),
    );

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
          const suggested = await this.agent.suggestTitle(user.id, userText, text, user.language);
          const fallback = userText.length > 60 ? `${userText.slice(0, 57)}...` : userText;
          await this.conversations.setTitle(conv, suggested ?? fallback);
        }
      } catch {
        // El stream pudo cortarse; no rompemos la respuesta HTTP.
      }
    })();
  }
}
