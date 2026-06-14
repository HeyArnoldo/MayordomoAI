import { useMemo, useRef, useState } from 'react';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type FileUIPart, type ToolUIPart, type UIMessage } from 'ai';
import {
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  ListOrdered,
  Mic,
  Paperclip,
  PenLine,
  PieChart,
  RefreshCw,
  Search,
  Square,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  Undo2,
  Volume2,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { Message as PersistedMessage } from '@app/contracts';
import { MessageRole } from '@app/contracts';
import { toast } from 'sonner';
import { Mark } from '@/components/mayordomo/mark';
import { translateApiError } from '@/lib/api-error';
import { useMe } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { chatApi } from '@/services/chat.api';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputController,
  usePromptInputAttachments,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';

// Image attachment constraints — must match server-side constants.
const MAX_IMAGES = 2;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
import { Spinner } from '@/components/ui/spinner';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought';
import { Suggestion } from '@/components/ai-elements/suggestion';
import { Shimmer } from '@/components/ai-elements/shimmer';

/**
 * Mapea historial persistido → UIMessages para hidratar useChat.
 * Los toolCalls guardados se hidratan como parts para que la cadena de
 * razonamiento también se vea al recargar, no solo en vivo.
 */
function toUIMessages(history: PersistedMessage[]): UIMessage[] {
  return history
    .filter((m) => m.role !== MessageRole.TOOL)
    .map((m) => {
      const toolParts = (Array.isArray(m.toolCalls) ? m.toolCalls : [])
        .filter((t): t is { toolName: string; toolCallId?: string; input?: unknown } =>
          Boolean(t && typeof t === 'object' && 'toolName' in t),
        )
        .map((t, i) => ({
          type: `tool-${t.toolName}`,
          toolCallId: t.toolCallId ?? `${m.id}-tool-${i}`,
          state: 'output-available' as const,
          input: t.input,
          output: null,
        }));
      return {
        id: m.id,
        role: m.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
        parts: [...toolParts, { type: 'text' as const, text: m.content }] as UIMessage['parts'],
      };
    });
}

/** Key de saludo según la hora — se traduce con t() en el render. */
function greetingKey(): 'greetings.morning' | 'greetings.afternoon' | 'greetings.evening' {
  const h = new Date().getHours();
  if (h < 12) return 'greetings.morning';
  if (h < 19) return 'greetings.afternoon';
  return 'greetings.evening';
}

const SUGGESTION_KEYS = [
  'suggestions.summarizeMonth',
  'suggestions.logExpense',
  'suggestions.whereOverspending',
  'suggestions.canSaveMore',
] as const;

/** Etiquetas humanas por tool (keys del ns chat) — el razonamiento se muestra, no se esconde. */
const TOOL_META: Record<string, { labelKey: ParseKeys<'chat'>; icon: typeof Wrench }> = {
  getBoxBalances: { labelKey: 'tools.getBoxBalances', icon: Wallet },
  listTransactions: { labelKey: 'tools.listTransactions', icon: ListOrdered },
  searchTransactions: { labelKey: 'tools.searchTransactions', icon: Search },
  getSpendingByBox: { labelKey: 'tools.getSpendingByBox', icon: PieChart },
  getTopExpenses: { labelKey: 'tools.getTopExpenses', icon: TrendingDown },
  getExchangeRate: { labelKey: 'tools.getExchangeRate', icon: DollarSign },
  registerTransaction: { labelKey: 'tools.registerTransaction', icon: PenLine },
  voidTransaction: { labelKey: 'tools.voidTransaction', icon: Undo2 },
};

/** Tools sin etiqueta conocida muestran su nombre técnico tal cual. */
function toolMeta(type: string): {
  labelKey: ParseKeys<'chat'> | null;
  name: string;
  icon: typeof Wrench;
} {
  const name = type.replace('tool-', '');
  const meta = TOOL_META[name];
  return meta
    ? { labelKey: meta.labelKey, name, icon: meta.icon }
    : { labelKey: null, name, icon: Wrench };
}

/**
 * Partes del mensaje en orden cronológico, agrupando solo tools CONSECUTIVAS:
 * texto → razonamiento → texto se renderiza tal cual ocurrió, no todo junto.
 */
type Segment = { kind: 'text'; text: string } | { kind: 'tools'; tools: ToolUIPart[] };

function segmentParts(parts: UIMessage['parts']): Segment[] {
  const segments: Segment[] = [];
  for (const part of parts) {
    if (part.type === 'text' && part.text) {
      segments.push({ kind: 'text', text: part.text });
    } else if (part.type.startsWith('tool-')) {
      const last = segments.at(-1);
      if (last?.kind === 'tools') last.tools.push(part as ToolUIPart);
      else segments.push({ kind: 'tools', tools: [part as ToolUIPart] });
    }
  }
  return segments;
}

/** Cadena de razonamiento estilo Claude: colapsada en una línea, pasos al abrir. */
function ToolChain({ tools, done }: { tools: ToolUIPart[]; done: boolean }) {
  const { t } = useTranslation('chat');
  const label = (meta: ReturnType<typeof toolMeta>) =>
    meta.labelKey ? t(meta.labelKey) : meta.name;
  const headerLabel =
    tools.length === 1
      ? label(toolMeta(tools[0].type))
      : t('thread.reasoningSteps', { count: tools.length });

  return (
    <ChainOfThought defaultOpen={false}>
      {/* w-fit: chevron pegado al texto, no empujado al borde derecho */}
      <ChainOfThoughtHeader className="w-fit [&>span]:flex-none">
        {headerLabel}
      </ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {tools.map((tool, i) => {
          const meta = toolMeta(tool.type);
          const running = tool.state !== 'output-available' && tool.state !== 'output-error';
          return (
            <ChainOfThoughtStep
              key={i}
              icon={meta.icon}
              label={label(meta)}
              status={running ? 'active' : 'complete'}
              description={
                tool.state === 'output-error'
                  ? tool.errorText
                  : tool.input && Object.keys(tool.input).length > 0
                    ? JSON.stringify(tool.input)
                    : undefined
              }
            />
          );
        })}
        {done && (
          <ChainOfThoughtStep icon={CheckCircle2} label={t('thread.stepDone')} status="complete" />
        )}
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}

/**
 * Attachment button: opens the file dialog wired to PromptInput's hidden input.
 * Validation constraints (type/size/count) are applied by PromptInput itself.
 */
function AttachButton() {
  const { t } = useTranslation('chat');
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      onClick={() => attachments.openFileDialog()}
      title={t('composer.attachImage')}
    >
      <Paperclip className="size-4" />
    </PromptInputButton>
  );
}

/**
 * Mic del composer: graba con MediaRecorder, transcribe en el backend (mismo
 * motor que las notas de voz de WhatsApp) y deja el texto EN el input para
 * que el usuario lo revise antes de enviar — la transcripción puede fallar.
 */
function MicButton() {
  const { t } = useTranslation('chat');
  const { textInput } = usePromptInputController();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const supported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices);

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 1_000) return; // click accidental: nada que transcribir
        setTranscribing(true);
        try {
          const text = await chatApi.transcribe(blob);
          const prev = textInput.value.trim();
          textInput.setInput(prev ? `${prev} ${text}` : text);
        } catch {
          toast.error(t('mic.transcribeError'));
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error(t('mic.noAccess'));
    }
  };

  if (!supported) return null;

  return (
    <PromptInputButton
      onClick={() => (recording ? stop() : void start())}
      disabled={transcribing}
      title={recording ? t('mic.stopAndTranscribe') : t('mic.dictate')}
      className={cn(recording && 'bg-negative-soft text-negative hover:text-negative')}
    >
      {transcribing ? (
        <Spinner className="size-4" />
      ) : recording ? (
        <Square className="size-4 animate-pulse" />
      ) : (
        <Mic className="size-4" />
      )}
    </PromptInputButton>
  );
}

/** Copiar, leer en voz alta, feedback y reintentar — fila estilo Claude. */
function AssistantActions({
  text,
  onRetry,
  hoverOnly = false,
}: {
  text: string;
  onRetry?: () => void;
  /** Mensajes pasados: acciones visibles solo al pasar el mouse. */
  hoverOnly?: boolean;
}) {
  const { t, i18n } = useTranslation('chat');
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const speak = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    // Usar el idioma activo del usuario para la síntesis de voz.
    utterance.lang = i18n.language;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const vote = (v: 'up' | 'down') => {
    setVoted(v);
    toast.success(v === 'up' ? t('actions.feedbackThanks') : t('actions.feedbackNoted'));
  };

  return (
    <MessageActions
      className={cn(
        '-ml-1.5 text-ink-3',
        hoverOnly &&
          'opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100',
      )}
    >
      <MessageAction
        tooltip={copied ? t('actions.copied') : t('actions.copy')}
        label={t('actions.copy')}
        onClick={copy}
      >
        {copied ? <Check className="size-3.5 text-positive" /> : <Copy className="size-3.5" />}
      </MessageAction>
      {'speechSynthesis' in window && (
        <MessageAction
          tooltip={speaking ? t('actions.stop') : t('actions.readAloud')}
          label={t('actions.readAloud')}
          onClick={speak}
        >
          {speaking ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </MessageAction>
      )}
      <MessageAction
        tooltip={t('actions.goodResponse')}
        label={t('actions.goodResponse')}
        onClick={() => vote('up')}
        disabled={voted !== null}
      >
        <ThumbsUp className={cn('size-3.5', voted === 'up' && 'text-positive')} />
      </MessageAction>
      <MessageAction
        tooltip={t('actions.badResponse')}
        label={t('actions.badResponse')}
        onClick={() => vote('down')}
        disabled={voted !== null}
      >
        <ThumbsDown className={cn('size-3.5', voted === 'down' && 'text-negative')} />
      </MessageAction>
      {onRetry && (
        <MessageAction tooltip={t('actions.retry')} label={t('actions.retry')} onClick={onRetry}>
          <RefreshCw className="size-3.5" />
        </MessageAction>
      )}
    </MessageActions>
  );
}

export function ChatThread({
  conversationId,
  history,
  onCreated,
  onTitleMaybeChanged,
}: {
  /** null = borrador: la conversación se crea en BD recién al primer mensaje. */
  conversationId: string | null;
  history: PersistedMessage[];
  onCreated?: (id: string) => void;
  onTitleMaybeChanged?: () => void;
}) {
  const { t } = useTranslation('chat');
  const { data: me } = useMe();
  const initialMessages = useMemo(() => toUIMessages(history), [history]);
  // El id real puede nacer después del mount (borrador); el id de useChat
  // debe ser estable para no perder el stream, así que va aparte.
  const convRef = useRef<string | null>(conversationId);
  const [chatId] = useState(() => conversationId ?? `draft-${Date.now()}`);
  const { messages, sendMessage, regenerate, status, stop, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      // Misma base que axios: en dev '' (proxy de Vite), en prod la URL absoluta.
      api: `${import.meta.env.VITE_API_URL ?? ''}/api/chat`,
      credentials: 'include',
    }),
    // El backend genera el título por contexto tras el primer intercambio;
    // se refresca el rail con un pequeño margen para alcanzarlo.
    onFinish: () => {
      setTimeout(() => onTitleMaybeChanged?.(), 2500);
    },
  });

  const busy = status === 'submitted' || status === 'streaming';

  const send = async (text: string, files: FileUIPart[] = []) => {
    const content = text.trim();
    if ((!content && files.length === 0) || busy) return;

    // Guard: if any file's URL is still a blob: URL (conversion failed), abort and surface error.
    const hasBrokenBlob = files.some((f) => f.url?.startsWith('blob:'));
    if (hasBrokenBlob) {
      toast.error(t('composer.attachmentReadFailed'));
      return;
    }

    if (!convRef.current) {
      const conv = await chatApi.create();
      convRef.current = conv.id;
      onCreated?.(conv.id);
    }
    void sendMessage({ text: content, files }, { body: { conversationId: convRef.current } });
  };

  const handleAttachError = (err: { code: string; message: string }) => {
    // code: 'max_files' | 'max_file_size' | 'accept'
    toast.error(err.message);
  };

  const handleSubmit = (message: PromptInputMessage) => {
    void send(message.text ?? '', message.files);
  };

  const promptBox = (
    // Provider: el MicButton necesita escribir el texto transcrito en el input.
    <PromptInputProvider>
      <PromptInput
        onSubmit={handleSubmit}
        onError={handleAttachError}
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        maxFiles={MAX_IMAGES}
        maxFileSize={MAX_IMAGE_BYTES}
        className="rounded-2xl border-line bg-surface shadow-float"
      >
        <PromptInputBody>
          <PromptInputTextarea
            placeholder={t('composer.placeholder')}
            className="min-h-12 text-[15px]"
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <AttachButton />
          </PromptInputTools>
          <div className="flex items-center gap-1">
            <MicButton />
            <PromptInputSubmit status={status} onStop={stop} />
          </div>
        </PromptInputFooter>
      </PromptInput>
    </PromptInputProvider>
  );

  const errorBox = error && (
    <p className="mx-auto w-full max-w-3xl rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative">
      {translateApiError(error)}
    </p>
  );

  // Pantalla de inicio tipo claude.ai/new: saludo + input centrado + chips.
  if (messages.length === 0) {
    const firstName = me?.name?.split(' ')[0];
    const greet = t(greetingKey());
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 px-4 pb-16">
        <h1 className="flex items-center gap-3 font-serif text-3xl tracking-tight text-ink md:text-4xl">
          <Mark size={34} />
          {firstName ? t('greetings.withName', { greeting: greet, name: firstName }) : greet}
        </h1>
        <div className="w-full max-w-2xl">{promptBox}</div>
        {/* Suggestions de ai-elements es un carrusel scrollable (w-max): no centra.
            Para el empty state queremos chips centrados que envuelvan. */}
        <div className="flex w-full max-w-2xl flex-wrap justify-center gap-2">
          {SUGGESTION_KEYS.map((key) => {
            const text = t(key);
            return (
              <Suggestion
                key={key}
                suggestion={text}
                onClick={send}
                variant="outline"
                className="border-line bg-surface text-[13px] font-semibold text-ink-2 shadow-card hover:bg-surface-alt"
              >
                {text}
              </Suggestion>
            );
          })}
        </div>
        {errorBox}
      </div>
    );
  }

  return (
    // min-h-0 y SIN h-full: con h-full mide 100% del padre e ignora el header
    // de arriba — el input queda 48px fuera del viewport.
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        {/* pt-16: deja pasar el header overlay con degradado */}
        <ConversationContent className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-6 pt-16">
          {messages.map((m, idx) => {
            const isLast = idx === messages.length - 1;
            const fullText = m.parts
              .filter((p) => p.type === 'text')
              .map((p) => p.text)
              .join('\n');
            const segments = segmentParts(m.parts);
            return (
              <Message key={m.id} from={m.role}>
                {/* Asistente plano sobre el fondo; usuario en burbuja suave a la derecha. */}
                <MessageContent className="group-[.is-user]:rounded-2xl group-[.is-user]:bg-surface-alt group-[.is-user]:text-ink">
                  {segments.map((seg, i) => {
                    if (seg.kind === 'text') {
                      return m.role === 'assistant' ? (
                        <MessageResponse key={i}>{seg.text}</MessageResponse>
                      ) : (
                        <p key={i} className="whitespace-pre-wrap">
                          {seg.text}
                        </p>
                      );
                    }
                    // Cadena cerrada si hay algo después (texto siguiente) o terminó el stream.
                    const done = i < segments.length - 1 || !(busy && isLast);
                    return <ToolChain key={i} tools={seg.tools} done={done} />;
                  })}
                </MessageContent>
                {/* Acciones solo cuando el mensaje terminó de streamear. */}
                {m.role === 'assistant' && fullText && !(busy && isLast) && (
                  <AssistantActions
                    text={fullText}
                    hoverOnly={!isLast}
                    onRetry={
                      isLast && convRef.current
                        ? () => void regenerate({ body: { conversationId: convRef.current } })
                        : undefined
                    }
                  />
                )}
              </Message>
            );
          })}

          {busy && messages.at(-1)?.role === 'user' && (
            <Shimmer className="text-sm">{t('thread.thinking')}</Shimmer>
          )}

          {/* Firma del mayordomo al cerrar su último mensaje, como claude.ai */}
          {!busy && messages.at(-1)?.role === 'assistant' && (
            <>
              <div className="pt-1 pb-6">
                <Mark size={22} />
              </div>
            </>
          )}

          {errorBox}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="px-4">
        <div className="mx-auto w-full max-w-3xl">{promptBox}</div>
        <p className="py-2.5 text-center text-xs text-ink-3">{t('thread.disclaimer')}</p>
      </div>
    </div>
  );
}
