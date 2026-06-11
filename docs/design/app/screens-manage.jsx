// MayordomoAI — Registro (sheet) + Cajas config + Reportes + Ajustes + Notif + Empresa

// ── Registro manual (sheet con teclado numérico) ───────────────
function RegistroSheet() {
  const { state, dispatch } = useStore();
  const [tipo, setTipo] = React.useState('Gasto');
  const [cajaSel, setCajaSel] = React.useState('pasajes');
  const [amount, setAmount] = React.useState('24.50');
  const [nota, setNota] = React.useState('');
  const gc = gastoCajas(state.cajas);
  const caja = state.cajas.find((c) => c.id === cajaSel);
  const monto = parseFloat(amount || '0') || 0;
  const restante = caja ? saldoDe(caja) - monto : 0;

  const tap = (k) => {
    setAmount((prev) => {
      if (k === 'del') return prev.slice(0, -1) || '0';
      if (k === '.') return prev.includes('.') ? prev : prev + '.';
      if (prev === '0') return k;
      if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
      return prev + k;
    });
  };
  const close = () => dispatch({ type: 'SHEET', v: null });
  const registrar = () => {
    if (monto <= 0) return;
    dispatch({
      type: 'ADD_MOV',
      mov: {
        tipo: tipo === 'Gasto' ? 'gasto' : tipo === 'Ingreso' ? 'ingreso' : 'transito',
        caja: tipo === 'Gasto' ? cajaSel : null,
        monto,
        nota: nota || (tipo === 'Gasto' ? caja.nombre : tipo),
        split: tipo === 'Ingreso',
      },
      toast: `✓ Registrado S/${fmt(monto)}${tipo === 'Gasto' ? ' en ' + caja.nombre : ''}`,
    });
    close();
  };

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      onClick={close}
      style={{ background: state.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(22,33,26,0.32)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-page rounded-t-[24px] px-5 pt-2.5 pb-9 shadow-2xl animate-sheet"
      >
        <div className="w-10 h-[4.5px] rounded-full bg-lineStrong mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[19px] tracking-[-0.02em] text-ink">
            Registrar movimiento
          </h2>
          <button
            onClick={close}
            className="w-8 h-8 rounded-full bg-cardAlt flex items-center justify-center text-ink2"
          >
            <Icon name="x" size={14} sw={2.2} />
          </button>
        </div>
        {/* tipo */}
        <div className="flex bg-cardAlt rounded-xl p-1 gap-1">
          {['Gasto', 'Ingreso', 'Tránsito'].map((tp) => (
            <button
              key={tp}
              onClick={() => setTipo(tp)}
              className={cx(
                'flex-1 h-9 rounded-[9px] font-semibold text-[13.5px] box-border transition',
                tipo === tp ? 'bg-card text-ink shadow-card border border-line' : 'text-ink2',
              )}
            >
              {tp}
            </button>
          ))}
        </div>
        {/* monto */}
        <div className="text-center pt-5 pb-3">
          <SecLabel>Monto</SecLabel>
          <div className="mt-1.5 flex items-baseline justify-center gap-1.5">
            <span className="font-mono text-[22px] text-ink3 font-medium">S/</span>
            <span className="font-mono text-[44px] font-semibold text-ink tracking-[-0.03em]">
              {amount.includes('.') ? amount.split('.')[0] : amount}
              {amount.includes('.') && <span className="text-ink3">.{amount.split('.')[1]}</span>}
            </span>
            <span className="w-0.5 h-9 bg-brand rounded-full self-center animate-pulse" />
          </div>
        </div>
        {/* caja (solo gasto) */}
        {tipo === 'Gasto' && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
            {gc.map((c) => {
              const col = cajaColor(c.id, state.mode);
              const sel = cajaSel === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCajaSel(c.id)}
                  className={cx(
                    'flex items-center gap-1.5 px-3 h-9 rounded-full box-border shrink-0 border-[1.5px]',
                    sel ? '' : 'bg-card border-line',
                  )}
                  style={
                    sel
                      ? {
                          background: col + (state.mode === 'dark' ? '30' : '1C'),
                          borderColor: col,
                        }
                      : {}
                  }
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: col }} />
                  <span className={cx('font-semibold text-[13px]', sel ? 'text-ink' : 'text-ink2')}>
                    {c.nombre}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {/* nota */}
        <div className="flex gap-2 mt-3">
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (opcional)"
            className="flex-1 h-[46px] rounded-[13px] bg-card border border-line px-3.5 text-[13.5px] text-ink outline-none focus:border-brand placeholder:text-ink3"
          />
          <button className="w-[46px] h-[46px] rounded-[13px] bg-card border border-line flex items-center justify-center text-ink2">
            <Icon name="camera" size={19} />
          </button>
        </div>
        {/* teclado numérico */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => (
            <button
              key={k}
              onClick={() => tap(k)}
              className="h-12 rounded-[13px] bg-card border border-line font-mono text-[20px] font-medium text-ink active:bg-cardAlt flex items-center justify-center"
            >
              {k === 'del' ? <Icon name="chevL" size={18} /> : k}
            </button>
          ))}
        </div>
        <Btn size="lg" className="w-full mt-3" disabled={monto <= 0} onClick={registrar}>
          Registrar {tipo.toLowerCase()} · <span className="font-mono">S/{fmt(monto)}</span>
        </Btn>
        {tipo === 'Gasto' && (
          <div className="text-center mt-2.5 text-[12px] text-ink3">
            Quedarían{' '}
            <span
              className={cx('font-mono font-semibold', restante < 0 ? 'text-neg' : 'text-ink2')}
            >
              S/{fmt(restante)}
            </span>{' '}
            en {caja.nombre}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cajas y reparto (% en vivo) ────────────────────────────────
function CajasScreen() {
  const { state, dispatch } = useStore();
  const total = state.cajas.reduce((s, c) => s + c.pct, 0);
  const ok = total === 100;
  return (
    <>
      <MobileHeader
        title="Cajas y reparto"
        right={
          <Btn kind="soft" size="sm" icon={<Icon name="plus" size={14} sw={2.4} />}>
            Nueva
          </Btn>
        }
      />
      <div className="px-5 shrink-0">
        <Card className="p-3.5" style={{ borderColor: ok ? 'var(--c-brand)' : 'var(--c-neg)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className={cx(
                'w-8 h-8 rounded-[10px] flex items-center justify-center',
                ok ? 'bg-brandSoft text-brand' : 'bg-negSoft text-neg',
              )}
            >
              <Icon name={ok ? 'check' : 'x'} size={15} sw={2.4} />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[13.5px] text-ink">
                Los porcentajes suman{' '}
                <span className={cx('font-mono', ok ? 'text-brand' : 'text-neg')}>{total}%</span>
              </div>
              <div className="text-[11.5px] text-ink2 mt-px">
                {ok
                  ? 'Cada ingreso se reparte automáticamente'
                  : `Ajusta ${total > 100 ? 'hacia abajo' : 'hacia arriba'} ${Math.abs(100 - total)}%`}
              </div>
            </div>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden mt-3 gap-0.5">
            {state.cajas.map((c) => (
              <div
                key={c.id}
                style={{ width: c.pct + '%', background: cajaColor(c.id, state.mode) }}
              />
            ))}
          </div>
        </Card>
        <div className="flex items-center justify-between mt-4 mb-1.5">
          <SecLabel>{state.cajas.length} cajas activas</SecLabel>
          <span className="text-[11.5px] text-ink3">Aplica a ingresos futuros</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-3 flex flex-col gap-2">
        {state.cajas.map((c) => {
          const col = cajaColor(c.id, state.mode);
          return (
            <Card key={c.id} className="p-0">
              <div className="flex items-center gap-3 px-3.5 py-2.5">
                <Icon name="grip" size={16} className="text-ink3 shrink-0" />
                <span
                  className="w-2.5 h-2.5 rounded-[3.5px] shrink-0"
                  style={{ background: col }}
                />
                <div
                  className="flex-1 min-w-0"
                  onClick={() => dispatch({ type: 'NAV', v: 'caja:' + c.id })}
                >
                  <div className="font-semibold text-[14px] text-ink">{c.nombre}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge color={c.tipo === 'fondo' ? col : undefined}>
                      {c.tipo === 'fondo' ? 'fondo · acumula' : 'gasto · reinicia'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center bg-inset border border-line rounded-[11px] overflow-hidden">
                  <button
                    onClick={() => dispatch({ type: 'SET_PCT', id: c.id, delta: -5 })}
                    className="w-[30px] h-[34px] flex items-center justify-center text-ink2 active:bg-cardAlt"
                  >
                    <Icon name="minus" size={14} />
                  </button>
                  <div className="w-[46px] text-center font-mono font-semibold text-[14px] text-ink border-x border-line leading-[34px]">
                    {c.pct}%
                  </div>
                  <button
                    onClick={() => dispatch({ type: 'SET_PCT', id: c.id, delta: 5 })}
                    className="w-[30px] h-[34px] flex items-center justify-center text-ink2 active:bg-cardAlt"
                  >
                    <Icon name="plus" size={14} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
        <div className="text-[11.5px] text-ink3 text-center px-5 pt-1.5 leading-relaxed">
          El historial no se reescribe: cada ingreso guarda su propio reparto.
        </div>
      </div>
    </>
  );
}

// ── Reportes ───────────────────────────────────────────────────
function ReportesScreen() {
  const { state } = useStore();
  const gc = gastoCajas(state.cajas)
    .filter((c) => c.gastado > 0)
    .sort((a, b) => b.gastado - a.gastado);
  const max = gc[0] ? gc[0].gastado : 1;
  const semanas = [
    { label: 'S1', v: 320 },
    { label: 'S2', v: 510 },
    { label: 'S3', v: 624 },
    { label: 'S4', v: 290 },
  ];
  const maxSem = Math.max(...semanas.map((s) => s.v));
  return (
    <>
      <MobileHeader back title="Reportes" right={<RoundBtn name="download" />} />
      <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 self-start bg-card border border-line rounded-full px-3.5 py-2">
          <span className="font-semibold text-[12.5px] text-ink">Junio 2026</span>
          <Icon name="chevD" size={13} className="text-ink3" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Card className="p-3.5">
            <SecLabel>Ingresos</SecLabel>
            <div className="mt-1.5">
              <Money v={3200} size={21} weight="font-semibold" sign="+" className="text-pos" />
            </div>
            <div className="text-[11px] text-ink3 mt-1">2 ingresos repartidos</div>
          </Card>
          <Card className="p-3.5">
            <SecLabel>Gastos</SecLabel>
            <div className="mt-1.5">
              <Money v={1744.36} size={21} weight="font-semibold" sign="−" className="text-ink" />
            </div>
            <div className="text-[11px] text-ink3 mt-1">−12% vs. mayo</div>
          </Card>
        </div>
        <Card className="p-4">
          <div className="flex justify-between items-baseline">
            <SecLabel>Gasto por semana</SecLabel>
            <span className="text-[11.5px] text-ink3">fecha contable · Lima</span>
          </div>
          <div className="flex items-end gap-3.5 h-[110px] mt-3.5 px-1">
            {semanas.map((s, i) => (
              <div
                key={s.label}
                className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
              >
                <span className="font-mono text-[10px] text-ink2">{s.v}</span>
                <div
                  className="w-full max-w-[44px] rounded-t-[7px] box-border"
                  style={{
                    height: (s.v / maxSem) * 72,
                    background: i === 2 ? 'var(--c-brand)' : 'var(--c-brandSoft)',
                    border: i === 2 ? 'none' : '1px solid var(--c-brand)',
                  }}
                />
                <span className="font-mono text-[10.5px] text-ink3">{s.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <SecLabel className="mb-3">Gasto por caja</SecLabel>
          <div className="flex flex-col gap-2.5">
            {gc.map((c) => {
              const col = cajaColor(c.id, state.mode);
              return (
                <div key={c.id} className="flex items-center gap-2.5">
                  <span className="w-[62px] font-semibold text-[12px] text-ink2 shrink-0">
                    {c.nombre}
                  </span>
                  <div className="flex-1 h-3.5 rounded-[5px] bg-inset overflow-hidden">
                    <div
                      className="h-full rounded-[5px]"
                      style={{ width: (c.gastado / max) * 100 + '%', background: col }}
                    />
                  </div>
                  <span className="w-16 text-right font-mono text-[11.5px] font-semibold text-ink shrink-0">
                    {fmt(c.gastado)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

// ── Ajustes ────────────────────────────────────────────────────
function AjustesScreen() {
  const { state, dispatch } = useStore();
  return (
    <>
      <MobileHeader back title="Ajustes" />
      <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-4">
        <Card className="p-4 flex items-center gap-3.5">
          <Avatar size={52} name="J" />
          <div className="flex-1">
            <div className="font-bold text-[16px] text-ink">João Souza</div>
            <div className="text-[12.5px] text-ink2">joaosouzareyna@gmail.com</div>
          </div>
          <Badge
            color="var(--c-brand)"
            style={{ background: 'var(--c-brandSoft)', color: 'var(--c-brandDeep)' }}
          >
            Cuenta activa
          </Badge>
        </Card>
        <div>
          <SecLabel className="mb-2">Apariencia</SecLabel>
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
              <div className="w-8 h-8 rounded-[10px] bg-cardAlt flex items-center justify-center text-ink2">
                <Icon name={state.mode === 'dark' ? 'moon' : 'sun'} size={17} />
              </div>
              <span className="flex-1 text-[14px] text-ink">Modo oscuro</span>
              <Toggle
                on={state.mode === 'dark'}
                onChange={(v) => dispatch({ type: 'MODE', v: v ? 'dark' : 'light' })}
              />
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-[10px] bg-cardAlt flex items-center justify-center text-ink2">
                  <Icon name="sparkle" size={17} />
                </div>
                <span className="flex-1 text-[14px] text-ink">Color de acento</span>
              </div>
              <div className="flex gap-2.5 pl-11">
                {[
                  ['verde', '#0E7A4D'],
                  ['teal', '#0F7E96'],
                  ['indigo', '#41599E'],
                ].map(([k, c]) => (
                  <button
                    key={k}
                    onClick={() => dispatch({ type: 'ACCENT', v: k })}
                    className={cx(
                      'w-9 h-9 rounded-full flex items-center justify-center transition',
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
        </div>
        <div>
          <SecLabel className="mb-2">WhatsApp y cuenta</SecLabel>
          <Card className="p-0 overflow-hidden">
            {[
              { ic: 'phone', t: 'Números vinculados', d: '+51 987 654 321 · verificado' },
              { ic: 'chart', t: 'Reportes', d: 'Resúmenes y export', nav: 'reportes' },
              { ic: 'shield', t: 'Privacidad y datos', d: 'Tu historial es solo tuyo' },
              { ic: 'receipt', t: 'Cierre nocturno', d: 'Pásale el día y categoriza' },
            ].map((r, i, arr) => (
              <button
                key={r.t}
                onClick={() => r.nav && dispatch({ type: 'NAV', v: r.nav })}
                className={cx(
                  'w-full flex items-center gap-3 px-4 py-3 text-left active:bg-cardAlt',
                  i < arr.length - 1 && 'border-b border-line',
                )}
              >
                <div className="w-8 h-8 rounded-[10px] bg-cardAlt flex items-center justify-center text-ink2">
                  <Icon name={r.ic} size={17} />
                </div>
                <div className="flex-1">
                  <div className="text-[14px] text-ink font-medium">{r.t}</div>
                  <div className="text-[11.5px] text-ink3">{r.d}</div>
                </div>
                <Icon name="chevR" size={15} className="text-ink3" />
              </button>
            ))}
          </Card>
        </div>
        <Btn
          kind="secondary"
          className="w-full text-neg"
          icon={<Icon name="logout" size={16} />}
          onClick={() => dispatch({ type: 'AUTH', v: 'login' })}
        >
          Cerrar sesión
        </Btn>
        <div className="text-center text-[11px] text-ink3 font-mono">
          MayordomoAI · v0.1 · mayordomoai.xyz
        </div>
      </div>
    </>
  );
}

// ── Notificaciones (sheet) ─────────────────────────────────────
function NotifSheet() {
  const { state, dispatch } = useStore();
  const notifs = [
    { ic: 'wallet', c: 'ocio', t: 'Ocio al 93%', d: 'Te queda S/34.34 este mes', time: 'hace 1 h' },
    {
      ic: 'check',
      c: 'pasajes',
      t: 'Gasto registrado por voz',
      d: 'S/30 en Ocio · confirmado',
      time: 'hace 3 h',
    },
    {
      ic: 'arrDown',
      c: 'ahorro',
      t: 'Ingreso repartido',
      d: 'S/500 distribuido en 7 cajas',
      time: 'ayer',
    },
    {
      ic: 'shield',
      c: 'empresa',
      t: 'Bot conectado',
      d: 'Tu número quedó verificado',
      time: 'lun',
    },
  ];
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      onClick={() => dispatch({ type: 'SHEET', v: null })}
      style={{ background: state.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(22,33,26,0.32)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-page rounded-t-[24px] px-5 pt-2.5 pb-9 shadow-2xl animate-sheet max-h-[80%] flex flex-col"
      >
        <div className="w-10 h-[4.5px] rounded-full bg-lineStrong mx-auto mb-4" />
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[19px] text-ink">Notificaciones</h2>
          <span className="text-[12.5px] font-semibold text-brand">Marcar leídas</span>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto">
          {notifs.map((n, i) => {
            const col = cajaColor(n.c, state.mode);
            return (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-card bg-card border border-line"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: col + (state.mode === 'dark' ? '26' : '17') }}
                >
                  <Icon name={n.ic} size={16} style={{ color: col }} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[13.5px] text-ink">{n.t}</div>
                  <div className="text-[12px] text-ink2">{n.d}</div>
                </div>
                <span className="text-[10.5px] text-ink3 shrink-0">{n.time}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Empresa ────────────────────────────────────────────────────
function EmpresaScreen() {
  const { state } = useStore();
  const movs = state.movs.filter((m) => m.ambito === 'empresa' || m.caja === 'empresa');
  const col = cajaColor('empresa', state.mode);
  return (
    <>
      <MobileHeader back title="Empresa" />
      <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-3">
        <Card className="p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: col }} />
          <SecLabel>Saldo ámbito empresa</SecLabel>
          <div className="mt-1.5">
            <Money
              v={1280.4}
              size={34}
              weight="font-semibold"
              style={{ color: col }}
              className="!text-[color:currentColor]"
            />
          </div>
          <div className="text-[12.5px] text-ink2 mt-2">
            El ingreso de cliente entra como <b>empresa</b>; solo el "sueldo" que te pasas alimenta
            tus cajas personales.
          </div>
        </Card>
        <div>
          <SecLabel className="mb-1">Movimientos de empresa</SecLabel>
          {movs.map((m, i) => (
            <MovRow
              key={m.id}
              mov={m}
              cajas={state.cajas}
              mode={state.mode}
              last={i === movs.length - 1}
            />
          ))}
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  RegistroSheet,
  CajasScreen,
  ReportesScreen,
  AjustesScreen,
  NotifSheet,
  EmpresaScreen,
});
