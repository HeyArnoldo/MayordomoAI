// MayordomoAI — Desktop (PWA en navegador): sidebar + vistas

function DeskNavItem({ icon, label, id, badge, collapsed }) {
  const { state, dispatch } = useStore();
  const active = state.deskRoute === id;
  return (
    <button
      onClick={() => dispatch({ type: 'DESK_NAV', v: id })}
      title={collapsed ? label : undefined}
      className={cx(
        'w-full flex items-center h-10 rounded-[10px] transition',
        collapsed ? 'justify-center px-0' : 'gap-3 px-3',
        active ? 'bg-brandSoft text-brandDeep dark:text-brand' : 'text-ink2 hover:bg-cardAlt',
      )}
    >
      <div className="relative shrink-0">
        <Icon name={icon} size={18} sw={active ? 2 : 1.8} />
        {badge && collapsed && (
          <span className="absolute -top-1.5 -right-2 font-mono text-[9px] font-bold bg-brand text-onBrand rounded-full px-1">
            {badge}
          </span>
        )}
      </div>
      {!collapsed && (
        <>
          <span
            className={cx(
              'text-[13.5px] flex-1 text-left',
              active ? 'font-semibold' : 'font-medium',
            )}
          >
            {label}
          </span>
          {badge && (
            <span className="font-mono text-[10.5px] font-bold bg-brand text-onBrand rounded-full px-1.5 py-0.5">
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}

function DeskSidebar() {
  const { state, dispatch } = useStore();
  const col = !state.deskSide;
  return (
    <div
      className={cx(
        'shrink-0 border-r border-line bg-card flex flex-col py-5 box-border transition-all duration-300',
        col ? 'w-[68px] px-2.5' : 'w-[228px] px-3.5',
      )}
    >
      <div className={cx('flex items-center', col ? 'justify-center' : 'justify-between px-1.5')}>
        {col ? <Mark size={28} /> : <Wordmark size={16.5} mark={26} />}
        {!col && (
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDE' })}
            title="Colapsar"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-ink3 hover:bg-cardAlt hover:text-ink"
          >
            <Icon name="dblL" size={15} />
          </button>
        )}
      </div>
      {col && (
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDE' })}
          title="Expandir"
          className="w-full h-9 mt-3 rounded-[10px] flex items-center justify-center text-ink3 hover:bg-cardAlt hover:text-ink"
        >
          <Icon name="dblR" size={16} />
        </button>
      )}
      <div className="flex flex-col gap-0.5 mt-6">
        <DeskNavItem icon="home" label="Inicio" id="dashboard" collapsed={col} />
        <DeskNavItem icon="list" label="Movimientos" id="movimientos" collapsed={col} />
        <DeskNavItem
          icon="chat"
          label="Conversaciones"
          id="conversaciones"
          badge="2"
          collapsed={col}
        />
        <DeskNavItem icon="chart" label="Reportes" id="reportes" collapsed={col} />
        <DeskNavItem icon="gear" label="Cajas y reparto" id="cajas" collapsed={col} />
        <DeskNavItem icon="sparkle" label="Ajustes" id="ajustes" collapsed={col} />
      </div>
      <div className="flex-1" />
      {!col && (
        <div className="rounded-xl border border-line bg-inset p-3 mb-3.5">
          <div className="flex items-center gap-1.5">
            <span className="w-[7px] h-[7px] rounded-full bg-pos" />
            <span className="font-semibold text-[12px] text-ink">Bot conectado</span>
          </div>
          <div className="font-mono text-[10.5px] text-ink3 mt-1">+51 987 654 321 · verificado</div>
        </div>
      )}
      <div className={cx('flex items-center', col ? 'justify-center' : 'gap-2.5 px-1')}>
        <Avatar size={32} name="J" />
        {!col && (
          <>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[12.5px] text-ink truncate">João Souza</div>
              <div className="text-[10.5px] text-ink3">Cuenta activa</div>
            </div>
            <button
              onClick={() => dispatch({ type: 'AUTH', v: 'login' })}
              className="text-ink3 hover:text-ink"
            >
              <Icon name="logout" size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DeskTopBar({ title, sub, actions }) {
  const { state, dispatch } = useStore();
  return (
    <div className="flex items-center justify-between px-7 pt-[18px] shrink-0">
      <div>
        <h1 className="font-bold text-[21px] tracking-[-0.025em] text-ink m-0">{title}</h1>
        <div className="text-[12.5px] text-ink2 mt-0.5">{sub}</div>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => dispatch({ type: 'MODE', v: state.mode === 'dark' ? 'light' : 'dark' })}
          className="w-9 h-9 rounded-[10px] bg-card border border-line flex items-center justify-center text-ink2 hover:bg-cardAlt"
        >
          <Icon name={state.mode === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
        {actions}
      </div>
    </div>
  );
}

// ── Vista: Dashboard ───────────────────────────────────────────
function DeskDashboard() {
  const { state, dispatch } = useStore();
  const gc = gastoCajas(state.cajas);
  const ahorro = state.cajas.find((c) => c.id === 'ahorro');
  const totalAsignado = gc.reduce((s, c) => s + asignadoDe(c), 0);
  const totalGastado = gc.reduce((s, c) => s + c.gastado, 0);
  return (
    <>
      <DeskTopBar
        title="Hola, João"
        sub="Martes 10 de junio · todo al día desde tu último mensaje"
        actions={
          <>
            <div className="flex items-center gap-1.5 bg-card border border-line rounded-[10px] px-3.5 py-2">
              <Icon name="calendar" size={14} className="text-ink2" />
              <span className="font-semibold text-[12.5px] text-ink">Junio 2026</span>
            </div>
            <Btn
              icon={<Icon name="plus" size={15} sw={2.4} />}
              onClick={() => dispatch({ type: 'SHEET', v: 'registro' })}
            >
              Registrar
            </Btn>
          </>
        }
      />
      <div className="flex-1 flex gap-4 px-7 pt-4 pb-5 min-h-0">
        <div className="flex-1 flex flex-col gap-3.5 min-w-0 overflow-y-auto">
          <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-3">
            <Card className="p-4">
              <SecLabel>Disponible este mes</SecLabel>
              <div className="mt-1.5">
                <Money
                  v={disponible(state.cajas)}
                  size={30}
                  weight="font-semibold"
                  className="text-ink"
                />
              </div>
              <div className="mt-2.5">
                <Progress pct={(totalGastado / totalAsignado) * 100} color="var(--c-brand)" h={5} />
              </div>
              <div className="text-[11.5px] text-ink2 mt-1.5">
                S/{fmt(totalGastado)} usados de S/{fmt(totalAsignado)}
              </div>
            </Card>
            <Card className="p-4">
              <SecLabel>Fondo de ahorro</SecLabel>
              <div className="mt-1.5">
                <Money v={ahorro.acumulado} size={21} weight="font-semibold" className="text-ink" />
              </div>
              <div className="flex items-center gap-1.5 mt-2.5">
                <Icon name="arrUp" size={12} sw={2.4} className="text-pos" />
                <span className="text-[11.5px] text-ink2">
                  +S/{fmt(asignadoDe(ahorro))} este mes
                </span>
              </div>
            </Card>
            <Card
              className="p-4 cursor-pointer hover:border-lineStrong"
              onClick={() => dispatch({ type: 'DESK_NAV', v: 'movimientos' })}
            >
              <SecLabel>Ámbito empresa</SecLabel>
              <div className="mt-1.5">
                <Money v={1280.4} size={21} weight="font-semibold" className="text-ink" />
              </div>
              <div className="text-[11.5px] text-ink2 mt-2.5">Último: Claude Max −S/372.71</div>
            </Card>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <SecLabel>Tus cajas</SecLabel>
              <button
                onClick={() => dispatch({ type: 'DESK_NAV', v: 'cajas' })}
                className="text-[12px] font-semibold text-brand"
              >
                Editar reparto
              </button>
            </div>
            <Card className="px-4 py-0.5">
              {gc.map((c, i) => (
                <CajaRow
                  key={c.id}
                  caja={c}
                  mode={state.mode}
                  last={i === gc.length - 1}
                  onClick={() => dispatch({ type: 'DESK_NAV', v: 'movimientos' })}
                />
              ))}
            </Card>
          </div>
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <SecLabel>Movimientos recientes</SecLabel>
              <button
                onClick={() => dispatch({ type: 'DESK_NAV', v: 'movimientos' })}
                className="text-[12px] font-semibold text-brand"
              >
                Ver historial ›
              </button>
            </div>
            <div className="px-4">
              {state.movs.slice(0, 3).map((m, i) => (
                <MovRow
                  key={m.id}
                  mov={m}
                  cajas={state.cajas}
                  mode={state.mode}
                  dense
                  last={i === 2}
                />
              ))}
            </div>
          </Card>
        </div>
        <DeskAssistantPanel />
      </div>
    </>
  );
}

// Panel del asistente (lateral, en dashboard)
function DeskAssistantPanel() {
  const { state } = useStore();
  const [input, setInput] = React.useState('');
  return (
    <Card className="w-[330px] shrink-0 flex flex-col overflow-hidden p-0">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line shrink-0">
        <Mark size={30} />
        <div className="flex-1">
          <div className="font-bold text-[13.5px] text-ink">Asistente</div>
          <div className="text-[11px] text-ink2">Mismo hilo que WhatsApp</div>
        </div>
        <CanalBadge canal="web" mode={state.mode} />
      </div>
      <div className="flex-1 overflow-y-auto px-3.5 pt-3.5 pb-2 flex flex-col gap-2.5 bg-page">
        <ChatBubble from="user" canal="whatsapp" time="1:15 p. m." mode={state.mode}>
          me gasté como 30 lucas en el almuerzo
        </ChatBubble>
        <ChatBubble from="bot" mode={state.mode}>
          Listo, <b>S/30 en Ocio</b> ✓
          <ConfirmCard
            cajaId="ocio"
            monto={30}
            restante={34.34}
            cajas={state.cajas}
            mode={state.mode}
          />
        </ChatBubble>
        <ChatBubble from="user" canal="web" time="Ahora" mode={state.mode}>
          ¿cuál fue mi gasto más fuerte de ayer?
        </ChatBubble>
        <ChatBubble from="bot" mode={state.mode}>
          Ayer tu mayor gasto fue <b>S/372.71</b> en Empresa (Claude Max).
        </ChatBubble>
      </div>
      <div className="px-3 py-2.5 border-t border-line shrink-0 flex items-center gap-2">
        <div className="flex-1 h-[38px] rounded-full bg-page border border-line flex items-center px-3.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregúntale a tu mayordomo…"
            className="flex-1 bg-transparent outline-none text-[12.5px] text-ink placeholder:text-ink3"
          />
        </div>
        <button className="w-[38px] h-[38px] rounded-full bg-brandSoft text-brandDeep dark:text-brand flex items-center justify-center shrink-0">
          <Icon name="mic" size={16} />
        </button>
      </div>
    </Card>
  );
}

// ── Vista: Movimientos (tabla) ─────────────────────────────────
function DeskMovimientos() {
  const { state, dispatch } = useStore();
  const [filtro, setFiltro] = React.useState('Todos');
  const map = { Gastos: 'gasto', Ingresos: 'ingreso', Tránsito: 'transito' };
  const vis = state.movs.filter((m) => (filtro === 'Todos' ? true : m.tipo === map[filtro]));
  return (
    <>
      <DeskTopBar
        title="Movimientos"
        sub={`${vis.length} registros · junio 2026`}
        actions={
          <>
            <Btn kind="secondary" icon={<Icon name="download" size={15} />}>
              Exportar
            </Btn>
            <Btn
              icon={<Icon name="plus" size={15} sw={2.4} />}
              onClick={() => dispatch({ type: 'SHEET', v: 'registro' })}
            >
              Registrar
            </Btn>
          </>
        }
      />
      <div className="flex-1 px-7 pt-4 pb-5 overflow-y-auto">
        <div className="flex gap-2 mb-3">
          {['Todos', 'Gastos', 'Ingresos', 'Tránsito'].map((ch) => (
            <button
              key={ch}
              onClick={() => setFiltro(ch)}
              className={cx(
                'px-4 h-9 rounded-full font-semibold text-[12.5px] border transition',
                filtro === ch
                  ? 'bg-ink text-page border-ink'
                  : 'bg-card text-ink2 border-lineStrong hover:bg-cardAlt',
              )}
            >
              {ch}
            </button>
          ))}
        </div>
        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-[40px_1fr_140px_120px_110px_100px] gap-3 px-4 py-2.5 border-b border-line bg-inset">
            {['', 'Concepto', 'Caja', 'Origen', 'Fecha', 'Monto'].map((h) => (
              <SecLabel key={h} className={h === 'Monto' ? 'text-right' : ''}>
                {h}
              </SecLabel>
            ))}
          </div>
          {vis.map((m, i) => {
            const caja = state.cajas.find((c) => c.id === m.caja);
            const col = m.caja ? cajaColor(m.caja, state.mode) : 'var(--c-ink3)';
            const isIn = m.tipo === 'ingreso';
            return (
              <div
                key={m.id}
                onClick={() => dispatch({ type: 'DESK_NAV', v: 'movimientos' })}
                className={cx(
                  'grid grid-cols-[40px_1fr_140px_120px_110px_100px] gap-3 px-4 py-3 items-center hover:bg-cardAlt cursor-pointer',
                  i < vis.length - 1 && 'border-b border-line',
                  m.anulado && 'opacity-45',
                )}
              >
                <div
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                  style={{
                    background:
                      (m.caja ? cajaColor(m.caja, state.mode) : isIn ? 'var(--c-brand)' : '#888') +
                      (state.mode === 'dark' ? '26' : '17'),
                  }}
                >
                  <Icon
                    name={isIn ? 'arrDown' : m.tipo === 'transito' ? 'swap' : 'arrUp'}
                    size={15}
                    sw={2.1}
                    style={{ color: col }}
                  />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cx(
                      'font-semibold text-[13px] text-ink truncate',
                      m.anulado && 'line-through',
                    )}
                  >
                    {m.nota}
                  </span>
                  {m.voz && <Icon name="mic" size={11} className="text-ink3" />}
                </div>
                <span className="text-[12.5px] font-semibold" style={{ color: col }}>
                  {m.caja === 'empresa'
                    ? 'Empresa'
                    : caja
                      ? caja.nombre
                      : isIn
                        ? 'Ingreso'
                        : 'Tránsito'}
                </span>
                <div>
                  <CanalBadge
                    canal={m.origen === 'whatsapp' ? 'whatsapp' : 'web'}
                    mode={state.mode}
                  />
                </div>
                <span className="text-[11.5px] text-ink3">{m.fecha.split(' · ')[0]}</span>
                <div className="text-right">
                  <Money
                    v={m.monto}
                    size={13.5}
                    sign={isIn ? '+' : m.tipo === 'transito' ? '↔' : '−'}
                    className={isIn ? 'text-pos' : 'text-ink'}
                  />
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </>
  );
}

// ── Vista: Conversaciones (rail + hilo, tipo ChatGPT) ──────────
function DeskConversaciones() {
  const { state, dispatch } = useStore();
  const chat = state.chats.find((c) => c.id === state.activeChat) || state.chats[0];
  const floating = state.railFloat;
  const railEl = (
    <ConversationRail
      width={284}
      onClose={() => dispatch({ type: 'TOGGLE_RAIL' })}
      onToggleFloat={() => dispatch({ type: 'TOGGLE_RAIL_FLOAT' })}
      floating={floating}
    />
  );
  return (
    <div className="flex-1 flex min-h-0 relative overflow-hidden">
      {/* rail fijado (empuja el hilo) */}
      {state.railOpen && !floating && <div className="shrink-0 h-full">{railEl}</div>}
      {/* hilo */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* header del hilo */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-line shrink-0">
          {(!state.railOpen || floating) && (
            <button
              onClick={() => dispatch({ type: 'TOGGLE_RAIL' })}
              title={state.railOpen ? 'Ocultar conversaciones' : 'Ver conversaciones'}
              className="w-9 h-9 rounded-[10px] bg-card border border-line flex items-center justify-center text-ink2 hover:bg-cardAlt shrink-0"
            >
              <Icon name="sidebar" size={17} />
            </button>
          )}
          <div className="w-9 h-9 shrink-0">
            <Mark size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[15.5px] text-ink truncate">{chat.titulo}</div>
            <div className="flex items-center gap-1.5 min-w-0">
              {chat.sistema ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-pos shrink-0" />
                  <span className="text-[11.5px] text-ink2 truncate">
                    Sincronizado con WhatsApp · responde en ambos lados
                  </span>
                </>
              ) : (
                <span className="text-[11.5px] text-ink2 truncate">
                  Sesión de consulta · puede anotar y analizar
                </span>
              )}
            </div>
          </div>
          {chat.sistema && (
            <div className="shrink-0">
              <CanalBadge canal="whatsapp" mode={state.mode} />
            </div>
          )}
          <button
            onClick={() => dispatch({ type: 'NEW_CHAT' })}
            title="Nueva conversación"
            className="w-9 h-9 rounded-[10px] bg-card border border-line flex items-center justify-center text-ink2 hover:bg-cardAlt shrink-0"
          >
            <Icon name="penNew" size={16} />
          </button>
          <button
            onClick={() => dispatch({ type: 'MODE', v: state.mode === 'dark' ? 'light' : 'dark' })}
            className="w-9 h-9 rounded-[10px] bg-card border border-line flex items-center justify-center text-ink2 hover:bg-cardAlt shrink-0"
          >
            <Icon name={state.mode === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>
        </div>
        <div className="flex-1 flex flex-col min-h-0 max-w-[820px] w-full mx-auto">
          <ChatThread />
        </div>
      </div>
      {/* rail flotante (overlap sobre el hilo) */}
      {state.railOpen && floating && (
        <>
          <div
            className="absolute inset-0 z-30"
            onClick={() => dispatch({ type: 'TOGGLE_RAIL' })}
            style={{
              background: state.mode === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(22,33,26,0.28)',
            }}
          />
          <div className="absolute left-0 top-0 bottom-0 z-40 shadow-2xl animate-drawer">
            {railEl}
          </div>
        </>
      )}
    </div>
  );
}

// ── Vista: Reportes ────────────────────────────────────────────
function DeskReportes() {
  const { state } = useStore();
  const gc = gastoCajas(state.cajas)
    .filter((c) => c.gastado > 0)
    .sort((a, b) => b.gastado - a.gastado);
  const max = gc[0] ? gc[0].gastado : 1;
  const semanas = [
    { label: 'Sem 1', v: 320 },
    { label: 'Sem 2', v: 510 },
    { label: 'Sem 3', v: 624 },
    { label: 'Sem 4', v: 290 },
  ];
  const maxSem = Math.max(...semanas.map((s) => s.v));
  return (
    <>
      <DeskTopBar
        title="Reportes"
        sub="Junio 2026 · fecha contable America/Lima"
        actions={
          <Btn kind="secondary" icon={<Icon name="download" size={15} />}>
            Exportar PDF
          </Btn>
        }
      />
      <div className="flex-1 px-7 pt-4 pb-5 overflow-y-auto flex flex-col gap-3.5">
        <div className="grid grid-cols-4 gap-3">
          {[
            ['Ingresos', '+', 3200, 'text-pos', '2 ingresos'],
            ['Gastos', '−', 1744.36, 'text-ink', '−12% vs. mayo'],
            ['Ahorro', '+', 800, '', 'acumulado S/4350'],
            ['Tránsito', '↔', 30, 'text-ink2', 'reenvíos'],
          ].map(([t, sg, v, cls, sub]) => (
            <Card key={t} className="p-4">
              <SecLabel>{t}</SecLabel>
              <div className="mt-1.5">
                <Money v={v} size={23} weight="font-semibold" sign={sg} className={cls} />
              </div>
              <div className="text-[11px] text-ink3 mt-1">{sub}</div>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <Card className="p-5">
            <SecLabel>Gasto por semana</SecLabel>
            <div className="flex items-end gap-4 h-[160px] mt-5">
              {semanas.map((s, i) => (
                <div
                  key={s.label}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
                >
                  <span className="font-mono text-[11px] text-ink2">{s.v}</span>
                  <div
                    className="w-full max-w-[60px] rounded-t-[8px]"
                    style={{
                      height: (s.v / maxSem) * 110,
                      background: i === 2 ? 'var(--c-brand)' : 'var(--c-brandSoft)',
                      border: i === 2 ? 'none' : '1px solid var(--c-brand)',
                    }}
                  />
                  <span className="font-mono text-[11px] text-ink3">{s.label}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <SecLabel className="mb-4">Gasto por caja</SecLabel>
            <div className="flex flex-col gap-3">
              {gc.map((c) => {
                const col = cajaColor(c.id, state.mode);
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="w-[70px] font-semibold text-[12.5px] text-ink2 shrink-0">
                      {c.nombre}
                    </span>
                    <div className="flex-1 h-4 rounded-md bg-inset overflow-hidden">
                      <div
                        className="h-full rounded-md"
                        style={{ width: (c.gastado / max) * 100 + '%', background: col }}
                      />
                    </div>
                    <span className="w-20 text-right font-mono text-[12px] font-semibold text-ink shrink-0">
                      S/{fmt(c.gastado)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

// ── Vista: Cajas ───────────────────────────────────────────────
function DeskCajas() {
  const { state, dispatch } = useStore();
  const total = state.cajas.reduce((s, c) => s + c.pct, 0);
  const ok = total === 100;
  return (
    <>
      <DeskTopBar
        title="Cajas y reparto"
        sub="Define cómo se distribuye cada ingreso"
        actions={
          <Btn kind="soft" icon={<Icon name="plus" size={15} sw={2.4} />}>
            Nueva caja
          </Btn>
        }
      />
      <div className="flex-1 px-7 pt-4 pb-5 overflow-y-auto max-w-[860px] w-full mx-auto flex flex-col gap-3">
        <Card className="p-4" style={{ borderColor: ok ? 'var(--c-brand)' : 'var(--c-neg)' }}>
          <div className="flex items-center gap-3">
            <div
              className={cx(
                'w-9 h-9 rounded-xl flex items-center justify-center',
                ok ? 'bg-brandSoft text-brand' : 'bg-negSoft text-neg',
              )}
            >
              <Icon name={ok ? 'check' : 'x'} size={16} sw={2.4} />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[14px] text-ink">
                Los porcentajes suman{' '}
                <span className={cx('font-mono', ok ? 'text-brand' : 'text-neg')}>{total}%</span>
              </div>
              <div className="text-[12px] text-ink2">
                {ok
                  ? 'Reparto válido — cada ingreso se distribuye automáticamente'
                  : `Ajusta ${Math.abs(100 - total)}% para cuadrar`}
              </div>
            </div>
            <div className="flex h-2.5 w-48 rounded-full overflow-hidden gap-0.5">
              {state.cajas.map((c) => (
                <div
                  key={c.id}
                  style={{ width: c.pct + '%', background: cajaColor(c.id, state.mode) }}
                />
              ))}
            </div>
          </div>
        </Card>
        {state.cajas.map((c) => {
          const col = cajaColor(c.id, state.mode);
          return (
            <Card key={c.id} className="p-0">
              <div className="flex items-center gap-3.5 px-4 py-3">
                <Icon name="grip" size={16} className="text-ink3" />
                <span className="w-3 h-3 rounded-[4px]" style={{ background: col }} />
                <div className="flex-1">
                  <div className="font-semibold text-[14.5px] text-ink">{c.nombre}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge color={c.tipo === 'fondo' ? col : undefined}>
                      {c.tipo === 'fondo' ? 'fondo · acumula' : 'gasto · reinicia'}
                    </Badge>
                    <span className="text-[11.5px] text-ink3">{c.ambito}</span>
                  </div>
                </div>
                <span className="font-mono text-[12px] text-ink3">
                  asignado S/{fmt(asignadoDe(c))}
                </span>
                <div className="flex items-center bg-inset border border-line rounded-xl overflow-hidden ml-2">
                  <button
                    onClick={() => dispatch({ type: 'SET_PCT', id: c.id, delta: -5 })}
                    className="w-9 h-9 flex items-center justify-center text-ink2 hover:bg-cardAlt"
                  >
                    <Icon name="minus" size={15} />
                  </button>
                  <div className="w-14 text-center font-mono font-semibold text-[14.5px] text-ink border-x border-line leading-9">
                    {c.pct}%
                  </div>
                  <button
                    onClick={() => dispatch({ type: 'SET_PCT', id: c.id, delta: 5 })}
                    className="w-9 h-9 flex items-center justify-center text-ink2 hover:bg-cardAlt"
                  >
                    <Icon name="plus" size={15} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

// ── Vista: Ajustes ─────────────────────────────────────────────
function DeskAjustes() {
  const { state, dispatch } = useStore();
  return (
    <>
      <DeskTopBar title="Ajustes" sub="Tu cuenta, apariencia y conexión con WhatsApp" />
      <div className="flex-1 px-7 pt-4 pb-5 overflow-y-auto max-w-[720px] w-full mx-auto flex flex-col gap-4">
        <Card className="p-5 flex items-center gap-4">
          <Avatar size={56} name="J" />
          <div className="flex-1">
            <div className="font-bold text-[17px] text-ink">João Souza</div>
            <div className="text-[13px] text-ink2">joaosouzareyna@gmail.com</div>
          </div>
          <Badge
            color="var(--c-brand)"
            style={{ background: 'var(--c-brandSoft)', color: 'var(--c-brandDeep)' }}
          >
            Cuenta activa
          </Badge>
        </Card>
        <Card className="p-5">
          <SecLabel className="mb-4">Apariencia</SecLabel>
          <div className="flex items-center justify-between mb-5">
            <span className="text-[14px] text-ink">Modo oscuro</span>
            <Toggle
              on={state.mode === 'dark'}
              onChange={(v) => dispatch({ type: 'MODE', v: v ? 'dark' : 'light' })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-ink">Color de acento</span>
            <div className="flex gap-2.5">
              {[
                ['verde', '#0E7A4D'],
                ['teal', '#0F7E96'],
                ['indigo', '#41599E'],
              ].map(([k, c]) => (
                <button
                  key={k}
                  onClick={() => dispatch({ type: 'ACCENT', v: k })}
                  className={cx(
                    'w-9 h-9 rounded-full flex items-center justify-center',
                    state.accent === k && 'ring-2 ring-offset-2 ring-offset-card',
                  )}
                  style={{ background: c, ['--tw-ring-color']: c }}
                >
                  {state.accent === k && (
                    <Icon name="check" size={15} sw={2.6} className="text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <SecLabel className="mb-4">WhatsApp</SecLabel>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brandSoft text-brand flex items-center justify-center">
              <Icon name="phone" size={19} />
            </div>
            <div className="flex-1">
              <div className="font-mono font-semibold text-[14px] text-ink">+51 987 654 321</div>
              <div className="text-[12px] text-ink3">Número del bot · verificado</div>
            </div>
            <Badge color="var(--c-pos)">
              <Icon name="check" size={11} sw={2.6} /> Verificado
            </Badge>
          </div>
        </Card>
      </div>
    </>
  );
}

function DeskApp() {
  const { state } = useStore();
  const views = {
    dashboard: DeskDashboard,
    movimientos: DeskMovimientos,
    conversaciones: DeskConversaciones,
    reportes: DeskReportes,
    cajas: DeskCajas,
    ajustes: DeskAjustes,
  };
  const View = views[state.deskRoute] || DeskDashboard;
  return (
    <div className="flex h-full bg-page overflow-hidden">
      <DeskSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div key={state.deskRoute} className="flex-1 flex flex-col min-h-0 animate-fade">
          <View />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  DeskApp,
  DeskDashboard,
  DeskMovimientos,
  DeskConversaciones,
  DeskReportes,
  DeskCajas,
  DeskAjustes,
});
