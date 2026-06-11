// MayordomoAI — app móvil: shell con tabs + dashboard + movimientos + caja detalle + notif

// ── Top bar reutilizable ───────────────────────────────────────
function MobileHeader({ title, back, right }) {
  const { dispatch } = useStore();
  return (
    <div className="flex items-center justify-between px-5 pt-2 pb-2.5 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {back && (
          <button
            onClick={() => dispatch({ type: 'BACK' })}
            className="w-9 h-9 -ml-1 rounded-full bg-card border border-line flex items-center justify-center text-ink2 shrink-0"
          >
            <Icon name="chevL" size={16} />
          </button>
        )}
        {title ? (
          <h1 className="font-bold text-[22px] tracking-[-0.03em] text-ink truncate">{title}</h1>
        ) : (
          <Wordmark size={17} mark={26} />
        )}
      </div>
      <div className="flex items-center gap-2.5 shrink-0">{right}</div>
    </div>
  );
}

function TabBar() {
  const { state, dispatch } = useStore();
  const tabs = [
    { id: 'dashboard', label: 'Inicio', icon: 'home' },
    { id: 'movimientos', label: 'Movs', icon: 'list' },
    { id: 'plus' },
    { id: 'chat', label: 'Chat', icon: 'chat' },
    { id: 'cajas', label: 'Cajas', icon: 'gear' },
  ];
  return (
    <div className="shrink-0 flex items-start justify-around px-3 pt-2.5 pb-7 bg-card border-t border-line">
      {tabs.map((tb) =>
        tb.id === 'plus' ? (
          <button
            key="plus"
            onClick={() => dispatch({ type: 'SHEET', v: 'registro' })}
            className="w-[50px] h-[50px] rounded-[18px] bg-brand -mt-0.5 flex items-center justify-center active:scale-95 transition"
            style={{ boxShadow: '0 6px 16px var(--c-brand)' }}
          >
            <Icon name="plus" size={22} sw={2.4} className="text-onBrand" />
          </button>
        ) : (
          <button
            key={tb.id}
            onClick={() => dispatch({ type: 'GO_TAB', v: tb.id })}
            className="flex flex-col items-center gap-1 w-14 pt-1"
          >
            <Icon
              name={tb.icon}
              size={21}
              sw={state.route === tb.id ? 2.1 : 1.8}
              className={state.route === tb.id ? 'text-brand' : 'text-ink3'}
            />
            <span
              className={cx(
                'text-[10.5px] font-semibold',
                state.route === tb.id ? 'text-brand' : 'text-ink3',
              )}
            >
              {tb.label}
            </span>
          </button>
        ),
      )}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────
function DashboardScreen() {
  const { state, dispatch } = useStore();
  const gc = gastoCajas(state.cajas);
  const ahorro = state.cajas.find((c) => c.id === 'ahorro');
  const totalAsignado = gc.reduce((s, c) => s + asignadoDe(c), 0);
  const totalGastado = gc.reduce((s, c) => s + c.gastado, 0);
  const recientes = state.movs.slice(0, 1);
  return (
    <>
      <MobileHeader
        right={
          <>
            <RoundBtn
              name="bell"
              onClick={() => dispatch({ type: 'SHEET', v: 'notif' })}
              badge="3"
            />
            <button onClick={() => dispatch({ type: 'NAV', v: 'ajustes' })}>
              <Avatar size={36} name="J" />
            </button>
          </>
        }
      />
      <div className="flex-1 px-5 flex flex-col gap-2.5 overflow-y-auto pb-2">
        {/* hero disponible */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <SecLabel>Disponible · Junio 2026</SecLabel>
              <div className="mt-1.5">
                <Money
                  v={disponible(state.cajas)}
                  size={30}
                  weight="font-semibold"
                  className="text-ink"
                />
              </div>
              <div className="text-[12.5px] text-ink2 mt-1">
                Gastaste <span className="font-mono font-semibold">S/{fmt(totalGastado)}</span> de
                S/{fmt(totalAsignado)}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge
                color="var(--c-brand)"
                style={{ background: 'var(--c-brandSoft)', color: 'var(--c-brandDeep)' }}
              >
                Personal
              </Badge>
              <button
                onClick={() => dispatch({ type: 'NAV', v: 'empresa' })}
                className="text-[11.5px] text-ink3"
              >
                Empresa ›
              </button>
            </div>
          </div>
          <div className="mt-2.5">
            <Progress pct={(totalGastado / totalAsignado) * 100} color="var(--c-brand)" h={7} />
          </div>
        </Card>
        {/* ahorro destacado */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <SecLabel>Tus cajas</SecLabel>
            <button
              onClick={() => dispatch({ type: 'GO_TAB', v: 'cajas' })}
              className="text-[12px] font-semibold text-brand whitespace-nowrap shrink-0"
            >
              Editar %
            </button>
          </div>
          <Card
            className="p-0 overflow-hidden"
            onClick={() => dispatch({ type: 'NAV', v: 'caja:ahorro' })}
          >
            <div className="flex items-center gap-3 px-4 py-2.5">
              <div
                className="w-[38px] h-[38px] rounded-xl flex items-center justify-center"
                style={{
                  background:
                    cajaColor('ahorro', state.mode) + (state.mode === 'dark' ? '26' : '17'),
                }}
              >
                <Icon
                  name="arrUp"
                  size={17}
                  sw={2.2}
                  style={{ color: cajaColor('ahorro', state.mode) }}
                />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[14px] text-ink">
                  Ahorro{' '}
                  <span className="font-mono text-[10.5px] font-medium text-ink3 ml-1">
                    FONDO · 25%
                  </span>
                </div>
                <div className="text-[11.5px] text-ink2 mt-px">
                  Acumula +S/{fmt(asignadoDe(ahorro))} este mes
                </div>
              </div>
              <Money
                v={ahorro.acumulado}
                size={18}
                weight="font-semibold"
                style={{ color: cajaColor('ahorro', state.mode) }}
                className="!text-[color:currentColor]"
              />
            </div>
          </Card>
        </div>
        {/* lista de cajas */}
        <Card className="px-4 py-0.5">
          {gc.map((c, i) => (
            <CajaRow
              key={c.id}
              caja={c}
              mode={state.mode}
              last={i === gc.length - 1}
              onClick={() => dispatch({ type: 'NAV', v: 'caja:' + c.id })}
            />
          ))}
        </Card>
        {/* recientes */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <SecLabel>Recientes</SecLabel>
            <button
              onClick={() => dispatch({ type: 'GO_TAB', v: 'movimientos' })}
              className="text-[12px] font-semibold text-brand"
            >
              Ver todo ›
            </button>
          </div>
          {recientes.map((m, i) => (
            <MovRow
              key={m.id}
              mov={m}
              cajas={state.cajas}
              mode={state.mode}
              dense
              last
              onClick={() => dispatch({ type: 'NAV', v: 'mov:' + m.id })}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// ── Movimientos (historial) ────────────────────────────────────
function MovimientosScreen() {
  const { state, dispatch } = useStore();
  const [filtro, setFiltro] = React.useState('Todos');
  const chips = ['Todos', 'Gastos', 'Ingresos', 'Tránsito'];
  const map = { Gastos: 'gasto', Ingresos: 'ingreso', Tránsito: 'transito' };
  const visibles = state.movs.filter((m) => (filtro === 'Todos' ? true : m.tipo === map[filtro]));
  const dias = [...new Set(visibles.map((m) => m.dia))];
  const total = visibles.filter((m) => !m.anulado).reduce((s, m) => s + m.monto, 0);
  return (
    <>
      <MobileHeader
        title="Movimientos"
        right={
          <>
            <RoundBtn name="calendar" />
            <RoundBtn name="search" />
          </>
        }
      />
      <div className="px-5 shrink-0">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {chips.map((ch) => (
            <button
              key={ch}
              onClick={() => setFiltro(ch)}
              className={cx(
                'px-3.5 h-8 rounded-full font-semibold text-[12.5px] border whitespace-nowrap shrink-0 transition',
                filtro === ch
                  ? 'bg-ink text-page border-ink'
                  : 'bg-card text-ink2 border-lineStrong',
              )}
            >
              {ch}
            </button>
          ))}
        </div>
        <Card className="mt-3 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="filter" size={14} className="text-ink3" />
            <span className="text-[12.5px] text-ink2">{visibles.length} movimientos · junio</span>
          </div>
          <Money v={total} size={14} className="text-ink2" />
        </Card>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        {dias.map((dia) => (
          <div key={dia}>
            <SecLabel className="my-3.5 mb-0.5">{dia}</SecLabel>
            {visibles
              .filter((m) => m.dia === dia)
              .map((m, i, arr) => (
                <MovRow
                  key={m.id}
                  mov={m}
                  cajas={state.cajas}
                  mode={state.mode}
                  last={i === arr.length - 1}
                  onClick={() => dispatch({ type: 'NAV', v: 'mov:' + m.id })}
                />
              ))}
          </div>
        ))}
        <div className="h-2" />
      </div>
    </>
  );
}

// ── Detalle de caja ────────────────────────────────────────────
function CajaDetalleScreen({ cajaId }) {
  const { state, dispatch } = useStore();
  const caja = state.cajas.find((c) => c.id === cajaId);
  if (!caja) return null;
  const c = cajaColor(caja.id, state.mode);
  const asign = asignadoDe(caja);
  const s = saldoDe(caja);
  const pct = asign > 0 ? (caja.gastado / asign) * 100 : 0;
  const isFondo = caja.tipo === 'fondo';
  const movs = state.movs.filter((m) => m.caja === cajaId);
  const dk = state.mode === 'dark';
  return (
    <>
      <MobileHeader
        back
        title={caja.nombre}
        right={<RoundBtn name="edit" onClick={() => dispatch({ type: 'GO_TAB', v: 'cajas' })} />}
      />
      <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-3">
        <Card className="p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: c }} />
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[4px]" style={{ background: c }} />
            <Badge color={c}>{isFondo ? 'fondo · acumula' : 'gasto · reinicia'}</Badge>
            <span className="text-[11.5px] text-ink3">personal · {caja.pct}%</span>
          </div>
          <div className="mt-3">
            <SecLabel>{isFondo ? 'Acumulado' : 'Saldo disponible'}</SecLabel>
            <div className="mt-1">
              <Money
                v={isFondo ? caja.acumulado : s}
                size={36}
                weight="font-semibold"
                className={s < 0 && !isFondo ? 'text-neg' : ''}
                style={{ color: isFondo ? c : s < 0 ? undefined : 'var(--c-ink)' }}
              />
            </div>
          </div>
          {!isFondo && (
            <>
              <div className="mt-4">
                <Progress pct={pct} color={c} h={8} track="var(--c-inset)" />
              </div>
              <div className="flex justify-between mt-2 text-[12px]">
                <span className="text-ink2">
                  Gastado{' '}
                  <span className="font-mono font-semibold text-ink">S/{fmt(caja.gastado)}</span>
                </span>
                <span className="text-ink3 font-mono">de S/{fmt(asign)}</span>
              </div>
            </>
          )}
          {isFondo && (
            <div className="mt-3 text-[12.5px] text-ink2">
              Suma{' '}
              <span className="font-mono font-semibold" style={{ color: c }}>
                +S/{fmt(asign)}
              </span>{' '}
              cada mes y no se reinicia.
            </div>
          )}
        </Card>
        <Btn
          kind="soft"
          className="w-full"
          icon={<Icon name="plus" size={16} sw={2.4} />}
          onClick={() => dispatch({ type: 'SHEET', v: 'registro' })}
        >
          Registrar en {caja.nombre}
        </Btn>
        <div>
          <SecLabel className="mb-1">Movimientos de esta caja</SecLabel>
          {movs.length ? (
            movs.map((m, i) => (
              <MovRow
                key={m.id}
                mov={m}
                cajas={state.cajas}
                mode={state.mode}
                last={i === movs.length - 1}
                onClick={() => dispatch({ type: 'NAV', v: 'mov:' + m.id })}
              />
            ))
          ) : (
            <div className="text-[13px] text-ink3 py-6 text-center">
              Aún no hay movimientos en {caja.nombre}.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Detalle de movimiento ──────────────────────────────────────
function MovDetalleScreen({ movId }) {
  const { state, dispatch } = useStore();
  const mov = state.movs.find((m) => m.id === movId);
  if (!mov) return null;
  const caja = state.cajas.find((c) => c.id === mov.caja);
  const c = mov.caja ? cajaColor(mov.caja, state.mode) : 'var(--c-ink3)';
  const isIn = mov.tipo === 'ingreso';
  const rows = [
    ['Tipo', mov.tipo === 'ingreso' ? 'Ingreso' : mov.tipo === 'transito' ? 'Tránsito' : 'Gasto'],
    ['Caja', mov.caja === 'empresa' ? 'Empresa' : caja ? caja.nombre : '—'],
    ['Fecha', mov.fecha],
    ['Origen', mov.origen === 'whatsapp' ? 'WhatsApp' : 'PWA web'],
    ['Estado', mov.anulado ? 'Anulado' : 'Confirmado'],
  ];
  return (
    <>
      <MobileHeader back title="Movimiento" />
      <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-3">
        <Card className="p-6 flex flex-col items-center text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{
              background:
                typeof c === 'string' && c.startsWith('#') ? c + '1A' : 'var(--c-cardAlt)',
            }}
          >
            <Icon
              name={isIn ? 'arrDown' : mov.tipo === 'transito' ? 'swap' : 'arrUp'}
              size={24}
              sw={2}
              style={{ color: c }}
            />
          </div>
          <Money
            v={mov.monto}
            size={38}
            weight="font-semibold"
            sign={isIn ? '+' : mov.tipo === 'transito' ? '↔' : '−'}
            className={isIn ? 'text-pos' : 'text-ink'}
          />
          <div className="text-[15px] font-semibold text-ink mt-2">{mov.nota}</div>
          {mov.voz && (
            <Badge className="mt-2">
              <Icon name="mic" size={11} /> nota de voz
            </Badge>
          )}
        </Card>
        {mov.split && (
          <Card className="p-4">
            <SecLabel className="mb-3">Reparto de este ingreso</SecLabel>
            <div className="flex flex-col gap-2">
              {gastoCajas(state.cajas)
                .concat(state.cajas.filter((c) => c.tipo === 'fondo'))
                .map((cj) => (
                  <div key={cj.id} className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-[3px]"
                      style={{ background: cajaColor(cj.id, state.mode) }}
                    />
                    <span className="text-[12.5px] text-ink2 flex-1">{cj.nombre}</span>
                    <span className="font-mono text-[12px] text-ink">
                      S/{fmt((mov.monto * cj.pct) / 100)}
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        )}
        <Card className="p-0 overflow-hidden">
          {rows.map(([k, v], i) => (
            <div
              key={k}
              className={cx(
                'flex items-center justify-between px-4 py-3',
                i < rows.length - 1 && 'border-b border-line',
              )}
            >
              <span className="text-[12.5px] text-ink2">{k}</span>
              <span className="text-[13px] font-semibold text-ink">{v}</span>
            </div>
          ))}
        </Card>
        {!mov.anulado && (
          <div className="flex gap-2.5">
            <Btn kind="secondary" className="flex-1" icon={<Icon name="edit" size={15} />}>
              Editar
            </Btn>
            <Btn
              kind="danger"
              className="flex-1"
              icon={<Icon name="trash" size={15} />}
              onClick={() => {
                dispatch({ type: 'ANULAR', id: mov.id });
                dispatch({ type: 'BACK' });
              }}
            >
              Anular
            </Btn>
          </div>
        )}
        <div className="text-center text-[11.5px] text-ink3 leading-relaxed">
          Los movimientos no se borran: se marcan como anulados (soft delete) y el saldo se
          recalcula.
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  MobileHeader,
  TabBar,
  DashboardScreen,
  MovimientosScreen,
  CajaDetalleScreen,
  MovDetalleScreen,
});
