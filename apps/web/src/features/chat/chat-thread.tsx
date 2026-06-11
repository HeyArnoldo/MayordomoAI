import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { BarChart3, Mic, Send, Wallet, Wrench } from 'lucide-react';
import type { Message } from '@app/contracts';
import { MessageRole } from '@app/contracts';
import { Mark } from '@/components/mayordomo/mark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Mapea historial persistido → UIMessages para hidratar useChat. */
function toUIMessages(history: Message[]): UIMessage[] {
  return history
    .filter((m) => m.role !== MessageRole.TOOL)
    .map((m) => ({
      id: m.id,
      role: m.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
      parts: [{ type: 'text' as const, text: m.content }],
    }));
}

const SUGGESTIONS = [
  { icon: BarChart3, text: 'Resume mi mes' },
  { icon: Wallet, text: 'Anota un gasto' },
  { icon: BarChart3, text: '¿En qué me excedo?' },
  { icon: Mic, text: '¿Puedo ahorrar más?' },
];

function Bubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex animate-in fade-in', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[78%] space-y-1.5 rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-card',
          isUser
            ? 'rounded-br-md bg-brand text-on-brand'
            : 'rounded-bl-md border border-line bg-surface text-ink',
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            return (
              <p key={i} className="whitespace-pre-wrap">
                {part.text}
              </p>
            );
          }
          // Tool calls visibles: el razonamiento se ve, no se esconde.
          if (part.type.startsWith('tool-')) {
            return (
              <p key={i} className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3">
                <Wrench className="size-3" /> {part.type.replace('tool-', '')}
              </p>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export function ChatThread({
  conversationId,
  history,
}: {
  conversationId: string;
  history: Message[];
}) {
  const initialMessages = useMemo(() => toUIMessages(history), [history]);
  const { messages, sendMessage, status, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      credentials: 'include',
      body: { conversationId },
    }),
  });
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const busy = status === 'submitted' || status === 'streaming';

  const submit = (e?: FormEvent, text?: string) => {
    e?.preventDefault();
    const content = (text ?? input).trim();
    if (!content || busy) return;
    void sendMessage({ text: content });
    setInput('');
  };

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-5">
            <Mark size={48} />
            <h2 className="text-lg font-bold text-ink">¿En qué te ayudo hoy?</h2>
            <div className="grid w-full max-w-sm grid-cols-2 gap-2">
              {SUGGESTIONS.map(({ icon: Icon, text }) => (
                <button
                  key={text}
                  onClick={() => submit(undefined, text)}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-[13px] font-semibold text-ink-2 shadow-card hover:bg-surface-alt"
                >
                  <Icon className="size-4 shrink-0 text-brand" /> {text}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {busy && messages.at(-1)?.role === 'user' && (
          <div className="flex items-center gap-1.5 pl-2 text-ink-3">
            <span className="size-1.5 animate-bounce rounded-full bg-current" />
            <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative">
            {error.message.includes('503') || error.message.includes('Azure')
              ? 'El agente todavía no tiene credenciales de Azure configuradas.'
              : `Algo falló: ${error.message}`}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="border-t border-line bg-surface p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Escribe un mensaje…"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-line bg-inset px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-brand"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || busy} className="size-10">
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
