import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, MessageCircle, PanelLeft, Pencil, Pin, Trash2 } from 'lucide-react';
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
function ThreadHeader({
  conv,
  onDeleted,
  inset,
}: {
  conv: Conversation;
  onDeleted: () => void;
  /** Deja lugar al botón de expandir el rail cuando está colapsado. */
  inset?: boolean;
}) {
  const { t } = useTranslation('chat');
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
      {/* max-md:pl-12 deja lugar al botón del drawer mobile */}
      <div
        className={`pointer-events-auto flex h-12 items-center gap-2 px-4 max-md:pl-12 ${inset ? 'pl-12' : ''}`}
      >
        {conv.isSystem ? (
          <>
            {title}
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
              {conv.channel === Channel.WHATSAPP
                ? t('thread.channelWhatsapp')
                : t('thread.channelSession')}
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
                  const next = window.prompt(t('thread.renamePrompt'), conv.title);
                  if (next?.trim()) rename.mutate({ id: conv.id, title: next.trim() });
                }}
              >
                <Pencil className="size-4" /> {t('thread.rename')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePin.mutate(conv.id)}>
                <Pin className="size-4" /> {conv.pinned ? t('thread.unpin') : t('thread.pin')}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => remove.mutate(conv.id, { onSuccess: onDeleted })}
              >
                <Trash2 className="size-4" /> {t('thread.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { t } = useTranslation('chat');
  const qc = useQueryClient();
  const { data: conversations = [], isLoading } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  // Borrador: chat nuevo SIN fila en BD; se materializa al primer mensaje.
  // threadKey solo cambia al navegar — la promoción borrador→real no remonta
  // el ChatThread (remontarlo cortaría el stream en curso).
  const [draft, setDraft] = useState(false);
  const [threadKey, setThreadKey] = useState(0);
  const [railOpen, setRailOpen] = useState(true);
  // Drawer mobile: el rail vive en un overlay deslizante (< md no hay espacio).
  const [mobileRail, setMobileRail] = useState(false);

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
    // Mobile: descontar también la tabbar inferior (4rem) para que el input no quede debajo.
    <div className="flex h-[calc(100vh-3.5rem-4rem)] overflow-hidden lg:h-[calc(100vh-3.5rem)]">
      {railOpen && (
        <div className="hidden md:block">
          <ConversationRail
            conversations={conversations}
            activeId={activeId}
            onSelect={(id) => selectConversation(id)}
            onNew={() => selectConversation(null, true)}
            onCollapse={() => setRailOpen(false)}
          />
        </div>
      )}

      {/* Drawer mobile: rail en overlay deslizante con backdrop */}
      {mobileRail && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 animate-in fade-in"
            onClick={() => setMobileRail(false)}
          />
          <div className="absolute inset-y-0 left-0 animate-in slide-in-from-left duration-200">
            <ConversationRail
              conversations={conversations}
              activeId={activeId}
              onSelect={(id) => {
                selectConversation(id);
                setMobileRail(false);
              }}
              onNew={() => {
                selectConversation(null, true);
                setMobileRail(false);
              }}
              onCollapse={() => setMobileRail(false)}
            />
          </div>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
        {/* Mobile: botón para abrir el drawer de conversaciones */}
        <button
          title={t('page.conversations')}
          onClick={() => setMobileRail(true)}
          className="absolute left-2 top-2 z-20 flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-alt hover:text-ink md:hidden"
        >
          <PanelLeft className="size-4" />
        </button>
        {!railOpen && (
          <button
            title={t('page.showConversations')}
            onClick={() => setRailOpen(true)}
            className="absolute left-2 top-2 z-20 hidden size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-alt hover:text-ink md:flex"
          >
            <PanelLeft className="size-4" />
          </button>
        )}
        {active && (
          <ThreadHeader
            conv={active}
            onDeleted={() => selectConversation(null)}
            inset={!railOpen}
          />
        )}
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
            {t('page.emptyState')}
          </div>
        )}
      </div>
    </div>
  );
}
