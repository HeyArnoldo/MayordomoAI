// MayordomoAI — store global: datos, estado (reducer + context), helpers, iconos, tema.
// Tailwind: las clases mapean 1:1 al stack real (apps/web). Aquí va la lógica.

// ── Paletas de acento (claro/oscuro) ───────────────────────────
const ACCENTS = {
  verde: {
    l: { brand: '#0E7A4D', deep: '#0B6340', soft: '#E3F1EA', on: '#FFFFFF' },
    d: { brand: '#34D399', deep: '#34D399', soft: '#16332A', on: '#08160F' },
  },
  teal: {
    l: { brand: '#0F7E96', deep: '#0C677C', soft: '#E1F0F3', on: '#FFFFFF' },
    d: { brand: '#53C8DE', deep: '#53C8DE', soft: '#123139', on: '#06171B' },
  },
  indigo: {
    l: { brand: '#41599E', deep: '#354B86', soft: '#E7EAF5', on: '#FFFFFF' },
    d: { brand: '#93A8E8', deep: '#93A8E8', soft: '#1C2745', on: '#0A1020' },
  },
};

const NEUTRAL = {
  light: {
    page: '#F2F5F2',
    card: '#FFFFFF',
    cardAlt: '#EBEFEB',
    inset: '#F6F8F6',
    line: '#E3E8E3',
    lineStrong: '#CFD8CF',
    ink: '#16211A',
    ink2: '#5D6A62',
    ink3: '#94A09A',
    pos: '#0E7A4D',
    neg: '#BB4540',
    negSoft: '#F7E9E8',
    warn: '#B07C1E',
  },
  dark: {
    page: '#0C120F',
    card: '#141C17',
    cardAlt: '#1A241E',
    inset: '#101813',
    line: '#222E27',
    lineStrong: '#31413A',
    ink: '#EDF3EE',
    ink2: '#93A29A',
    ink3: '#5F6E65',
    pos: '#34D399',
    neg: '#F07B72',
    negSoft: '#3A211F',
    warn: '#E0B34E',
  },
};

function applyTheme(el, mode, accentKey) {
  if (!el) return;
  const n = NEUTRAL[mode];
  const a = (ACCENTS[accentKey] || ACCENTS.verde)[mode === 'dark' ? 'd' : 'l'];
  const v = {
    page: n.page,
    card: n.card,
    cardAlt: n.cardAlt,
    inset: n.inset,
    line: n.line,
    lineStrong: n.lineStrong,
    ink: n.ink,
    ink2: n.ink2,
    ink3: n.ink3,
    brand: a.brand,
    brandSoft: a.soft,
    brandDeep: a.deep,
    onBrand: a.on,
    pos: n.pos,
    neg: n.neg,
    negSoft: n.negSoft,
    warn: n.warn,
  };
  Object.entries(v).forEach(([k, val]) => el.style.setProperty('--c-' + k, val));
  el.classList.toggle('dark', mode === 'dark');
}

// ── Colores por caja (claro/oscuro) ────────────────────────────
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
const cajaColor = (id, mode) =>
  (CAJA_COLORS[id] || CAJA_COLORS.varios)[mode === 'dark' ? 'd' : 'l'];
// color + alpha (hex de 2 dígitos)
const alpha = (hex, a) => hex + a;

// ── Datos semilla ──────────────────────────────────────────────
const INGRESOS_PERSONAL = 3200;
const CAJAS_SEED = [
  {
    id: 'ahorro',
    nombre: 'Ahorro',
    pct: 25,
    tipo: 'fondo',
    ambito: 'personal',
    gastado: 0,
    acumulado: 4350,
  },
  { id: 'varios', nombre: 'Varios', pct: 20, tipo: 'gasto', ambito: 'personal', gastado: 287.9 },
  { id: 'pasajes', nombre: 'Pasajes', pct: 15, tipo: 'gasto', ambito: 'personal', gastado: 376.5 },
  { id: 'ocio', nombre: 'Ocio', pct: 15, tipo: 'gasto', ambito: 'personal', gastado: 445.66 },
  { id: 'diezmo', nombre: 'Diezmo', pct: 10, tipo: 'gasto', ambito: 'personal', gastado: 320 },
  { id: 'snacks', nombre: 'Snacks', pct: 10, tipo: 'gasto', ambito: 'personal', gastado: 214.3 },
  { id: 'ofrenda', nombre: 'Ofrenda', pct: 5, tipo: 'gasto', ambito: 'personal', gastado: 100 },
];
const asignadoDe = (c, ingresos = INGRESOS_PERSONAL) => Math.round(ingresos * c.pct) / 100;
const saldoDe = (c) => asignadoDe(c) - c.gastado;

const MOVS_SEED = [
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
    ambito: 'empresa',
    fecha: 'Lun 8 · 9:14 a. m.',
    dia: 'Lun 8 jun',
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
    anulado: true,
    fecha: 'Dom 7 · 8:05 p. m.',
    dia: 'Dom 7 jun',
  },
];

// ── Sesiones de chat ───────────────────────────────────────────
// El hilo de WhatsApp es 'sistema': fijo, no se borra, sincroniza con el bot.
// Mensaje: { id, from:'user'|'bot', text, canal, time, kind?:'confirm'|'report'|'voice', data?, chips? }
const CHATS_SEED = [
  {
    id: 'wa',
    titulo: 'Hilo principal',
    canal: 'whatsapp',
    fijado: true,
    sistema: true,
    grupo: 'Sincronizado',
    resumen: 'S/30 en Ocio · te queda S/34.34',
    updatedAt: 'Ahora',
    mensajes: [
      { id: 1, from: 'user', canal: 'whatsapp', time: '8:42 a. m.', text: 'gasté 8 en pasajes' },
      {
        id: 2,
        from: 'bot',
        text: 'Anotado ✓',
        kind: 'confirm',
        data: { cajaId: 'pasajes', monto: 8, restante: 103.5 },
      },
      {
        id: 3,
        from: 'user',
        canal: 'whatsapp',
        time: '1:15 p. m.',
        kind: 'voice',
        text: 'me gasté como 30 lucas en el almuerzo con los chicos',
      },
      {
        id: 4,
        from: 'bot',
        text: 'Entendí un gasto de S/30. ¿Lo pongo en Ocio o en Snacks?',
        chips: ['Ocio', 'Snacks', 'Otra caja'],
      },
      {
        id: 5,
        from: 'user',
        canal: 'web',
        time: 'Ahora',
        text: 'Ocio. ¿cuánto llevo gastado ahí este mes?',
      },
      {
        id: 6,
        from: 'bot',
        text: 'Listo, S/30 en Ocio ✓. Este mes llevas S/445.66 de S/480 — te queda S/34.34 (93% usado). Vas más rápido que el mes pasado.',
      },
    ],
  },
  {
    id: 'c1',
    titulo: 'Revisión de junio',
    canal: 'web',
    grupo: 'Hoy',
    resumen: 'Resumen y dónde te excedes',
    updatedAt: 'Hoy · 2:10 p. m.',
    mensajes: [
      {
        id: 1,
        from: 'user',
        canal: 'web',
        time: '2:08 p. m.',
        text: '¿Cómo voy este mes? Hazme un resumen',
      },
      { id: 2, from: 'bot', text: 'Aquí tu resumen de junio:', kind: 'report' },
      {
        id: 3,
        from: 'bot',
        text: 'En corto: vas bien en Ahorro y Snacks, pero Ocio (93%) y Diezmo (100%) ya están al tope. Te queda S/152 de disponible para los próximos 20 días.',
      },
    ],
  },
  {
    id: 'c2',
    titulo: '¿Puedo ahorrar más?',
    canal: 'web',
    grupo: 'Ayer',
    resumen: 'Simular subir Ahorro a 30%',
    updatedAt: 'Ayer · 9:30 p. m.',
    mensajes: [
      {
        id: 1,
        from: 'user',
        canal: 'web',
        time: '9:28 p. m.',
        text: 'quiero ahorrar más, ¿qué me recomiendas?',
      },
      {
        id: 2,
        from: 'bot',
        text: 'Tu fondo de Ahorro va en S/4,350 y suma S/800 al mes. Si subes Ahorro de 25% a 30% y bajas Ocio a 10%, guardarías ~S/160 más cada mes sin tocar lo esencial. ¿Lo ajusto?',
        chips: ['Ajustar reparto', 'Mejor no'],
      },
    ],
  },
  {
    id: 'c3',
    titulo: 'Gastos de Ocio',
    canal: 'web',
    grupo: '7 días',
    resumen: 'Detalle de la caja Ocio',
    updatedAt: 'Lun 8 jun',
    mensajes: [
      {
        id: 1,
        from: 'user',
        canal: 'web',
        time: 'Lun 8',
        text: '¿en qué se me fue la plata de Ocio?',
      },
      {
        id: 2,
        from: 'bot',
        text: 'En Ocio (S/445.66 de S/480) lo más fuerte fue: Almuerzo con los chicos S/30, Cine S/24.90, y varias salidas chicas. ¿Quieres que te avise al llegar al 80%?',
        chips: ['Sí, avísame al 80%', 'No, gracias'],
      },
    ],
  },
];

// ── Formato dinero ─────────────────────────────────────────────
const fmt = (n) =>
  Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Estado global ──────────────────────────────────────────────
const initialState = {
  auth: 'login', // login | verify | app
  mode: 'light', // light | dark
  accent: 'verde',
  device: 'mobile', // mobile | desktop
  route: 'dashboard', // pantalla activa (móvil)
  history: [], // pila para back
  deskRoute: 'dashboard', // pantalla activa (desktop)
  sheet: null, // null | 'registro' | 'notif'
  toast: null,
  cajas: CAJAS_SEED,
  movs: MOVS_SEED,
  chats: CHATS_SEED,
  activeChat: 'wa', // sesión abierta
  chatTone: 'Neutro', // Neutro | Cercano | Formal
  chatDrawer: false, // drawer de sesiones (móvil)
  deskSide: true, // sidebar principal expandido (desktop)
  railOpen: true, // rail de conversaciones visible
  railFloat: false, // rail flota (overlap) sobre el hilo
  seq: 100,
  chatSeq: 10,
  msgSeq: 100,
};

function reducer(s, a) {
  switch (a.type) {
    case 'AUTH':
      return { ...s, auth: a.v };
    case 'MODE':
      return { ...s, mode: a.v };
    case 'ACCENT':
      return { ...s, accent: a.v };
    case 'DEVICE':
      return { ...s, device: a.v };
    case 'GO_TAB':
      return { ...s, route: a.v, history: [] };
    case 'NAV':
      return { ...s, route: a.v, history: [...s.history, s.route] };
    case 'BACK': {
      if (!s.history.length) return s;
      const h = [...s.history];
      const prev = h.pop();
      return { ...s, route: prev, history: h };
    }
    case 'DESK_NAV':
      return { ...s, deskRoute: a.v };
    case 'SHEET':
      return { ...s, sheet: a.v };
    case 'TOAST':
      return { ...s, toast: a.v };
    case 'CHAT_TONE':
      return { ...s, chatTone: a.v };
    case 'CHAT_DRAWER':
      return { ...s, chatDrawer: a.v };
    case 'TOGGLE_SIDE':
      return { ...s, deskSide: !s.deskSide };
    case 'TOGGLE_RAIL':
      return { ...s, railOpen: !s.railOpen };
    case 'SET_RAIL':
      return { ...s, railOpen: a.v };
    case 'TOGGLE_RAIL_FLOAT':
      return { ...s, railFloat: !s.railFloat };
    case 'SELECT_CHAT':
      return { ...s, activeChat: a.id, chatDrawer: false };
    case 'NEW_CHAT': {
      const id = 'c' + (s.chatSeq + 1);
      const chat = {
        id,
        titulo: 'Nueva conversación',
        canal: 'web',
        grupo: 'Hoy',
        resumen: '',
        updatedAt: 'Ahora',
        nueva: true,
        mensajes: [],
      };
      return {
        ...s,
        chats: [s.chats[0], chat, ...s.chats.slice(1)],
        activeChat: id,
        chatSeq: s.chatSeq + 1,
        chatDrawer: false,
      };
    }
    case 'RENAME_CHAT':
      return { ...s, chats: s.chats.map((c) => (c.id === a.id ? { ...c, titulo: a.titulo } : c)) };
    case 'PIN_CHAT':
      return { ...s, chats: s.chats.map((c) => (c.id === a.id ? { ...c, fijado: !c.fijado } : c)) };
    case 'DELETE_CHAT': {
      const chats = s.chats.filter((c) => c.id !== a.id || c.sistema);
      const active = s.activeChat === a.id ? 'wa' : s.activeChat;
      return { ...s, chats, activeChat: active };
    }
    case 'APPEND_MSG': {
      const mid = s.msgSeq + 1;
      const msg = { id: mid, ...a.msg };
      const chats = s.chats.map((c) => {
        if (c.id !== a.id) return c;
        const autoTitle = c.nueva && a.msg.from === 'user' ? a.msg.text.slice(0, 32) : c.titulo;
        return {
          ...c,
          mensajes: [...c.mensajes, msg],
          titulo: autoTitle,
          nueva: false,
          updatedAt: 'Ahora',
          resumen: a.msg.text ? a.msg.text.slice(0, 40) : c.resumen,
        };
      });
      return { ...s, chats, msgSeq: mid };
    }
    case 'SET_PCT': {
      const cajas = s.cajas.map((c) =>
        c.id === a.id ? { ...c, pct: Math.max(0, Math.min(100, c.pct + a.delta)) } : c,
      );
      return { ...s, cajas };
    }
    case 'ADD_MOV': {
      const id = s.seq + 1;
      const mov = { id, dia: 'Hoy', fecha: 'Hoy · ahora', origen: a.mov.origen || 'pwa', ...a.mov };
      let cajas = s.cajas;
      if (mov.tipo === 'gasto' && mov.caja) {
        cajas = s.cajas.map((c) =>
          c.id === mov.caja
            ? { ...c, gastado: Math.round((c.gastado + mov.monto) * 100) / 100 }
            : c,
        );
      }
      return { ...s, movs: [mov, ...s.movs], cajas, seq: id, toast: a.toast || null };
    }
    case 'ANULAR': {
      const movs = s.movs.map((m) => (m.id === a.id ? { ...m, anulado: true } : m));
      const target = s.movs.find((m) => m.id === a.id);
      let cajas = s.cajas;
      if (target && target.tipo === 'gasto' && target.caja && !target.anulado) {
        cajas = s.cajas.map((c) =>
          c.id === target.caja
            ? { ...c, gastado: Math.round((c.gastado - target.monto) * 100) / 100 }
            : c,
        );
      }
      return { ...s, movs, cajas, toast: 'Movimiento anulado' };
    }
    default:
      return s;
  }
}

const StoreCtx = React.createContext(null);
const useStore = () => React.useContext(StoreCtx);
// helpers derivados
const gastoCajas = (cajas) => cajas.filter((c) => c.tipo === 'gasto');
const disponible = (cajas) => gastoCajas(cajas).reduce((sum, c) => sum + saldoDe(c), 0);

// ── Iconos (trazo, currentColor) ───────────────────────────────
const ICONS = {
  home: 'M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1v-9z',
  chat: 'M21 12a8 8 0 01-8 8H4l1.7-3.4A8 8 0 1121 12z',
  list: 'M5 4h14v17l-2.4-1.6L14.2 21l-2.2-1.6L9.8 21l-2.4-1.6L5 21V4z M9 9h6 M9 13h4',
  chart: 'M4 20V10 M10 20V4 M16 20v-8 M22 20H2',
  gear: 'M12 9a3 3 0 100 6 3 3 0 000-6z M19 12a7 7 0 01-.1 1.2l2 1.6-2 3.4-2.4-1a7 7 0 01-2 1.2L14 21h-4l-.5-2.6a7 7 0 01-2-1.2l-2.4 1-2-3.4 2-1.6A7 7 0 015 12c0-.4 0-.8.1-1.2l-2-1.6 2-3.4 2.4 1a7 7 0 012-1.2L10 3h4l.5 2.6a7 7 0 012 1.2l2.4-1 2 3.4-2 1.6c.1.4.1.8.1 1.2z',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  mic: 'M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3z M6 11a6 6 0 0012 0 M12 17v4',
  send: 'M4 12l16-7-5 16-3.5-6L4 12z',
  arrUp: 'M12 19V5 M6 11l6-6 6 6',
  arrDown: 'M12 5v14 M6 13l6 6 6-6',
  swap: 'M7 4v12 M3 8l4-4 4 4 M17 20V8 M13 16l4 4 4-4',
  check: 'M4 12.5l5 5L20 6.5',
  chevR: 'M9 5l7 7-7 7',
  chevL: 'M15 5l-7 7 7 7',
  chevD: 'M6 9l6 6 6-6',
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
  moon: 'M20 14a8 8 0 11-9-11 7 7 0 009 11z',
  sun: 'M12 6V3 M12 21v-3 M6 12H3 M21 12h-3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2 M12 8a4 4 0 100 8 4 4 0 000-8z',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
  undo: 'M9 7L4 12l5 5 M4 12h11a5 5 0 010 10h-2',
  grip: 'M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01',
  moon2: 'M20 14a8 8 0 11-9-11 7 7 0 009 11z',
  sparkle: 'M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z',
  wallet: 'M3 7h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z M3 7l2-3h11l2 3 M17 13h2',
  clock: 'M12 7v5l3 2 M12 3a9 9 0 100 18 9 9 0 000-18z',
  receipt: 'M6 3h12v18l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21V3z M9 8h6 M9 12h6',
  shield: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z M9 12l2 2 4-4',
  pin: 'M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5z M12 13v8',
  dots: 'M5 12h.01 M12 12h.01 M19 12h.01',
  archive: 'M4 7h16v3H4V7z M5 10v10h14V10 M10 14h4',
  clip: 'M18 8l-7.5 7.5a3 3 0 01-4.2-4.2l8-8a4.5 4.5 0 016.4 6.4l-8 8',
  penNew:
    'M12 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-6 M18.5 2.5a2.1 2.1 0 013 3L13 14l-4 1 1-4 8.5-8.5z',
  back: 'M19 12H5 M11 18l-6-6 6-6',
  sidebar: 'M4 5h16v14H4V5z M9 5v14',
  expand: 'M4 5h16v14H4V5z M14 5v14',
  dblL: 'M11 5l-7 7 7 7 M18 5l-7 7 7 7',
  dblR: 'M13 5l7 7-7 7 M6 5l7 7-7 7',
};

Object.assign(window, {
  ACCENTS,
  NEUTRAL,
  applyTheme,
  CAJA_COLORS,
  cajaColor,
  alpha,
  INGRESOS_PERSONAL,
  CAJAS_SEED,
  MOVS_SEED,
  CHATS_SEED,
  asignadoDe,
  saldoDe,
  fmt,
  initialState,
  reducer,
  StoreCtx,
  useStore,
  gastoCajas,
  disponible,
  ICONS,
});
