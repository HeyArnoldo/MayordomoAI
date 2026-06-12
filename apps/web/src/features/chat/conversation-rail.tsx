import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageCircle,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Pin,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Trash2 } from 'lucide-react';
import type { Conversation } from '@app/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const { t } = useTranslation('chat');
  const rename = useRenameConversation();
  const togglePin = useTogglePin();
  const remove = useDeleteConversation();

  return (
    <div
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm',
        active ? 'bg-brand-soft font-semibold text-brand' : 'text-ink-2 hover:bg-surface-alt',
      )}
      onClick={() => onSelect(conv.id)}
    >
      {conv.isSystem && <MessageCircle className="size-3.5 shrink-0 text-positive" />}
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
                const title = window.prompt(t('thread.renamePrompt'), conv.title);
                if (title?.trim()) rename.mutate({ id: conv.id, title: title.trim() });
              }}
            >
              <Pencil className="size-4" /> {t('thread.rename')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => togglePin.mutate(conv.id)}>
              <Pin className="size-4" /> {conv.pinned ? t('thread.unpin') : t('thread.pin')}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => remove.mutate(conv.id)}>
              <Trash2 className="size-4" /> {t('thread.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function SectionLabel({ children, divider = false }: { children: string; divider?: boolean }) {
  return (
    <p
      className={cn(
        'px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3',
        divider ? 'mt-4 border-t border-line pt-3' : 'pt-2',
      )}
    >
      {children}
    </p>
  );
}

/**
 * Rail de sesiones estilo claude.ai: buscador, hilo de WhatsApp fijo,
 * secciones Destacados (pinned) y Recientes con divisores.
 */
export function ConversationRail({
  conversations,
  activeId,
  onSelect,
  onNew,
  onCollapse,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Abre un borrador local — la conversación se persiste recién al primer mensaje. */
  onNew: () => void;
  onCollapse: () => void;
}) {
  const { t } = useTranslation('chat');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const { system, pinned, recent } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = q
      ? conversations.filter((c) => c.title.toLowerCase().includes(q))
      : conversations;
    return {
      system: visible.filter((c) => c.isSystem),
      pinned: visible.filter((c) => !c.isSystem && c.pinned),
      recent: visible.filter((c) => !c.isSystem && !c.pinned),
    };
  }, [conversations, query]);

  const closeSearch = () => {
    setSearching(false);
    setQuery('');
  };

  const row = (c: Conversation) => (
    <SessionRow key={c.id} conv={c} active={c.id === activeId} onSelect={onSelect} />
  );

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center justify-between p-3 pb-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-ink-3">
          {t('page.conversations')}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn('size-6 text-ink-3', searching && 'bg-surface-alt text-ink')}
            title={t('rail.searchChats')}
            onClick={() => (searching ? closeSearch() : setSearching(true))}
          >
            <Search className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-ink-3"
            title={t('rail.hideConversations')}
            onClick={onCollapse}
          >
            <PanelLeftClose className="size-4" />
          </Button>
        </div>
      </div>

      {searching && (
        <div className="relative px-3 pb-2">
          <Search className="absolute left-5.5 top-1/2 size-3.5 -translate-y-[60%] text-ink-3" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
            placeholder={t('rail.searchPlaceholder')}
            className="h-8 pl-8 pr-7 text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-5.5 top-1/2 -translate-y-[60%] text-ink-3 hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="px-3 pb-1">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-alt"
        >
          <Plus className="size-4 text-brand" /> {t('rail.newConversation')}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {system.length > 0 && <div className="space-y-0.5">{system.map(row)}</div>}

        {pinned.length > 0 && (
          <>
            <SectionLabel divider={system.length > 0}>{t('rail.pinned')}</SectionLabel>
            <div className="space-y-0.5">{pinned.map(row)}</div>
          </>
        )}

        {recent.length > 0 && (
          <>
            <SectionLabel divider={system.length > 0 || pinned.length > 0}>
              {t('rail.recent')}
            </SectionLabel>
            <div className="space-y-0.5">{recent.map(row)}</div>
          </>
        )}

        {system.length + pinned.length + recent.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-ink-3">
            {query ? t('rail.noResults', { query }) : t('rail.empty')}
          </p>
        )}
      </nav>
    </aside>
  );
}
