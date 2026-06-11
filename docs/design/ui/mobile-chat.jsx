// MayordomoAI — Chat con el asistente (interactivo) + Historial de movimientos

// ── Burbujas de chat ───────────────────────────────────────────
function Bubble({ from = 'bot', children, canal, time }) {
  const t = useT();
  const isUser = from === 'user';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: 4,
      }}
    >
      <div
        style={{
          maxWidth: '82%',
          padding: '10px 14px',
          boxSizing: 'border-box',
          borderRadius: t.r,
          borderBottomRightRadius: isUser ? 6 : t.r,
          borderBottomLeftRadius: isUser ? t.r : 6,
          background: isUser ? t.accent : t.surface,
          color: isUser ? t.onAccent : t.text,
          border: isUser ? 'none' : `1px solid ${t.border}`,
          fontFamily: FONT_UI,
          fontSize: 14,
          lineHeight: 1.5,
          boxShadow: t.shadow,
        }}
      >
        {children}
      </div>
      {(canal || time) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
          {canal && <CanalBadge canal={canal} />}
          {time && (
            <span style={{ fontFamily: FONT_UI, fontSize: 10.5, color: t.textTer }}>{time}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Tarjeta de confirmación dentro del chat (movimiento registrado)
function MovConfirmCard({ cajaId, monto, restante }) {
  const t = useT();
  const c = cajaColor(cajaId, t);
  const caja = CAJAS.find((x) => x.id === cajaId);
  return (
    <div
      style={{
        marginTop: 8,
        borderRadius: t.r - 4,
        overflow: 'hidden',
        border: `1px solid ${t.border}`,
        background: t.inset,
      }}
    >
      <div style={{ height: 3, background: c }}></div>
      <div style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: c + (t.mode === 'dark' ? '26' : '17'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ic d={ICONS.check} size={14} color={c} sw={2.4} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_UI, fontWeight: 650, fontSize: 12.5, color: t.text }}>
            {caja.nombre} · <span style={{ fontFamily: FONT_MONO }}>−S/{fmt(monto)}</span>
          </div>
          <div style={{ fontFamily: FONT_UI, fontSize: 11, color: t.textSec, marginTop: 1 }}>
            Te quedan{' '}
            <span
              style={{
                fontFamily: FONT_MONO,
                fontWeight: 600,
                color: restante < 50 ? t.danger : t.text,
              }}
            >
              S/{fmt(restante)}
            </span>
          </div>
        </div>
        <span style={{ fontFamily: FONT_UI, fontSize: 11, fontWeight: 600, color: t.textTer }}>
          Deshacer
        </span>
      </div>
    </div>
  );
}

// Nota de voz (waveform + transcripción)
function VoiceNote() {
  const t = useT();
  const bars = [5, 9, 14, 8, 12, 16, 10, 6, 11, 15, 9, 5, 8, 12, 7, 4];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 99,
            background: 'rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="10" height="12" viewBox="0 0 10 12">
            <path d="M1 1l8 5-8 5V1z" fill={t.onAccent} />
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, height: 18 }}>
          {bars.map((h, i) => (
            <span
              key={i}
              style={{
                width: 2.5,
                height: h,
                borderRadius: 99,
                background: t.onAccent,
                opacity: i < 10 ? 1 : 0.45,
              }}
            ></span>
          ))}
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, opacity: 0.85 }}>0:09</span>
      </div>
      <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 7, fontStyle: 'italic' }}>
        “me gasté como 30 lucas en el almuerzo con los chicos”
      </div>
    </div>
  );
}

// ── 04 · Chat con el asistente ─────────────────────────────────
function ChatScreen() {
  const t = useT();
  const [msgs, setMsgs] = React.useState([]);
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef(null);
  const send = () => {
    if (!input.trim()) return;
    const txt = input.trim();
    setMsgs((m) => [...m, { from: 'user', text: txt }]);
    setInput('');
    setTimeout(() => {
      setMsgs((m) => [...m, { from: 'bot', text: 'Entendido. Déjame revisar tus cajas…' }]);
      if (scrollRef.current) scrollRef.current.scrollTop = 99999;
    }, 600);
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 99999;
    }, 50);
  };
  return (
    <PhoneShell tab="chat" header={false} screenLabel="Chat con el asistente">
      {/* header propio del chat */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '8px 20px 12px',
          borderBottom: `1px solid ${t.border}`,
          background: t.surface,
          flexShrink: 0,
        }}
      >
        <Mark size={38} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_UI, fontWeight: 700, fontSize: 15.5, color: t.text }}>
            Asistente
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: t.positive }}></span>
            <span style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textSec }}>
              Un solo hilo · WhatsApp y web
            </span>
          </div>
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 99,
            background: t.bg,
            border: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ic d={ICONS.search} size={16} color={t.textSec} />
        </div>
      </div>
      {/* hilo */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: t.bg,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10.5,
              color: t.textTer,
              background: t.surfaceAlt,
              padding: '4px 10px',
              borderRadius: 99,
            }}
          >
            HOY · MARTES 10 JUN
          </span>
        </div>
        <Bubble from="user" canal="whatsapp" time="8:42 a. m.">
          gasté 8 en pasajes
        </Bubble>
        <Bubble from="bot">
          Anotado ✓
          <MovConfirmCard cajaId="pasajes" monto={8} restante={103.5} />
        </Bubble>
        <Bubble from="user" canal="whatsapp" time="1:15 p. m.">
          <VoiceNote />
        </Bubble>
        <Bubble from="bot">
          Entendí un gasto de <b>S/30</b>. ¿Lo pongo en <b>Ocio</b> o en <b>Snacks</b>?
          <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
            {['Ocio', 'Snacks', 'Otra caja'].map((o, i) => (
              <span
                key={o}
                style={{
                  padding: '6px 13px',
                  borderRadius: 99,
                  fontFamily: FONT_UI,
                  fontWeight: 600,
                  fontSize: 12.5,
                  background: i === 0 ? t.accentSoft : 'transparent',
                  color: i === 0 ? (t.mode === 'dark' ? t.accent : t.accentDeep) : t.textSec,
                  border: `1px solid ${i === 0 ? 'transparent' : t.borderStrong}`,
                  cursor: 'pointer',
                }}
              >
                {o}
              </span>
            ))}
          </div>
        </Bubble>
        <Bubble from="user" canal="web" time="Ahora">
          Ocio. ¿Y cuánto llevo gastado ahí este mes?
        </Bubble>
        <Bubble from="bot">
          Listo, <b>S/30 en Ocio</b> ✓. Este mes llevas <b>S/445.66</b> de S/480 asignados — te
          queda <b>S/34.34</b> (93% usado). Vas más rápido que el mes pasado.
        </Bubble>
        {msgs.map((m, i) => (
          <Bubble
            key={i}
            from={m.from}
            time={m.from === 'user' ? 'Ahora' : undefined}
            canal={m.from === 'user' ? 'web' : undefined}
          >
            {m.text}
          </Bubble>
        ))}
      </div>
      {/* input */}
      <div
        style={{
          flexShrink: 0,
          padding: '10px 16px 12px',
          background: t.surface,
          borderTop: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 99,
            background: t.bg,
            border: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ic d={ICONS.plus} size={17} color={t.textSec} />
        </div>
        <div
          style={{
            flex: 1,
            height: 42,
            borderRadius: 99,
            background: t.bg,
            border: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 6px 0 16px',
            boxSizing: 'border-box',
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Escríbele al mayordomo…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: FONT_UI,
              fontSize: 14,
              color: t.text,
              minWidth: 0,
            }}
          />
          <div
            onClick={send}
            style={{
              width: 32,
              height: 32,
              borderRadius: 99,
              background: input.trim() ? t.accent : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <Ic d={ICONS.send} size={15} color={input.trim() ? t.onAccent : t.textTer} />
          </div>
        </div>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 99,
            background: t.accentSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ic d={ICONS.mic} size={18} color={t.mode === 'dark' ? t.accent : t.accentDeep} />
        </div>
      </div>
      <div style={{ height: 24, flexShrink: 0, background: t.surface }}></div>
    </PhoneShell>
  );
}

// ── 05 · Historial de movimientos ──────────────────────────────
function HistorialScreen() {
  const t = useT();
  const [filtro, setFiltro] = React.useState('Todos');
  const chips = ['Todos', 'Gastos', 'Ingresos', 'Tránsito'];
  const visibles = MOVS.filter((m) =>
    filtro === 'Todos'
      ? true
      : filtro === 'Gastos'
        ? m.tipo === 'gasto'
        : filtro === 'Ingresos'
          ? m.tipo === 'ingreso'
          : m.tipo === 'transito',
  );
  const dias = [...new Set(visibles.map((m) => m.dia))];
  return (
    <PhoneShell tab="movs" header={false} screenLabel="Historial de movimientos">
      <div style={{ padding: '6px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1
            style={{
              fontFamily: FONT_UI,
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: '-0.03em',
              color: t.text,
              margin: 0,
            }}
          >
            Movimientos
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 99,
                background: t.surface,
                border: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ic d={ICONS.calendar} size={16} color={t.textSec} />
            </div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 99,
                background: t.surface,
                border: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ic d={ICONS.search} size={16} color={t.textSec} />
            </div>
          </div>
        </div>
        {/* filtros */}
        <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
          {chips.map((ch) => (
            <span
              key={ch}
              onClick={() => setFiltro(ch)}
              style={{
                padding: '7px 14px',
                borderRadius: 99,
                fontFamily: FONT_UI,
                fontWeight: 600,
                fontSize: 12.5,
                cursor: 'pointer',
                background: filtro === ch ? t.text : t.surface,
                color: filtro === ch ? t.bg : t.textSec,
                border: `1px solid ${filtro === ch ? t.text : t.borderStrong}`,
              }}
            >
              {ch}
            </span>
          ))}
        </div>
        {/* resumen del filtro */}
        <Card
          pad={12}
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ic d={ICONS.filter} size={14} color={t.textTer} />
            <span style={{ fontFamily: FONT_UI, fontSize: 12.5, color: t.textSec }}>
              Junio · {visibles.length} movimientos
            </span>
          </div>
          <Money
            v={
              visibles.reduce(
                (s, m) => s + (m.tipo === 'ingreso' ? m.monto : m.anulado ? 0 : -m.monto),
                0,
              ) *
                -1 <
              0
                ? visibles.reduce((s, m) => s + m.monto, 0)
                : visibles.reduce((s, m) => s + (m.anulado ? 0 : m.monto), 0)
            }
            size={14}
            color={t.textSec}
          />
        </Card>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 20px 8px' }}>
        {dias.map((dia) => (
          <div key={dia}>
            <SecLabel style={{ margin: '14px 0 2px' }}>{dia}</SecLabel>
            {visibles
              .filter((m) => m.dia === dia)
              .map((m, i, arr) => (
                <MovRow key={m.id} mov={m} last={i === arr.length - 1} />
              ))}
          </div>
        ))}
      </div>
    </PhoneShell>
  );
}

Object.assign(window, { Bubble, MovConfirmCard, VoiceNote, ChatScreen, HistorialScreen });
