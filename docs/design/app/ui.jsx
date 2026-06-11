// MayordomoAI — primitivas UI en Tailwind. Mapean a componentes shadcn del repo real.

function cx(...a) {
  return a.filter(Boolean).join(' ');
}

// Icono de trazo (currentColor). size en px vía style.
function Icon({ name, size = 20, sw = 1.8, className, style, fill = false }) {
  const d = ICONS[name] || '';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {d.split(' M').map((seg, i) => (
        <path key={i} d={(i ? 'M' : '') + seg} />
      ))}
    </svg>
  );
}

// Monto con S/ pequeño y números tabulares
function Money({ v, size = 16, className, weight = 'font-semibold', sign }) {
  return (
    <span
      className={cx('font-mono tabular-nums tracking-tight whitespace-nowrap', weight, className)}
      style={{ fontSize: size }}
    >
      {sign ? sign + ' ' : ''}
      <span style={{ fontSize: Math.round(size * 0.66) }} className="opacity-60 mr-0.5">
        S/
      </span>
      {fmt(v)}
    </span>
  );
}

function Card({ children, className, style, onClick }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'bg-card border border-line rounded-card shadow-card',
        onClick && 'cursor-pointer active:scale-[0.995] transition-transform',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function Btn({ children, kind = 'primary', size = 'md', icon, className, onClick, disabled }) {
  const sizes = {
    lg: 'h-[50px] px-5 text-[16px]',
    md: 'h-[42px] px-5 text-[14.5px]',
    sm: 'h-[34px] px-3.5 text-[13px]',
  };
  const kinds = {
    primary: 'bg-brand text-onBrand active:brightness-95',
    secondary: 'bg-card text-ink border border-lineStrong active:bg-cardAlt',
    ghost: 'bg-transparent text-ink2 active:bg-cardAlt',
    soft: 'bg-brandSoft text-brandDeep dark:text-brand',
    danger: 'bg-negSoft text-neg',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold select-none whitespace-nowrap transition',
        sizes[size],
        kinds[kind],
        disabled && 'opacity-50 pointer-events-none',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Badge({ children, color, soft = true, className, style }) {
  // color = hex opcional; si no, usa ink2
  const base =
    'inline-flex items-center gap-1.5 h-[21px] px-2 rounded-full font-semibold text-[11.5px]';
  if (color) {
    return (
      <span
        className={cx(base, className)}
        style={{ background: soft ? color + '22' : color, color: soft ? color : '#fff', ...style }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={cx(base, soft ? 'bg-cardAlt text-ink2' : 'bg-ink2 text-card', className)}
      style={style}
    >
      {children}
    </span>
  );
}

function CanalBadge({ canal, mode }) {
  const isWa = canal === 'whatsapp';
  const c = isWa ? cajaColor('ahorro', mode) : cajaColor('ofrenda', mode);
  return (
    <Badge color={c}>
      <span className="w-[5px] h-[5px] rounded-full" style={{ background: c }} />
      {isWa ? 'WhatsApp' : 'Web'}
    </Badge>
  );
}

function Progress({ pct, color, h = 6, track }) {
  const over = pct > 100;
  return (
    <div
      className="rounded-full overflow-hidden"
      style={{ height: h, background: track || 'var(--c-cardAlt)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: Math.min(pct, 100) + '%', background: over ? 'var(--c-neg)' : color }}
      />
    </div>
  );
}

function Avatar({ size = 32, name = 'J' }) {
  return (
    <div
      className="rounded-full bg-brandSoft text-brandDeep dark:text-brand flex items-center justify-center font-bold border border-line shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name}
    </div>
  );
}

function SecLabel({ children, className }) {
  return (
    <div
      className={cx(
        'font-mono text-[11px] font-medium tracking-[0.08em] uppercase text-ink3',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Toggle({ on, onChange, color }) {
  return (
    <div
      onClick={() => onChange && onChange(!on)}
      className={cx(
        'w-11 h-[26px] rounded-full p-[3px] box-border cursor-pointer transition-colors border',
        on ? 'border-transparent' : 'bg-cardAlt border-lineStrong',
      )}
      style={{ background: on ? color || 'var(--c-brand)' : undefined }}
    >
      <div
        className={cx(
          'w-[18px] h-[18px] rounded-full bg-white shadow transition-transform',
          on ? 'translate-x-[18px]' : 'translate-x-0',
        )}
      />
    </div>
  );
}

// ── Marca ──────────────────────────────────────────────────────
function Mark({ size = 32 }) {
  const r = Math.round(size * 0.3);
  return (
    <div
      className="bg-brand relative overflow-hidden shrink-0"
      style={{ width: size, height: size, borderRadius: r }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" className="block text-onBrand">
        <path
          d="M5 10 L16 19 L27 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 24 L16 15 L27 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.45"
        />
      </svg>
    </div>
  );
}

function Wordmark({ size = 18, mark = 22, className }) {
  return (
    <div className={cx('flex items-center', className)} style={{ gap: Math.round(mark * 0.36) }}>
      <Mark size={mark} />
      <div
        className="font-bold tracking-[-0.025em] leading-none text-ink"
        style={{ fontSize: size }}
      >
        Mayordomo<span className="text-brand">AI</span>
      </div>
    </div>
  );
}

// ── Sobre (la metáfora) ────────────────────────────────────────
function EnvelopeCard({ caja, mode, compact = false, onClick }) {
  const c = cajaColor(caja.id, mode);
  const s = saldoDe(caja);
  const asign = asignadoDe(caja);
  const pct = asign > 0 ? (caja.gastado / asign) * 100 : 0;
  const isFondo = caja.tipo === 'fondo';
  const over = s < 0;
  const dk = mode === 'dark';
  return (
    <div
      onClick={onClick}
      className={cx(
        'bg-card border border-line rounded-card shadow-card overflow-hidden relative box-border',
        onClick && 'cursor-pointer active:scale-[0.99] transition-transform',
      )}
    >
      <div
        className="relative"
        style={{ height: compact ? 17 : 26, background: c + (dk ? '2E' : '1F') }}
      >
        <div
          className="absolute inset-0"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 28%, 50% 100%, 0 28%)',
            background: c + (dk ? '55' : '38'),
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: c }} />
      </div>
      <div style={{ padding: compact ? '8px 11px 9px' : '12px 14px 14px' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-ink" style={{ fontSize: compact ? 13.5 : 14.5 }}>
            {caja.nombre}
          </div>
          <span className="font-mono text-[11px] text-ink3 font-medium">{caja.pct}%</span>
        </div>
        <div style={{ marginTop: compact ? 3 : 7 }}>
          {isFondo ? (
            <Money
              v={caja.acumulado}
              size={compact ? 16 : 20}
              weight="font-semibold"
              className="text-[color:var(--cc)]"
            />
          ) : (
            <Money
              v={s}
              size={compact ? 16 : 20}
              weight="font-semibold"
              className={over ? 'text-neg' : 'text-ink'}
            />
          )}
        </div>
        <div style={{ marginTop: compact ? 6 : 10 }}>
          {isFondo ? (
            <div className="flex items-center gap-1.5">
              <Icon name="arrUp" size={12} sw={2.4} style={{ color: c }} />
              <span className="text-[11.5px] text-ink2">
                Fondo · <span className="font-mono">+S/{fmt(asign)}</span>
              </span>
            </div>
          ) : (
            <>
              <Progress pct={pct} color={c} h={compact ? 5 : 6} track="var(--c-inset)" />
              <div className="flex justify-between mt-1">
                <span className="text-[11px] text-ink2">
                  {over ? 'Sobregiro' : `Usado ${Math.round(pct)}%`}
                </span>
                <span className="font-mono text-[10.5px] text-ink3">de S/{fmt(asign)}</span>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`.text-\\[color\\:var\\(--cc\\)\\]{color:${c}}`}</style>
    </div>
  );
}

// ── Fila de movimiento ─────────────────────────────────────────
function MovRow({ mov, cajas, mode, last = false, dense = false, onClick }) {
  const caja = (cajas || []).find((c) => c.id === mov.caja);
  const cajaNombre =
    mov.caja === 'empresa'
      ? 'Empresa'
      : caja
        ? caja.nombre
        : mov.tipo === 'ingreso'
          ? 'Ingreso'
          : 'Tránsito';
  const c = mov.caja
    ? cajaColor(mov.caja, mode)
    : mov.tipo === 'ingreso'
      ? 'var(--c-pos)'
      : 'var(--c-ink3)';
  const isIn = mov.tipo === 'ingreso';
  const isTr = mov.tipo === 'transito';
  const icon = isIn ? 'arrDown' : isTr ? 'swap' : 'arrUp';
  const dk = mode === 'dark';
  const bgIcon = mov.caja
    ? c + (dk ? '26' : '17')
    : isIn
      ? 'var(--c-brandSoft)'
      : 'var(--c-cardAlt)';
  return (
    <div
      onClick={onClick}
      className={cx(
        'flex items-center gap-3 border-line',
        dense ? 'py-2.5' : 'py-3',
        !last && 'border-b',
        mov.anulado && 'opacity-45',
        onClick && 'cursor-pointer',
      )}
    >
      <div
        className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
        style={{ background: bgIcon }}
      >
        <Icon name={icon} size={16} sw={2.1} style={{ color: c }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cx(
              'font-semibold text-[13.5px] text-ink truncate',
              mov.anulado && 'line-through',
            )}
          >
            {mov.nota}
          </span>
          {mov.voz && <Icon name="mic" size={12} sw={2} className="text-ink3 shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11.5px] font-semibold" style={{ color: c }}>
            {cajaNombre}
          </span>
          <span className="text-ink3 text-[10px]">·</span>
          <span className="text-[11.5px] text-ink3">{mov.fecha}</span>
          {mov.anulado && <Badge>anulado</Badge>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <Money
          v={mov.monto}
          size={14}
          sign={isIn ? '+' : isTr ? '↔' : '−'}
          className={isIn ? 'text-pos' : isTr ? 'text-ink2' : 'text-ink'}
        />
        {mov.split && <div className="text-[10.5px] text-ink3 mt-px">repartido</div>}
      </div>
    </div>
  );
}

// Botón redondo de chrome (top bar)
function RoundBtn({ name, size = 36, icon = 16, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-full bg-card border border-line flex items-center justify-center text-ink2 active:bg-cardAlt transition"
      style={{ width: size, height: size }}
    >
      <Icon name={name} size={icon} />
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand text-onBrand text-[9.5px] font-bold flex items-center justify-center font-mono">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Fila de caja simplificada (lista, diseño por excepción) ────
function CajaRow({ caja, mode, last = false, onClick }) {
  const c = cajaColor(caja.id, mode);
  const asign = asignadoDe(caja);
  const s = saldoDe(caja);
  const pct = asign > 0 ? (caja.gastado / asign) * 100 : 0;
  const over = s < 0;
  const empty = !over && s === 0 && pct >= 100;
  const low = !over && !empty && pct >= 90;
  return (
    <div
      onClick={onClick}
      className={cx(
        'flex items-center gap-2 py-3 group',
        !last && 'border-b border-line',
        onClick && 'cursor-pointer',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13.5px] font-semibold text-ink truncate">{caja.nombre}</span>
          <span className="flex items-center gap-2 shrink-0">
            {over && <Badge color="var(--c-neg)">sobregiro</Badge>}
            {empty && <Badge>agotada</Badge>}
            {low && <Badge color="var(--c-warn)">queda poco</Badge>}
            <Money
              v={s}
              size={14.5}
              className={over ? 'text-neg' : low ? 'text-warn' : empty ? 'text-ink3' : 'text-ink'}
            />
          </span>
        </div>
        <div className="mt-2">
          <Progress pct={pct} color={c} h={3} track="var(--c-inset)" />
        </div>
      </div>
      {onClick && (
        <Icon
          name="chevR"
          size={14}
          className="text-ink3 opacity-0 group-hover:opacity-100 transition shrink-0"
        />
      )}
    </div>
  );
}

Object.assign(window, {
  cx,
  Icon,
  Money,
  Card,
  Btn,
  Badge,
  CanalBadge,
  Progress,
  Avatar,
  SecLabel,
  Toggle,
  Mark,
  Wordmark,
  EnvelopeCard,
  MovRow,
  RoundBtn,
  CajaRow,
});
