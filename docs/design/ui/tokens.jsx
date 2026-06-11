// MayordomoAI — tokens, tema claro/oscuro, datos de ejemplo y componentes compartidos.
// Dirección: "limpia y bancaria", verde dinero, sobres con color propio por caja.
// Tipos: Hanken Grotesk (UI) + IBM Plex Mono (montos / etiquetas técnicas).

const FONT_UI = "'Hanken Grotesk', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";

// ── Acentos disponibles (par claro/oscuro) ─────────────────────
const ACCENT_PAIRS = {
  '#0E7A4D': { l: '#0E7A4D', d: '#34D399', softL: '#E2F1E9', softD: '#16332455' },
  '#0F7E96': { l: '#0F7E96', d: '#53C8DE', softL: '#E1F0F3', softD: '#13313955' },
  '#41599E': { l: '#41599E', d: '#93A8E8', softL: '#E7EAF5', softD: '#1D274555' },
};

function buildTheme(mode, accentKey, radius) {
  const A = ACCENT_PAIRS[accentKey] || ACCENT_PAIRS['#0E7A4D'];
  const dark = mode === 'dark';
  return dark
    ? {
        mode: 'dark',
        r: radius,
        bg: '#0C120F',
        surface: '#141C17',
        surfaceAlt: '#1A241E',
        inset: '#101813',
        text: '#EDF3EE',
        textSec: '#94A39A',
        textTer: '#5F6E65',
        border: '#232F28',
        borderStrong: '#314037',
        accent: A.d,
        accentDeep: A.d,
        accentSoft: A.softD,
        onAccent: '#0B1410',
        positive: '#34D399',
        danger: '#F07B72',
        dangerSoft: '#3A211F',
        warn: '#E0B34E',
        shadow: '0 1px 2px rgba(0,0,0,0.4)',
        shadowLg: '0 12px 32px rgba(0,0,0,0.45)',
      }
    : {
        mode: 'light',
        r: radius,
        bg: '#F2F5F2',
        surface: '#FFFFFF',
        surfaceAlt: '#EBEFEB',
        inset: '#F6F8F6',
        text: '#16211A',
        textSec: '#5D6A62',
        textTer: '#94A09A',
        border: '#E3E8E3',
        borderStrong: '#CFD8CF',
        accent: A.l,
        accentDeep: A.l,
        accentSoft: A.softL,
        onAccent: '#FFFFFF',
        positive: '#0E7A4D',
        danger: '#BB4540',
        dangerSoft: '#F7E9E8',
        warn: '#B07C1E',
        shadow: '0 1px 2px rgba(20,40,28,0.06)',
        shadowLg: '0 16px 40px rgba(20,40,28,0.12)',
      };
}

const ThemeCtx = React.createContext(buildTheme('light', '#0E7A4D', 16));
const useT = () => React.useContext(ThemeCtx);

// ── Colores por caja (par claro/oscuro, croma homogéneo) ───────
const CAJA_COLORS = {
  ahorro: { l: '#0E7A4D', d: '#34D399' },
  varios: { l: '#5C6E77', d: '#9DB0BA' },
  pasajes: { l: '#0F7E96', d: '#53C8DE' },
  ocio: { l: '#B07C1E', d: '#E0B34E' },
  diezmo: { l: '#7A5CC4', d: '#AC93F2' },
  snacks: { l: '#B5536E', d: '#EF8FAE' },
  ofrenda: { l: '#3F6FC4', d: '#85A8EE' },
  empresa: { l: '#41599E', d: '#93A8E8' },
};
const cajaColor = (id, t) => (CAJA_COLORS[id] || CAJA_COLORS.varios)[t.mode === 'dark' ? 'd' : 'l'];

// ── Datos de ejemplo (PEN, junio 2026) ─────────────────────────
// Ingresos personales del periodo: S/ 3,200 — los % suman 100.
const CAJAS = [
  {
    id: 'ahorro',
    nombre: 'Ahorro',
    pct: 25,
    tipo: 'fondo',
    asignado: 800,
    gastado: 0,
    acumulado: 4350,
  },
  { id: 'varios', nombre: 'Varios', pct: 20, tipo: 'gasto', asignado: 640, gastado: 287.9 },
  { id: 'pasajes', nombre: 'Pasajes', pct: 15, tipo: 'gasto', asignado: 480, gastado: 376.5 },
  { id: 'ocio', nombre: 'Ocio', pct: 15, tipo: 'gasto', asignado: 480, gastado: 445.66 },
  { id: 'diezmo', nombre: 'Diezmo', pct: 10, tipo: 'gasto', asignado: 320, gastado: 320 },
  { id: 'snacks', nombre: 'Snacks', pct: 10, tipo: 'gasto', asignado: 320, gastado: 214.3 },
  { id: 'ofrenda', nombre: 'Ofrenda', pct: 5, tipo: 'gasto', asignado: 160, gastado: 100 },
];
const saldo = (c) => c.asignado - c.gastado;
const DISPONIBLE = CAJAS.filter((c) => c.tipo === 'gasto').reduce((s, c) => s + saldo(c), 0);

const MOVS = [
  {
    id: 1,
    tipo: 'gasto',
    caja: 'ocio',
    monto: 30,
    nota: 'Almuerzo con los chicos',
    origen: 'whatsapp',
    voz: true,
    fecha: 'Hoy · 1:15 p. m.',
    dia: 'Hoy',
  },
  {
    id: 2,
    tipo: 'gasto',
    caja: 'pasajes',
    monto: 8,
    nota: 'Pasajes',
    origen: 'whatsapp',
    fecha: 'Hoy · 8:42 a. m.',
    dia: 'Hoy',
  },
  {
    id: 3,
    tipo: 'ingreso',
    caja: null,
    monto: 500,
    nota: 'Pago de cliente',
    origen: 'pwa',
    split: true,
    fecha: 'Ayer · 6:30 p. m.',
    dia: 'Ayer',
  },
  {
    id: 4,
    tipo: 'gasto',
    caja: 'snacks',
    monto: 1.7,
    nota: 'Vendomática',
    origen: 'whatsapp',
    fecha: 'Ayer · 4:02 p. m.',
    dia: 'Ayer',
  },
  {
    id: 5,
    tipo: 'transito',
    caja: null,
    monto: 30,
    nota: 'Yape Marco — reenvío',
    origen: 'whatsapp',
    fecha: 'Ayer · 11:20 a. m.',
    dia: 'Ayer',
  },
  {
    id: 6,
    tipo: 'gasto',
    caja: 'empresa',
    monto: 372.71,
    nota: 'Claude Max',
    origen: 'pwa',
    fecha: 'Lun 8 · 9:14 a. m.',
    dia: 'Lun 8 jun',
    anulado: false,
  },
  {
    id: 7,
    tipo: 'gasto',
    caja: 'varios',
    monto: 45,
    nota: 'Farmacia',
    origen: 'whatsapp',
    fecha: 'Lun 8 · 7:48 p. m.',
    dia: 'Lun 8 jun',
  },
  {
    id: 8,
    tipo: 'gasto',
    caja: 'ocio',
    monto: 24.9,
    nota: 'Cine',
    origen: 'pwa',
    fecha: 'Dom 7 · 8:05 p. m.',
    dia: 'Dom 7 jun',
    anulado: true,
  },
];

// ── Formato de dinero ──────────────────────────────────────────
const fmt = (n) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Money({ v, size = 16, color, weight = 600, sign }) {
  const t = useT();
  const c = color || t.text;
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontWeight: weight,
        fontSize: size,
        color: c,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {sign ? sign + ' ' : ''}
      <span style={{ fontSize: Math.round(size * 0.68), opacity: 0.62, marginRight: 2 }}>S/</span>
      {fmt(v)}
    </span>
  );
}

// ── Iconos (trazo simple, 24 viewBox) ──────────────────────────
function Ic({ d, size = 20, color, sw = 1.8, fill = 'none', style }) {
  const t = useT();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill === 'none' ? 'none' : color || t.text}
      style={style}
    >
      <path
        d={d}
        stroke={fill === 'none' ? color || t.text : 'none'}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
const ICONS = {
  home: 'M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1v-9z',
  chat: 'M21 12a8 8 0 01-8 8H4l1.7-3.4A8 8 0 1121 12z',
  list: 'M5 4h14v17l-2.4-1.6L14.2 21l-2.2-1.6L9.8 21l-2.4-1.6L5 21V4z M9 9h6 M9 13h4',
  chart: 'M4 20V10 M10 20V4 M16 20v-8 M22 20H2',
  gear: 'M12 9a3 3 0 100 6 3 3 0 000-6z M19 12a7 7 0 01-.1 1.2l2 1.6-2 3.4-2.4-1a7 7 0 01-2 1.2L14 21h-4l-.5-2.6a7 7 0 01-2-1.2l-2.4 1-2-3.4 2-1.6A7 7 0 015 12c0-.4 0-.8.1-1.2l-2-1.6 2-3.4 2.4 1a7 7 0 012-1.2L10 3h4l.5 2.6a7 7 0 012 1.2l2.4-1 2 3.4-2 1.6c.1.4.1.8.1 1.2z',
  plus: 'M12 5v14 M5 12h14',
  mic: 'M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3z M6 11a6 6 0 0012 0 M12 17v4',
  send: 'M4 12l16-7-5 16-3.5-6L4 12z',
  arrUp: 'M12 19V5 M6 11l6-6 6 6',
  arrDown: 'M12 5v14 M6 13l6 6 6-6',
  swap: 'M7 4v12 M3 8l4-4 4 4 M17 20V8 M13 16l4 4 4-4',
  check: 'M4 12.5l5 5L20 6.5',
  chevR: 'M9 5l7 7-7 7',
  chevL: 'M15 5l-7 7 7 7',
  x: 'M6 6l12 12 M18 6L6 18',
  search: 'M10.5 4a6.5 6.5 0 104.6 11.1L20 20 M15.1 15.1A6.5 6.5 0 0010.5 4',
  bell: 'M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6 M10 19a2 2 0 004 0',
  camera: 'M4 8h3l2-3h6l2 3h3v12H4V8z M12 16a3 3 0 100-6 3 3 0 000 6z',
  doc: 'M7 3h7l4 4v14H7V3z M14 3v4h4 M10 12h6 M10 16h6',
  logout:
    'M14 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v14a1 1 0 001 1h8a1 1 0 001-1v-3 M9 12h12 M17 8l4 4-4 4',
  phone: 'M7 2h10v20H7V2z M11 18.5h2',
  edit: 'M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z',
  calendar: 'M5 6h14v15H5V6z M5 10h14 M9 3v5 M15 3v5',
  filter: 'M3 5h18l-7 8v7l-4-2v-5L3 5z',
  download: 'M12 4v11 M7 10l5 5 5-5 M4 20h16',
};

// ── Wordmark ───────────────────────────────────────────────────
// Marca: cuadrado redondeado con solapa de sobre (triángulo) — el "sobre mayordomo".
function Mark({ size = 32, t: tProp }) {
  const t = tProp || useT();
  const r = Math.round(size * 0.3);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: t.accent,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block' }}>
        <path
          d="M5 10 L16 19 L27 10"
          fill="none"
          stroke={t.onAccent}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 24 L16 15 L27 24"
          fill="none"
          stroke={t.onAccent}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.45"
        />
      </svg>
    </div>
  );
}

function Wordmark({ size = 18, mark = 22, style }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(mark * 0.36), ...style }}>
      <Mark size={mark} />
      <div
        style={{
          fontFamily: FONT_UI,
          fontWeight: 700,
          fontSize: size,
          color: t.text,
          letterSpacing: '-0.025em',
          lineHeight: 1,
        }}
      >
        Mayordomo<span style={{ color: t.accent }}>AI</span>
      </div>
    </div>
  );
}

// ── Componentes base ───────────────────────────────────────────
function Card({ children, style, pad = 16 }) {
  const t = useT();
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: t.r,
        boxShadow: t.shadow,
        padding: pad,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Btn({ children, kind = 'primary', size = 'md', icon, style, onClick }) {
  const t = useT();
  const h = size === 'lg' ? 50 : size === 'sm' ? 34 : 42;
  const base = {
    height: h,
    padding: size === 'sm' ? '0 14px' : '0 20px',
    borderRadius: Math.min(t.r, h / 2 + 4),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: FONT_UI,
    fontWeight: 600,
    fontSize: size === 'lg' ? 16 : size === 'sm' ? 13 : 14.5,
    cursor: 'pointer',
    border: '1px solid transparent',
    boxSizing: 'border-box',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };
  const kinds = {
    primary: { background: t.accent, color: t.onAccent },
    secondary: { background: t.surface, color: t.text, border: `1px solid ${t.borderStrong}` },
    ghost: { background: 'transparent', color: t.textSec },
    soft: { background: t.accentSoft, color: t.mode === 'dark' ? t.accent : t.accentDeep },
  };
  return (
    <div onClick={onClick} style={{ ...base, ...kinds[kind], ...style }}>
      {icon}
      {children}
    </div>
  );
}

function Badge({ children, color, soft = true, style }) {
  const t = useT();
  const c = color || t.textSec;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 21,
        padding: '0 8px',
        borderRadius: 999,
        fontFamily: FONT_UI,
        fontWeight: 600,
        fontSize: 11.5,
        letterSpacing: '0.01em',
        background: soft ? c + (t.mode === 'dark' ? '26' : '1A') : c,
        color: soft ? c : '#fff',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// Badge de canal: WhatsApp / Web
function CanalBadge({ canal }) {
  const t = useT();
  const isWa = canal === 'whatsapp';
  const c = isWa
    ? t.mode === 'dark'
      ? '#34D399'
      : '#0E7A4D'
    : t.mode === 'dark'
      ? '#85A8EE'
      : '#3F6FC4';
  return (
    <Badge color={c}>
      <span
        style={{ width: 5, height: 5, borderRadius: 99, background: c, display: 'inline-block' }}
      />
      {isWa ? 'WhatsApp' : 'Web'}
    </Badge>
  );
}

function ProgressBar({ pct, color, height = 6, track }) {
  const t = useT();
  const over = pct > 100;
  return (
    <div
      style={{
        height,
        borderRadius: 99,
        background: track || t.surfaceAlt,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: Math.min(pct, 100) + '%',
          height: '100%',
          borderRadius: 99,
          background: over ? t.danger : color,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

function Avatar({ size = 32, name = 'J' }) {
  const t = useT();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        background: t.accentSoft,
        color: t.mode === 'dark' ? t.accent : t.accentDeep,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_UI,
        fontWeight: 700,
        fontSize: size * 0.42,
        flexShrink: 0,
        border: `1px solid ${t.border}`,
      }}
    >
      {name}
    </div>
  );
}

// Etiqueta de sección (mono, técnica)
function SecLabel({ children, style }) {
  const t = useT();
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: t.textTer,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Sobre / caja (la metáfora central) ─────────────────────────
// Card con solapa de sobre: banda superior con clip-path de solapa en el color de la caja.
function EnvelopeCard({ caja, compact = false, onClick }) {
  const t = useT();
  const c = cajaColor(caja.id, t);
  const s = saldo(caja);
  const pct = caja.asignado > 0 ? (caja.gastado / caja.asignado) * 100 : 0;
  const isFondo = caja.tipo === 'fondo';
  const over = s < 0;
  return (
    <div
      onClick={onClick}
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: t.r,
        boxShadow: t.shadow,
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* solapa */}
      <div
        style={{
          position: 'relative',
          height: compact ? 17 : 26,
          background: c + (t.mode === 'dark' ? '2E' : '1F'),
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: 'polygon(0 0, 100% 0, 100% 28%, 50% 100%, 0 28%)',
            background: c + (t.mode === 'dark' ? '55' : '38'),
          }}
        />
        <div
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c }}
        />
      </div>
      <div style={{ padding: compact ? '8px 11px 9px' : '12px 14px 14px' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <div
            style={{
              fontFamily: FONT_UI,
              fontWeight: 650,
              fontSize: compact ? 13.5 : 14.5,
              color: t.text,
            }}
          >
            {caja.nombre}
          </div>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.textTer, fontWeight: 500 }}>
            {caja.pct}%
          </span>
        </div>
        <div style={{ marginTop: compact ? 3 : 7 }}>
          {isFondo ? (
            <Money v={caja.acumulado} size={compact ? 16 : 20} weight={650} color={c} />
          ) : (
            <Money v={s} size={compact ? 16 : 20} weight={650} color={over ? t.danger : t.text} />
          )}
        </div>
        <div style={{ marginTop: compact ? 6 : 10 }}>
          {isFondo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ic d={ICONS.arrUp} size={12} color={c} sw={2.4} />
              <span style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textSec }}>
                Fondo · acumula{' '}
                <span style={{ fontFamily: FONT_MONO }}>+S/{fmt(caja.asignado)}</span> este mes
              </span>
            </div>
          ) : (
            <React.Fragment>
              <ProgressBar pct={pct} color={c} height={compact ? 5 : 6} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontFamily: FONT_UI, fontSize: 11, color: t.textSec }}>
                  {over ? 'Sobregiro' : `Usado ${Math.round(pct)}%`}
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: t.textTer }}>
                  de S/{fmt(caja.asignado)}
                </span>
              </div>
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Fila de movimiento ─────────────────────────────────────────
function MovRow({ mov, last = false, dense = false }) {
  const t = useT();
  const caja = CAJAS.find((c) => c.id === mov.caja);
  const cajaNombre =
    mov.caja === 'empresa'
      ? 'Empresa'
      : caja
        ? caja.nombre
        : mov.tipo === 'ingreso'
          ? 'Ingreso'
          : 'Tránsito';
  const c = mov.caja ? cajaColor(mov.caja, t) : mov.tipo === 'ingreso' ? t.positive : t.textTer;
  const isIn = mov.tipo === 'ingreso';
  const isTr = mov.tipo === 'transito';
  const icon = isIn ? ICONS.arrDown : isTr ? ICONS.swap : ICONS.arrUp;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: dense ? '10px 0' : '12px 0',
        borderBottom: last ? 'none' : `1px solid ${t.border}`,
        opacity: mov.anulado ? 0.45 : 1,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          flexShrink: 0,
          background: c + (t.mode === 'dark' ? '26' : '17'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ic d={icon} size={16} color={c} sw={2.1} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontFamily: FONT_UI,
              fontWeight: 600,
              fontSize: 13.5,
              color: t.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textDecoration: mov.anulado ? 'line-through' : 'none',
            }}
          >
            {mov.nota}
          </span>
          {mov.voz && <Ic d={ICONS.mic} size={12} color={t.textTer} sw={2} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontFamily: FONT_UI, fontSize: 11.5, color: c, fontWeight: 600 }}>
            {cajaNombre}
          </span>
          <span style={{ color: t.textTer, fontSize: 10 }}>·</span>
          <span style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textTer }}>{mov.fecha}</span>
          {mov.anulado && <Badge color={t.textTer}>anulado</Badge>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <Money
          v={mov.monto}
          size={14}
          sign={isIn ? '+' : isTr ? '↔' : '−'}
          color={isIn ? t.positive : isTr ? t.textSec : t.text}
        />
        {mov.split && (
          <div style={{ fontFamily: FONT_UI, fontSize: 10.5, color: t.textTer, marginTop: 1 }}>
            repartido en 7 cajas
          </div>
        )}
      </div>
    </div>
  );
}

// ── Toggle / switch ────────────────────────────────────────────
function Toggle({ on, onChange, color }) {
  const t = useT();
  return (
    <div
      onClick={() => onChange && onChange(!on)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 99,
        padding: 3,
        boxSizing: 'border-box',
        cursor: 'pointer',
        background: on ? color || t.accent : t.surfaceAlt,
        border: `1px solid ${on ? 'transparent' : t.borderStrong}`,
        transition: 'background 0.2s',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 99,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transform: on ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform 0.2s',
        }}
      />
    </div>
  );
}

Object.assign(window, {
  FONT_UI,
  FONT_MONO,
  ACCENT_PAIRS,
  buildTheme,
  ThemeCtx,
  useT,
  CAJA_COLORS,
  cajaColor,
  CAJAS,
  MOVS,
  saldo,
  DISPONIBLE,
  fmt,
  Money,
  Ic,
  ICONS,
  Mark,
  Wordmark,
  Card,
  Btn,
  Badge,
  CanalBadge,
  ProgressBar,
  Avatar,
  SecLabel,
  EnvelopeCard,
  MovRow,
  Toggle,
});
