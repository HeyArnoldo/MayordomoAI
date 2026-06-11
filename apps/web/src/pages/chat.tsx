import { useEffect, useState } from 'react';
import { Channel } from '@app/contracts';
import { ConversationRail } from '@/features/chat/conversation-rail';
import { ChatThread } from '@/features/chat/chat-thread';
import { useConversationMessages, useConversations } from '@/hooks/use-conversations';
import { Skeleton } from '@/components/ui/skeleton';

export default function ChatPage() {
  const { data: conversations = [], isLoading } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Selección inicial: primera conversación (el hilo de WhatsApp si existe).
  useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  const { data: history, isLoading: loadingHistory } = useConversationMessages(activeId);
  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="hidden md:block">
        <ConversationRail
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        {active && (
          <div className="flex h-12 items-center gap-2 border-b border-line bg-surface px-4">
            <span className="truncate text-sm font-bold text-ink">{active.title}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
              {active.channel === Channel.WHATSAPP ? 'WhatsApp + web' : 'sesión'}
            </span>
          </div>
        )}
        {isLoading || loadingHistory ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-10 w-3/5" />
          </div>
        ) : activeId && history ? (
          // key reinicia useChat al cambiar de sesión
          <ChatThread key={activeId} conversationId={activeId} history={history} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-3">
            Crea una conversación para empezar.
          </div>
        )}
      </div>
    </div>
  );
}
