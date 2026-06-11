import { useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type ToolUIPart, type UIMessage } from 'ai';
import {
  Check,
  CheckCircle2,
  Copy,
  ListOrdered,
  Mic,
  PenLine,
  PieChart,
  Plus,
  Search,
  Square,
  TrendingDown,
  Undo2,
  Volume2,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { Message as PersistedMessage } from '@app/contracts';
import { MessageRole } from '@app/contracts';
import { Mark } from '@/components/mayordomo/mark';
import { useMe } from '@/hooks/use-auth';
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
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought';
import { Suggestion } from '@/components/ai-elements/suggestion';
import { Shimmer } from '@/components/ai-elements/shimmer';

/** Mapea historial persistido → UIMessages para hidratar useChat. */
function toUIMessages(history: PersistedMessage[]): UIMessage[] {
  return history
    .filter((m) => m.role !== MessageRole.TOOL)
    .map((m) => ({
      id: m.id,
      role: m.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
      parts: [{ type: 'text' as const, text: m.content }],
    }));
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const SUGGESTIONS = [
  'Resume mi mes',
  'Anota un gasto',
  '¿En qué me excedo?',
  '¿Puedo ahorrar más?',
];

/** Etiquetas humanas por tool — el razonamiento se muestra, no se esconde. */
const TOOL_LABELS: Record<string, { label: string; icon: typeof Wrench }> = {
  getBoxBalances: { label: 'Consultando saldos de tus cajas', icon: Wallet },
  listTransactions: { label: 'Revisando tus movimientos', icon: ListOrdered },
  searchTransactions: { label: 'Buscando en tus movimientos', icon: Search },
  getSpendingByBox: { label: 'Sumando gastos por caja', icon: PieChart },
  getTopExpenses: { label: 'Buscando tus gastos más grandes', icon: TrendingDown },
  registerTransaction: { label: 'Registrando el movimiento', icon: PenLine },
  voidTransaction: { label: 'Anulando el movimiento', icon: Undo2 },
};

function toolMeta(type: string) {
  const name = type.replace('tool-', '');
  return TOOL_LABELS[name] ?? { label: name, icon: Wrench };
}

/** Cadena de razonamiento estilo Claude: colapsada en una línea, pasos al abrir. */
function ToolChain({ tools, done }: { tools: ToolUIPart[]; done: boolean }) {
  const first = toolMeta(tools[0].type);
  const headerLabel = tools.length === 1 ? first.label : `Razonando — ${tools.length} pasos`;

  return (
    <ChainOfThought defaultOpen={false}>
      <ChainOfThoughtHeader>{headerLabel}</ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {tools.map((tool, i) => {
          const meta = toolMeta(tool.type);
          const running = tool.state !== 'output-available' && tool.state !== 'output-error';
          return (
            <ChainOfThoughtStep
              key={i}
              icon={meta.icon}
              label={meta.label}
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
        {done && <ChainOfThoughtStep icon={CheckCircle2} label="Listo" status="complete" />}
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}

/** Copiar + leer en voz alta, debajo de cada respuesta del asistente. */
function AssistantActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

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
    utterance.lang = 'es-PE';
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  return (
    <MessageActions className="-ml-1.5 text-ink-3">
      <MessageAction tooltip={copied ? 'Copiado' : 'Copiar'} label="Copiar" onClick={copy}>
        {copied ? <Check className="size-3.5 text-positive" /> : <Copy className="size-3.5" />}
      </MessageAction>
      {'speechSynthesis' in window && (
        <MessageAction
          tooltip={speaking ? 'Detener' : 'Leer en voz alta'}
          label="Leer en voz alta"
          onClick={speak}
        >
          {speaking ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />}
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
  const { data: me } = useMe();
  const initialMessages = useMemo(() => toUIMessages(history), [history]);
  // El id real puede nacer después del mount (borrador); el id de useChat
  // debe ser estable para no perder el stream, así que va aparte.
  const convRef = useRef<string | null>(conversationId);
  const [chatId] = useState(() => conversationId ?? `draft-${Date.now()}`);
  const { messages, sendMessage, status, stop, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      credentials: 'include',
    }),
    // El backend genera el título por contexto tras el primer intercambio;
    // se refresca el rail con un pequeño margen para alcanzarlo.
    onFinish: () => {
      setTimeout(() => onTitleMaybeChanged?.(), 2500);
    },
  });

  const busy = status === 'submitted' || status === 'streaming';

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    if (!convRef.current) {
      const conv = await chatApi.create();
      convRef.current = conv.id;
      onCreated?.(conv.id);
    }
    void sendMessage({ text: content }, { body: { conversationId: convRef.current } });
  };

  const handleSubmit = (message: PromptInputMessage) => {
    void send(message.text ?? '');
  };

  const promptBox = (
    <PromptInput
      onSubmit={handleSubmit}
      className="rounded-2xl border-line bg-surface shadow-float"
    >
      <PromptInputBody>
        <PromptInputTextarea placeholder="Escribe un mensaje…" className="min-h-12 text-[15px]" />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <PromptInputButton disabled title="Adjuntos — próximamente">
            <Plus className="size-4" />
          </PromptInputButton>
        </PromptInputTools>
        <div className="flex items-center gap-1">
          <PromptInputButton disabled title="Notas de voz — por WhatsApp">
            <Mic className="size-4" />
          </PromptInputButton>
          <PromptInputSubmit status={status} onStop={stop} />
        </div>
      </PromptInputFooter>
    </PromptInput>
  );

  const errorBox = error && (
    <p className="mx-auto w-full max-w-3xl rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative">
      {error.message.includes('503') || error.message.includes('credenciales')
        ? 'El agente todavía no tiene credenciales de IA configuradas.'
        : `Algo falló: ${error.message}`}
    </p>
  );

  // Pantalla de inicio tipo claude.ai/new: saludo + input centrado + chips.
  if (messages.length === 0) {
    const firstName = me?.name?.split(' ')[0];
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 px-4 pb-16">
        <h1 className="flex items-center gap-3 font-serif text-3xl tracking-tight text-ink md:text-4xl">
          <Mark size={34} />
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <div className="w-full max-w-2xl">{promptBox}</div>
        {/* Suggestions de ai-elements es un carrusel scrollable (w-max): no centra.
            Para el empty state queremos chips centrados que envuelvan. */}
        <div className="flex w-full max-w-2xl flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((text) => (
            <Suggestion
              key={text}
              suggestion={text}
              onClick={send}
              variant="outline"
              className="border-line bg-surface text-[13px] font-semibold text-ink-2 shadow-card hover:bg-surface-alt"
            >
              {text}
            </Suggestion>
          ))}
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
            const toolParts = m.parts.filter((p): p is ToolUIPart => p.type.startsWith('tool-'));
            return (
              <Message key={m.id} from={m.role}>
                {/* Asistente plano sobre el fondo; usuario en burbuja suave a la derecha. */}
                <MessageContent className="group-[.is-user]:rounded-2xl group-[.is-user]:bg-surface-alt group-[.is-user]:text-ink">
                  {/* Tools agrupadas como cadena de razonamiento, encima del texto. */}
                  {toolParts.length > 0 && (
                    <ToolChain tools={toolParts} done={Boolean(fullText) || !(busy && isLast)} />
                  )}
                  {m.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return m.role === 'assistant' ? (
                        <MessageResponse key={i}>{part.text}</MessageResponse>
                      ) : (
                        <p key={i} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
                {/* Acciones solo cuando el mensaje terminó de streamear. */}
                {m.role === 'assistant' && fullText && !(busy && isLast) && (
                  <AssistantActions text={fullText} />
                )}
              </Message>
            );
          })}

          {busy && messages.at(-1)?.role === 'user' && (
            <Shimmer className="text-sm">Pensando…</Shimmer>
          )}

          {errorBox}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="px-4">
        <div className="mx-auto w-full max-w-3xl">{promptBox}</div>
        <p className="py-2.5 text-center text-xs text-ink-3">
          Mayordomo es IA y puede equivocarse. Verifica los montos importantes.
        </p>
      </div>
    </div>
  );
}
