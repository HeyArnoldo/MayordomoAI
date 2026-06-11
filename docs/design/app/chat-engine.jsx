// MayordomoAI — motor de chat compartido (desktop rail + thread, móvil drawer)

// ── Motor de respuestas del bot ────────────────────────────────
// Devuelve { logMov?, msgs:[...] }. Lee cajas reales del estado.
function botRespond(text, state) {
  const t = text.toLowerCase().trim();
  const tono = state.chatTone;
  const num = t.match(/(\d+(?:[.,]\d+)?)/);
  const gc = gastoCajas(state.cajas);

  // intención: anotar gasto
  if (/(gast[eéo]|pagu[eé]|compr[eé]|anota|registra|me fue|met[eí])/.test(t) && num) {
    const monto = parseFloat(num[1].replace(',', '.'));
    const caja = state.cajas.find((c) => t.includes(c.nombre.toLowerCase()) && c.tipo === 'gasto');
    if (caja) {
      return {
        logMov: { tipo: 'gasto', caja: caja.id, monto, nota: text.slice(0, 40), origen: 'pwa' },
        msgs: [
          {
            from: 'bot',
            text: pick(tono, '✓ Anotado.', 'Listo, anotado ✓', 'A sus órdenes, registrado.'),
            kind: 'confirm',
            data: { cajaId: caja.id, monto, restante: saldoDe(caja) - monto },
          },
        ],
      };
    }
    return {
      msgs: [
        {
          from: 'bot',
          text: `Entendí un gasto de S/${fmt(monto)}. ¿En qué caja lo pongo?`,
          chips: gc.slice(0, 3).map((c) => c.nombre),
        },
      ],
    };
  }
  // resumen / reporte
  if (/(resum|reporte|c[oó]mo voy|balance|este mes|junio|gast[eé] m[aá]s)/.test(t)) {
    return {
      msgs: [
        { from: 'bot', text: 'Aquí tu resumen de junio:', kind: 'report' },
        {
          from: 'bot',
          text: `Te queda S/${fmt(disponible(state.cajas))} de disponible. Ojo con Ocio y Diezmo, ya casi al tope.`,
        },
      ],
    };
  }
  // ahorro
  if (/(ahorr|guardar|meta|invertir)/.test(t)) {
    return {
      msgs: [
        {
          from: 'bot',
          text: 'Tu fondo de Ahorro va en S/4,350 y suma S/800 al mes. Si subes Ahorro a 30% y bajas Ocio a 10%, guardarías ~S/160 más cada mes. ¿Lo ajusto?',
          chips: ['Ajustar reparto', 'Mejor no'],
        },
      ],
    };
  }
  // dónde me excedo
  if (/(excedo|paso|sobregir|alcanza|tope|l[ií]mite)/.test(t)) {
    return {
      msgs: [
        { from: 'bot', text: 'Estas son las cajas más ajustadas:', kind: 'report' },
        {
          from: 'bot',
          text: 'Ocio (93%) y Diezmo (100%) están al límite. ¿Quieres que te avise al llegar al 80% en cada caja?',
          chips: ['Sí, avísame', 'No por ahora'],
        },
      ],
    };
  }
  // saludos
  if (/(hola|buenas|hey|qu[eé] tal|ey)/.test(t)) {
    return {
      msgs: [
        {
          from: 'bot',
          text: pick(
            tono,
            'A sus órdenes. ¿Anotamos un gasto, revisamos tus cajas o vemos un reporte?',
            '¡Hola! ¿Qué hacemos hoy con tu plata?',
            'Buenas. ¿En qué le sirvo?',
          ),
          chips: ['Resume junio', 'Anota un gasto', '¿En qué me excedo?'],
        },
      ],
    };
  }
  // afirmaciones rápidas
  if (/(ajustar reparto)/.test(t))
    return {
      msgs: [
        {
          from: 'bot',
          text: 'Hecho — dejé Ahorro en 30% y Ocio en 10%. Aplica a tus próximos ingresos. Puedes revisarlo en Cajas y reparto.',
        },
      ],
    };
  if (/(s[ií],? av[ií]same|av[ií]same)/.test(t))
    return {
      msgs: [
        {
          from: 'bot',
          text: 'Listo, te avisaré por WhatsApp al llegar al 80% en cada caja de gasto.',
        },
      ],
    };
  if (/^(ocio|snacks|varios|pasajes|diezmo|ofrenda|ahorro)$/.test(t)) {
    const caja = state.cajas.find((c) => c.nombre.toLowerCase() === t);
    if (caja)
      return {
        logMov: {
          tipo: 'gasto',
          caja: caja.id,
          monto: 30,
          nota: 'Almuerzo con los chicos',
          origen: 'pwa',
        },
        msgs: [
          {
            from: 'bot',
            text: `Listo, S/30 en ${caja.nombre} ✓`,
            kind: 'confirm',
            data: { cajaId: caja.id, monto: 30, restante: saldoDe(caja) - 30 },
          },
        ],
      };
  }
  return {
    msgs: [
      {
        from: 'bot',
        text: pick(
          tono,
          'Anotado. Lo reviso contra tus cajas y te confirmo en un momento.',
          'Dale, lo veo y te digo.',
          'Entendido. Permítame revisar sus cajas.',
        ),
      },
    ],
  };
}
function pick(tono, neutro, cercano, formal) {
  return tono === 'Cercano' ? cercano : tono === 'Formal' ? formal : neutro;
}

// Hook: enviar mensaje al chat activo + respuesta del bot con typing
function useChatSend() {
  const { state, dispatch } = useStore();
  const [typing, setTyping] = React.useState(false);
  const send = React.useCallback(
    (raw) => {
      const text = (raw || '').trim();
      if (!text) return;
      const chatId = state.activeChat;
      dispatch({
        type: 'APPEND_MSG',
        id: chatId,
        msg: { from: 'user', canal: 'web', time: 'Ahora', text },
      });
      setTyping(true);
      const res = botRespond(text, state);
      if (res.logMov) dispatch({ type: 'ADD_MOV', mov: res.logMov });
      res.msgs.forEach((m, i) => {
        setTimeout(
          () => {
            dispatch({ type: 'APPEND_MSG', id: chatId, msg: m });
            if (i === res.msgs.length - 1) setTyping(false);
          },
          700 + i * 650,
        );
      });
    },
    [state, dispatch],
  );
  return { send, typing };
}

// ── Mini-reporte dentro del chat ───────────────────────────────
function ChatMiniReport({ cajas, mode }) {
  const gc = gastoCajas(cajas)
    .filter((c) => c.gastado > 0)
    .sort((a, b) => b.gastado - a.gastado);
  const max = gc[0] ? gc[0].gastado : 1;
  return (
    <div className="mt-2 rounded-[12px] border border-line bg-inset overflow-hidden">
      <div className="px-3 pt-2.5 pb-2 flex items-center justify-between border-b border-line">
        <span className="font-mono text-[10px] tracking-wider uppercase text-ink3">
          Gasto por caja · junio
        </span>
        <span className="font-mono text-[10px] text-ink3">
          S/{fmt(gc.reduce((s, c) => s + c.gastado, 0))}
        </span>
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-2">
        {gc.slice(0, 5).map((c) => {
          const col = cajaColor(c.id, mode);
          return (
            <div key={c.id} className="flex items-center gap-2.5">
              <span className="w-[52px] text-[11px] font-semibold text-ink2 shrink-0">
                {c.nombre}
              </span>
              <div className="flex-1 h-3 rounded bg-card overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: (c.gastado / max) * 100 + '%', background: col }}
                />
              </div>
              <span className="w-[52px] text-right font-mono text-[10.5px] font-semibold text-ink shrink-0">
                {fmt(c.gastado)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Render de un mensaje (texto + kinds) ───────────────────────
function ChatMessage({ msg, cajas, mode, onChip }) {
  const isUser = msg.from === 'user';
  return (
    <div className={cx('flex flex-col gap-1 animate-msg', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cx(
          'max-w-[80%] px-3.5 py-2.5 rounded-card text-[14px] leading-snug shadow-card',
          isUser
            ? 'bg-brand text-onBrand rounded-br-[6px]'
            : 'bg-card text-ink border border-line rounded-bl-[6px]',
        )}
      >
        {msg.kind === 'voice' ? <VoiceNote mode={mode} text={msg.text} /> : <span>{msg.text}</span>}
        {msg.kind === 'confirm' && msg.data && (
          <ConfirmCard
            cajaId={msg.data.cajaId}
            monto={msg.data.monto}
            restante={msg.data.restante}
            cajas={cajas}
            mode={mode}
          />
        )}
        {msg.kind === 'report' && <ChatMiniReport cajas={cajas} mode={mode} />}
        {msg.chips && (
          <div className="flex gap-1.5 mt-2.5 flex-wrap">
            {msg.chips.map((o, i) => (
              <button
                key={o}
                onClick={() => onChip && onChip(o)}
                className={cx(
                  'px-3 py-1.5 rounded-full font-semibold text-[12.5px] border transition active:scale-95',
                  i === 0 && !isUser
                    ? 'bg-brandSoft text-brandDeep dark:text-brand border-transparent'
                    : 'bg-transparent border-lineStrong',
                  isUser ? 'text-onBrand/90 border-white/30' : 'text-ink2',
                )}
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
      {(msg.canal || msg.time) && (
        <div className="flex items-center gap-1.5 px-1">
          {msg.canal && <CanalBadge canal={msg.canal} mode={mode} />}
          {msg.time && <span className="text-[10.5px] text-ink3">{msg.time}</span>}
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3.5 py-3 bg-card border border-line rounded-card rounded-bl-[6px] w-fit animate-msg">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-ink3 animate-bounce"
          style={{ animationDelay: i * 0.15 + 's' }}
        />
      ))}
    </div>
  );
}

// ── Composer (multilínea, adjuntar, mic, enviar, tono) ─────────
function Composer({ onSend, big = false }) {
  const { state, dispatch } = useStore();
  const [val, setVal] = React.useState('');
  const [attach, setAttach] = React.useState(false);
  const taRef = React.useRef(null);
  const submit = () => {
    if (!val.trim()) return;
    onSend(val);
    setVal('');
    setAttach(false);
    if (taRef.current) taRef.current.style.height = 'auto';
  };
  const grow = (e) => {
    setVal(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };
  return (
    <div className="shrink-0 px-3 pt-2.5 pb-3 bg-card border-t border-line">
      {attach && (
        <div className="flex items-center gap-2.5 mb-2.5 px-3 py-2 rounded-xl bg-inset border border-line animate-msg">
          <div className="w-10 h-10 rounded-lg bg-cardAlt flex items-center justify-center text-ink2">
            <Icon name="receipt" size={18} />
          </div>
          <div className="flex-1">
            <div className="text-[12.5px] font-semibold text-ink">boleta_metro.jpg</div>
            <div className="text-[11px] text-ink3">Leeré el monto y la fecha de la boleta</div>
          </div>
          <button onClick={() => setAttach(false)} className="text-ink3">
            <Icon name="x" size={15} />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => setAttach(true)}
          className="w-10 h-10 rounded-full bg-page border border-line flex items-center justify-center text-ink2 shrink-0 active:bg-cardAlt"
        >
          <Icon name="clip" size={17} />
        </button>
        <div className="flex-1 min-h-[42px] rounded-[20px] bg-page border border-line flex items-end pl-4 pr-1.5 py-1.5 box-border">
          <textarea
            ref={taRef}
            value={val}
            onChange={grow}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Escríbele al mayordomo…"
            className="flex-1 bg-transparent outline-none text-[14px] text-ink resize-none leading-snug py-1.5 max-h-[120px] placeholder:text-ink3"
          />
          <button
            onClick={submit}
            className={cx(
              'w-8 h-8 rounded-full flex items-center justify-center transition shrink-0 mb-0.5',
              val.trim() ? 'bg-brand text-onBrand' : 'text-ink3',
            )}
          >
            <Icon name="send" size={15} />
          </button>
        </div>
        <button className="w-[42px] h-[42px] rounded-full bg-brandSoft text-brandDeep dark:text-brand flex items-center justify-center shrink-0">
          <Icon name="mic" size={18} />
        </button>
      </div>
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] text-ink3">Tono:</span>
          {['Neutro', 'Cercano', 'Formal'].map((tn) => (
            <button
              key={tn}
              onClick={() => dispatch({ type: 'CHAT_TONE', v: tn })}
              className={cx(
                'text-[10.5px] font-semibold px-2 py-0.5 rounded-full transition',
                state.chatTone === tn ? 'bg-cardAlt text-ink' : 'text-ink3',
              )}
            >
              {tn}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-ink3 font-mono hidden sm:block">
          Enter envía · ⇧Enter salto
        </span>
      </div>
    </div>
  );
}

// ── Empty state con chips de sugerencia ────────────────────────
function ChatEmpty({ onPick }) {
  const sug = [
    { ic: 'chart', t: 'Resume mi junio', q: 'Hazme un resumen de junio' },
    { ic: 'wallet', t: 'Anota un gasto', q: 'gasté 25 en snacks' },
    { ic: 'filter', t: '¿En qué me excedo?', q: '¿en qué cajas me estoy pasando?' },
    { ic: 'arrUp', t: '¿Puedo ahorrar más?', q: 'quiero ahorrar más, ¿qué me recomiendas?' },
  ];
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <Mark size={56} />
      <h2 className="font-bold text-[22px] tracking-[-0.02em] text-ink mt-4">
        ¿En qué te ayudo hoy?
      </h2>
      <p className="text-[13.5px] text-ink2 mt-1.5 max-w-[340px]">
        Pregúntame por tus cajas, pídeme un reporte o solo dime un gasto. Lo registro y lo cuido por
        ti.
      </p>
      <div className="grid grid-cols-2 gap-2.5 mt-7 w-full max-w-[420px]">
        {sug.map((s) => (
          <button
            key={s.t}
            onClick={() => onPick(s.q)}
            className="flex items-center gap-2.5 p-3 rounded-card bg-card border border-line text-left hover:border-lineStrong active:scale-[0.98] transition"
          >
            <div className="w-8 h-8 rounded-[10px] bg-brandSoft text-brandDeep dark:text-brand flex items-center justify-center shrink-0">
              <Icon name={s.ic} size={16} />
            </div>
            <span className="text-[13px] font-semibold text-ink">{s.t}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Hilo activo (mensajes + composer) ──────────────────────────
function ChatThread({ headerless = false }) {
  const { state } = useStore();
  const chat = state.chats.find((c) => c.id === state.activeChat) || state.chats[0];
  const { send, typing } = useChatSend();
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 999999;
  }, [chat.mensajes.length, typing]);
  const empty = chat.mensajes.length === 0;
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {empty ? (
        <ChatEmpty onPick={send} />
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-[18px] py-4 flex flex-col gap-3 bg-page"
        >
          <div className="text-center">
            <span className="font-mono text-[10.5px] text-ink3 bg-cardAlt px-2.5 py-1 rounded-full">
              {chat.sistema ? 'SINCRONIZADO CON WHATSAPP' : 'HOY · MARTES 10 JUN'}
            </span>
          </div>
          {chat.mensajes.map((m) => (
            <ChatMessage key={m.id} msg={m} cajas={state.cajas} mode={state.mode} onChip={send} />
          ))}
          {typing && <TypingDots />}
        </div>
      )}
      <Composer onSend={send} />
    </div>
  );
}

Object.assign(window, {
  botRespond,
  useChatSend,
  ChatMiniReport,
  ChatMessage,
  TypingDots,
  Composer,
  ChatEmpty,
  ChatThread,
});

// ── Fila de sesión (con menú renombrar/fijar/archivar) ─────────
function SessionRow({ chat, active, onSelect, mode }) {
  const { dispatch } = useStore();
  const [menu, setMenu] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(chat.titulo);
  const col = chat.canal === 'whatsapp' ? cajaColor('ahorro', mode) : 'var(--c-ink3)';
  const commit = () => {
    dispatch({ type: 'RENAME_CHAT', id: chat.id, titulo: name.trim() || chat.titulo });
    setEditing(false);
  };
  return (
    <div
      className={cx(
        'group relative flex items-center gap-2.5 px-2.5 py-2 rounded-[11px] cursor-pointer transition',
        active ? 'bg-brandSoft' : 'hover:bg-cardAlt',
      )}
      onClick={() => !editing && onSelect(chat.id)}
    >
      <div
        className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0"
        style={{ background: chat.sistema ? col + '22' : 'var(--c-cardAlt)' }}
      >
        <Icon
          name={chat.sistema ? 'phone' : 'chat'}
          size={14}
          style={{ color: chat.sistema ? col : 'var(--c-ink2)' }}
        />
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-card border border-brand rounded px-1.5 py-0.5 text-[13px] font-semibold text-ink outline-none"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className={cx(
                'text-[13px] font-semibold truncate',
                active ? 'text-brandDeep dark:text-brand' : 'text-ink',
              )}
            >
              {chat.titulo}
            </span>
            {chat.fijado && <Icon name="pin" size={11} className="text-ink3 shrink-0" fill />}
          </div>
        )}
        {!editing && (
          <div className="text-[11px] text-ink3 truncate">{chat.resumen || 'Sin mensajes aún'}</div>
        )}
      </div>
      {!editing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenu((m) => !m);
          }}
          className={cx(
            'w-7 h-7 rounded-lg flex items-center justify-center text-ink3 shrink-0 transition',
            menu ? 'bg-cardAlt opacity-100' : 'opacity-0 group-hover:opacity-100 hover:bg-cardAlt',
          )}
        >
          <Icon name="dots" size={16} />
        </button>
      )}
      {menu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setMenu(false);
            }}
          />
          <div
            className="absolute right-2 top-11 z-50 w-40 bg-card border border-line rounded-xl shadow-lg py-1 animate-msg"
            onClick={(e) => e.stopPropagation()}
          >
            {[
              {
                ic: 'edit',
                t: 'Renombrar',
                fn: () => {
                  setEditing(true);
                  setMenu(false);
                },
              },
              {
                ic: 'pin',
                t: chat.fijado ? 'Desfijar' : 'Fijar',
                fn: () => {
                  dispatch({ type: 'PIN_CHAT', id: chat.id });
                  setMenu(false);
                },
              },
              !chat.sistema && {
                ic: 'archive',
                t: 'Archivar',
                fn: () => {
                  dispatch({ type: 'DELETE_CHAT', id: chat.id });
                  setMenu(false);
                },
              },
              !chat.sistema && {
                ic: 'trash',
                t: 'Borrar',
                danger: true,
                fn: () => {
                  dispatch({ type: 'DELETE_CHAT', id: chat.id });
                  setMenu(false);
                },
              },
            ]
              .filter(Boolean)
              .map((o) => (
                <button
                  key={o.t}
                  onClick={o.fn}
                  className={cx(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-left hover:bg-cardAlt',
                    o.danger ? 'text-neg' : 'text-ink',
                  )}
                >
                  <Icon name={o.ic} size={15} />
                  {o.t}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Rail de sesiones (buscador + nueva + lista agrupada) ───────
function ConversationRail({ width = 280, onClose, onToggleFloat, floating }) {
  const { state, dispatch } = useStore();
  const [q, setQ] = React.useState('');
  const fijadas = state.chats.filter(
    (c) => c.fijado && (!q || c.titulo.toLowerCase().includes(q.toLowerCase())),
  );
  const resto = state.chats.filter(
    (c) => !c.fijado && (!q || c.titulo.toLowerCase().includes(q.toLowerCase())),
  );
  const grupos = ['Hoy', 'Ayer', '7 días', 'Junio'];
  return (
    <div className="flex flex-col h-full bg-card border-r border-line" style={{ width }}>
      <div className="px-3.5 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[16px] tracking-[-0.02em] text-ink">Conversaciones</h2>
          <div className="flex items-center gap-1">
            {onToggleFloat && (
              <button
                onClick={onToggleFloat}
                title={floating ? 'Fijar al costado' : 'Flotar sobre el hilo'}
                className={cx(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition',
                  floating
                    ? 'bg-brandSoft text-brandDeep dark:text-brand'
                    : 'bg-cardAlt text-ink2 hover:text-ink',
                )}
              >
                <Icon name="pin" size={15} fill={floating} />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                title="Ocultar panel"
                className="w-8 h-8 rounded-lg bg-cardAlt flex items-center justify-center text-ink2 hover:text-ink"
              >
                <Icon name="dblL" size={15} />
              </button>
            )}
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: 'NEW_CHAT' })}
          className="w-full h-10 rounded-[12px] bg-brand text-onBrand font-semibold text-[13.5px] flex items-center justify-center gap-2 active:brightness-95 transition"
        >
          <Icon name="penNew" size={16} sw={2} />
          Nueva conversación
        </button>
        <div className="mt-2.5 h-9 rounded-[11px] bg-page border border-line flex items-center px-3 gap-2">
          <Icon name="search" size={15} className="text-ink3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="flex-1 bg-transparent outline-none text-[13px] text-ink placeholder:text-ink3"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
        {fijadas.length > 0 && (
          <div className="px-2.5 pt-1 pb-1">
            <SecLabel>Fijado</SecLabel>
          </div>
        )}
        {fijadas.map((c) => (
          <SessionRow
            key={c.id}
            chat={c}
            active={c.id === state.activeChat}
            onSelect={(id) => dispatch({ type: 'SELECT_CHAT', id })}
            mode={state.mode}
          />
        ))}
        {grupos.map((g) => {
          const items = resto.filter((c) => c.grupo === g);
          if (!items.length) return null;
          return (
            <React.Fragment key={g}>
              <div className="px-2.5 pt-3 pb-1">
                <SecLabel>{g}</SecLabel>
              </div>
              {items.map((c) => (
                <SessionRow
                  key={c.id}
                  chat={c}
                  active={c.id === state.activeChat}
                  onSelect={(id) => dispatch({ type: 'SELECT_CHAT', id })}
                  mode={state.mode}
                />
              ))}
            </React.Fragment>
          );
        })}
        {fijadas.length + resto.length === 0 && (
          <div className="text-[12.5px] text-ink3 text-center py-8">Sin resultados para "{q}"</div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SessionRow, ConversationRail });
