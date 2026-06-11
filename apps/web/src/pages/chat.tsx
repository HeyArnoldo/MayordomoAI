import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, MessageCircle, Pencil, Pin, Trash2 } from 'lucide-react';
import { Channel, type Conversation } from '@app/contracts';
import { ConversationRail } from '@/features/chat/conversation-rail';
import { ChatThread } from '@/features/chat/chat-thread';
import {
  useConversationMessages,
  useConversations,
  useDeleteConversation,
  useRenameConversation,
  useTogglePin,
} from '@/hooks/use-conversations';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Header minimal estilo claude.ai: título + chevron con acciones del hilo. */
function ThreadHeader({ conv, onDeleted }: { conv: Conversation; onDeleted: () => void }) {
  const rename = useRenameConversation();
  const togglePin = useTogglePin();
  const remove = useDeleteConversation();

  const title = (
    <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink">
      {conv.isSystem && <MessageCircle className="size-3.5 shrink-0 text-positive" />}
      <span className="truncate">{conv.title}</span>
    </span>
  );

  return (
    // Overlay con degradado: los mensajes se desvanecen bajo el header en
    // lugar de cortarse. pointer-events solo en la fila interactiva.
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-background via-background/90 to-transparent pb-7">
      <div className="pointer-events-auto flex h-12 items-center gap-2 px-4">
        {conv.isSystem ? (
          <>
            {title}
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
              {conv.channel === Channel.WHATSAPP ? 'WhatsApp + web' : 'sesión'}
            </span>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex min-w-0 max-w-[44ch] items-center gap-1 rounded-lg px-2 py-1 hover:bg-surface-alt">
                {title}
                <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              <DropdownMenuItem
                onClick={() => {
                  const next = window.prompt('Nuevo título', conv.title);
                  if (next?.trim()) rename.mutate({ id: conv.id, title: next.trim() });
                }}
              >
                <Pencil className="size-4" /> Renombrar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePin.mutate(conv.id)}>
                <Pin className="size-4" /> {conv.pinned ? 'Desfijar' : 'Fijar'}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => remove.mutate(conv.id, { onSuccess: onDeleted })}
              >
                <Trash2 className="size-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const qc = useQueryClient();
  const { data: conversations = [], isLoading } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  // Borrador: chat nuevo SIN fila en BD; se materializa al primer mensaje.
  // threadKey solo cambia al navegar — la promoción borrador→real no remonta
  // el ChatThread (remontarlo cortaría el stream en curso).
  const [draft, setDraft] = useState(false);
  const [threadKey, setThreadKey] = useState(0);

  const selectConversation = (id: string | null, asDraft = false) => {
    setActiveId(id);
    setDraft(asDraft);
    setThreadKey((k) => k + 1);
  };

  // Selección inicial: primera conversación (el hilo de WhatsApp si existe).
  useEffect(() => {
    if (!activeId && !draft && conversations.length > 0) setActiveId(conversations[0].id);
  }, [conversations, activeId, draft]);

  const { data: history, isLoading: loadingHistory } = useConversationMessages(
    draft ? null : activeId,
  );
  const active = conversations.find((c) => c.id === activeId);
  const refreshConversations = () => void qc.invalidateQueries({ queryKey: ['conversations'] });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="hidden md:block">
        <ConversationRail
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => selectConversation(id)}
          onNew={() => selectConversation(null, true)}
        />
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
        {active && <ThreadHeader conv={active} onDeleted={() => selectConversation(null)} />}
        {draft ? (
          <ChatThread
            key={`draft-${threadKey}`}
            conversationId={activeId}
            history={[]}
            onCreated={(id) => {
              // Promoción silenciosa: misma instancia, solo cambia la selección.
              setActiveId(id);
              refreshConversations();
            }}
            onTitleMaybeChanged={refreshConversations}
          />
        ) : isLoading || loadingHistory ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-10 w-3/5" />
          </div>
        ) : activeId && history ? (
          <ChatThread
            key={`${activeId}-${threadKey}`}
            conversationId={activeId}
            history={history}
            onTitleMaybeChanged={refreshConversations}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-3">
            Crea una conversación para empezar.
          </div>
        )}
      </div>
    </div>
  );
}
