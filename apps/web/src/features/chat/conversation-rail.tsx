import { MessageCircle, MoreHorizontal, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import type { Conversation } from '@app/contracts';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  useDeleteConversation,
  useRenameConversation,
  useTogglePin,
} from '@/hooks/use-conversations';

function SessionRow({
  conv,
  active,
  onSelect,
}: {
  conv: Conversation;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const rename = useRenameConversation();
  const togglePin = useTogglePin();
  const remove = useDeleteConversation();

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer',
        active ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-2 hover:bg-surface-alt',
      )}
      onClick={() => onSelect(conv.id)}
    >
      {conv.isSystem && <MessageCircle className="size-3.5 shrink-0 text-positive" />}
      {!conv.isSystem && conv.pinned && <Pin className="size-3 shrink-0" />}
      <span className="flex-1 truncate">{conv.title}</span>
      {!conv.isSystem && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={() => {
                const title = window.prompt('Nuevo título', conv.title);
                if (title?.trim()) rename.mutate({ id: conv.id, title: title.trim() });
              }}
            >
              <Pencil className="size-4" /> Renombrar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => togglePin.mutate(conv.id)}>
              <Pin className="size-4" /> {conv.pinned ? 'Desfijar' : 'Fijar'}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => remove.mutate(conv.id)}>
              <Trash2 className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** Rail de sesiones: hilo de WhatsApp fijado arriba + sesiones web (estilo ChatGPT). */
export function ConversationRail({
  conversations,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Abre un borrador local — la conversación se persiste recién al primer mensaje. */
  onNew: () => void;
}) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center justify-between p-3">
        <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-ink-3">
          Conversaciones
        </span>
      </div>
      <div className="px-3 pb-2">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onNew}>
          <Plus className="size-4" /> Nueva conversación
        </Button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {conversations.map((c) => (
          <SessionRow key={c.id} conv={c} active={c.id === activeId} onSelect={onSelect} />
        ))}
        {conversations.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-ink-3">Sin conversaciones todavía.</p>
        )}
      </nav>
    </aside>
  );
}
