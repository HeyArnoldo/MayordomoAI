import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  List,
  LogOut,
  MessageCircle,
  Moon,
  PackageOpen,
  PanelLeft,
  Plus,
  Sun,
  Wrench,
} from 'lucide-react';
import { useLogout, useMe } from '@/hooks/use-auth';
import { Mark, Wordmark } from '@/components/mayordomo/mark';
import { RegistroDialog } from '@/features/registro/registro-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/movimientos', label: 'Movimientos', icon: List },
  { to: '/chat', label: 'Conversaciones', icon: MessageCircle },
  { to: '/cajas', label: 'Cajas y reparto', icon: PackageOpen },
  { to: '/agente', label: 'Razonamiento', icon: Wrench },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Inicio',
  '/movimientos': 'Movimientos',
  '/chat': 'Conversaciones',
  '/cajas': 'Cajas y reparto',
  '/agente': 'Historial de razonamiento',
};

/** Tabs mobile del design: Inicio · Movs · [+] · Chat · Cajas. */
const TABS = [
  { ...NAV[0], short: 'Inicio' },
  { ...NAV[1], short: 'Movs' },
  null,
  { ...NAV[2], short: 'Chat' },
  { ...NAV[3], short: 'Cajas' },
] as const;

function DarkToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <Button variant="ghost" size="icon" onClick={onToggle}>
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

/**
 * Layout del design: sidebar izquierda colapsable en desktop (228px ↔ 68px),
 * TabBar inferior con FAB central en mobile. Sin top-nav genérica.
 */
export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [expanded, setExpanded] = useState(() => localStorage.getItem('sidebar') !== 'collapsed');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    localStorage.setItem('sidebar', expanded ? 'expanded' : 'collapsed');
  }, [expanded]);

  const handleLogout = () => logout.mutate(undefined, { onSuccess: () => navigate('/login') });
  const initial = (user?.name ?? 'U').charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar desktop ── */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface transition-all duration-300 lg:flex',
          expanded ? 'w-[228px]' : 'w-[68px]',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center',
            expanded ? 'justify-between px-4' : 'justify-center',
          )}
        >
          {expanded ? <Wordmark /> : <Mark size={28} />}
          {expanded && (
            <button onClick={() => setExpanded(false)} className="text-ink-3 hover:text-ink">
              <PanelLeft className="size-4" />
            </button>
          )}
        </div>
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="mx-auto mb-1 text-ink-3 hover:text-ink"
          >
            <PanelLeft className="size-4 rotate-180" />
          </button>
        )}

        <nav className="flex-1 space-y-0.5 px-2.5 pt-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-xl py-2 text-sm font-semibold transition-colors',
                  expanded ? 'px-3' : 'justify-center px-0',
                  isActive ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-surface-alt',
                )
              }
            >
              <Icon className="size-[18px] shrink-0" />
              {expanded && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={cn('border-t border-line p-2.5', !expanded && 'flex justify-center')}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2.5 rounded-xl py-2 hover:bg-surface-alt',
                  expanded ? 'w-full px-2.5' : 'px-2',
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-brand-soft text-sm font-bold text-brand">
                  {initial}
                </span>
                {expanded && (
                  <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-ink">
                    {user?.name}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDark((d) => !d)}>
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                {dark ? 'Modo claro' : 'Modo oscuro'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="size-4" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ── Contenido ── */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Top bar fina (desktop) / header mobile con marca */}
        <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4">
          <div className="lg:hidden">
            <Wordmark />
          </div>
          <h1 className="hidden text-[15px] font-bold text-ink lg:block">
            {PAGE_TITLES[pathname] ?? 'MayordomoAI'}
          </h1>
          <DarkToggle dark={dark} onToggle={() => setDark((d) => !d)} />
        </header>

        <main className="flex-1 pb-20 lg:pb-0">
          <Outlet />
        </main>

        {/* ── TabBar mobile con FAB central ── */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-line bg-surface lg:hidden">
          {TABS.map((tab, i) =>
            tab === null ? (
              <RegistroDialog
                key="fab"
                trigger={
                  <button className="flex size-12 -translate-y-3 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-float">
                    <Plus className="size-6" />
                  </button>
                }
              />
            ) : (
              <NavLink
                key={i}
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 px-2 py-1',
                    isActive ? 'text-brand' : 'text-ink-3',
                  )
                }
              >
                <tab.icon className="size-5" />
                <span className="text-[10px] font-semibold">{tab.short}</span>
              </NavLink>
            ),
          )}
        </nav>
      </div>
    </div>
  );
}
