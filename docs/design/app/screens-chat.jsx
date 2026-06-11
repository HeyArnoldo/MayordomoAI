// MayordomoAI — Chat con el asistente (interactivo, mismo hilo WhatsApp + web)

function ChatBubble({ from, children, canal, time, mode }) {
  const isUser = from === 'user';
  return (
    <div className={cx('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cx(
          'max-w-[84%] px-3.5 py-2.5 rounded-card text-[14px] leading-snug shadow-card',
          isUser
            ? 'bg-brand text-onBrand rounded-br-[6px]'
            : 'bg-card text-ink border border-line rounded-bl-[6px]',
        )}
      >
        {children}
      </div>
      {(canal || time) && (
        <div className="flex items-center gap-1.5 px-1">
          {canal && <CanalBadge canal={canal} mode={mode} />}
          {time && <span className="text-[10.5px] text-ink3">{time}</span>}
        </div>
      )}
    </div>
  );
}

function ConfirmCard({ cajaId, monto, restante, cajas, mode }) {
  const c = cajaColor(cajaId, mode);
  const caja = (cajas || []).find((x) => x.id === cajaId) || { nombre: cajaId };
  return (
    <div className="mt-2 rounded-[12px] overflow-hidden border border-line bg-inset">
      <div className="h-[3px]" style={{ background: c }} />
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div
          className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center"
          style={{ background: c + (mode === 'dark' ? '26' : '17') }}
        >
          <Icon name="check" size={14} sw={2.4} style={{ color: c }} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-[12.5px] text-ink">
            {caja.nombre} · <span className="font-mono">−S/{fmt(monto)}</span>
          </div>
          <div className="text-[11px] text-ink2 mt-px">
            Te quedan{' '}
            <span
              className={cx('font-mono font-semibold', restante < 50 ? 'text-neg' : 'text-ink')}
            >
              S/{fmt(restante)}
            </span>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-ink3">Deshacer</span>
      </div>
    </div>
  );
}

function VoiceNote({ mode, text }) {
  const bars = [5, 9, 14, 8, 12, 16, 10, 6, 11, 15, 9, 5, 8, 12, 7, 4];
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <div className="w-[26px] h-[26px] rounded-full bg-white/25 flex items-center justify-center shrink-0">
          <svg width="10" height="12" viewBox="0 0 10 12">
            <path d="M1 1l8 5-8 5V1z" fill="currentColor" />
          </svg>
        </div>
        <div className="flex items-center gap-[2.5px] h-[18px]">
          {bars.map((h, i) => (
            <span
              key={i}
              className="w-[2.5px] rounded-full bg-current"
              style={{ height: h, opacity: i < 10 ? 1 : 0.45 }}
            />
          ))}
        </div>
        <span className="font-mono text-[11px] opacity-85">0:09</span>
      </div>
      <div className="text-[12.5px] opacity-80 mt-1.5 italic">
        "{text || 'me gasté como 30 lucas en el almuerzo con los chicos'}"
      </div>
    </div>
  );
}

// Respuestas canned simples del bot según el texto
function botReply(text, state) {
  const t = text.toLowerCase();
  const gc = gastoCajas(state.cajas);
  if (/(resumen|saldo|cuanto|cuánto|cajas)/.test(t)) {
    const lines = gc
      .slice(0, 4)
      .map((c) => `${c.nombre} S/${fmt(saldoDe(c))}`)
      .join(' · ');
    return { text: `Tu disponible es S/${fmt(disponible(state.cajas))}. ${lines}.` };
  }
  if (/(gast|pagué|pague|compré|compre)\s*\d/.test(t)) {
    return {
      text: 'Entendido, lo registro. ¿En qué caja lo pongo?',
      chips: ['Ocio', 'Snacks', 'Varios'],
    };
  }
  if (/(hola|buenas|hey)/.test(t))
    return { text: 'A sus órdenes. ¿Registramos un gasto o quieres ver tus cajas?' };
  return { text: 'Anotado ✓. Estoy revisando tus cajas para darte el detalle…' };
}

function ChatScreen() {
  const { state, dispatch } = useStore();
  const chat = state.chats.find((c) => c.id === state.activeChat) || state.chats[0];
  return (
    <>
      {/* header del chat */}
      <div className="flex items-center gap-2.5 px-4 pt-2 pb-3 border-b border-line bg-card shrink-0">
        <button
          onClick={() => dispatch({ type: 'CHAT_DRAWER', v: true })}
          className="w-9 h-9 rounded-full bg-page border border-line flex items-center justify-center text-ink2 shrink-0"
        >
          <Icon name="list" size={17} />
        </button>
        <div className="w-9 h-9 shrink-0">
          <Mark size={36} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] text-ink truncate">{chat.titulo}</div>
          <div className="flex items-center gap-1.5 mt-px">
            {chat.sistema ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-pos" />
                <span className="text-[11.5px] text-ink2">WhatsApp + web · en vivo</span>
              </>
            ) : (
              <span className="text-[11.5px] text-ink2">Sesión · puede anotar y consultar</span>
            )}
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: 'NEW_CHAT' })}
          className="w-9 h-9 rounded-full bg-page border border-line flex items-center justify-center text-ink2 shrink-0"
        >
          <Icon name="penNew" size={16} />
        </button>
      </div>
      {/* hilo + composer (motor compartido) */}
      <ChatThread />
      <div className="h-6 shrink-0 bg-card" />
      {/* drawer de sesiones */}
      {state.chatDrawer && (
        <div
          className="absolute inset-0 z-50 flex"
          onClick={() => dispatch({ type: 'CHAT_DRAWER', v: false })}
          style={{ background: state.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(22,33,26,0.32)' }}
        >
          <div onClick={(e) => e.stopPropagation()} className="h-full animate-drawer shadow-2xl">
            <ConversationRail
              width={300}
              onClose={() => dispatch({ type: 'CHAT_DRAWER', v: false })}
            />
          </div>
        </div>
      )}
    </>
  );
}

Object.assign(window, { ChatBubble, ConfirmCard, VoiceNote, ChatScreen, botReply });
