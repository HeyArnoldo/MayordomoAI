// MayordomoAI — tarjeta de marca: wordmark, paleta, tipografía y colores por caja

function Swatch({ c, name, sub, border }) {
  const t = useT();
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          height: 44,
          borderRadius: 10,
          background: c,
          border: `1px solid ${border ? t.borderStrong : 'transparent'}`,
        }}
      ></div>
      <div
        style={{ fontFamily: FONT_UI, fontWeight: 650, fontSize: 11, color: t.text, marginTop: 6 }}
      >
        {name}
      </div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9.5,
          color: t.textTer,
          marginTop: 1,
          textTransform: 'uppercase',
        }}
      >
        {sub || c}
      </div>
    </div>
  );
}

function BrandCard() {
  const t = useT();
  return (
    <div
      data-screen-label="Marca"
      style={{
        width: '100%',
        height: '100%',
        background: t.bg,
        padding: 28,
        boxSizing: 'border-box',
        fontFamily: FONT_UI,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        borderRadius: 16,
      }}
    >
      <div style={{ display: 'flex', gap: 18 }}>
        {/* wordmark */}
        <div
          style={{
            flex: 1.25,
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: t.r,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <SecLabel>Wordmark</SecLabel>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}
          >
            <Mark size={56} />
            <div
              style={{
                fontFamily: FONT_UI,
                fontWeight: 700,
                fontSize: 34,
                letterSpacing: '-0.03em',
                color: t.text,
                lineHeight: 1,
              }}
            >
              Mayordomo<span style={{ color: t.accent }}>AI</span>
            </div>
            <div style={{ fontFamily: FONT_UI, fontSize: 12.5, color: t.textSec, lineHeight: 1.5 }}>
              La marca es un sobre doblado: tu dinero repartido en cajas, entregado con cortesía.
              Funciona como app icon, favicon y avatar del bot en WhatsApp.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Wordmark size={14} mark={20} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: t.textTer }}>
              VERSIÓN COMPACTA / NAV
            </span>
          </div>
        </div>
        {/* tipografía */}
        <div
          style={{
            flex: 1,
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: t.r,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <SecLabel>Tipografía</SecLabel>
          <div>
            <div
              style={{
                fontFamily: FONT_UI,
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: '-0.03em',
                color: t.text,
              }}
            >
              Hanken Grotesk
            </div>
            <div style={{ fontFamily: FONT_UI, fontSize: 12, color: t.textSec, marginTop: 3 }}>
              UI, títulos y cuerpo · 400–700
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 14 }}>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontWeight: 600,
                fontSize: 20,
                color: t.text,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              S/ 1,035.64
            </div>
            <div style={{ fontFamily: FONT_UI, fontSize: 12, color: t.textSec, marginTop: 3 }}>
              IBM Plex Mono · montos y etiquetas técnicas, números tabulares (las cifras siempre
              alinean)
            </div>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
            <Badge color={t.accent}>claridad bancaria</Badge>
            <Badge color={t.textSec}>es-PE · S/ PEN</Badge>
          </div>
        </div>
      </div>
      {/* paleta */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: t.r,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <SecLabel>Paleta — verde dinero</SecLabel>
          <span style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textTer }}>
            modo {t.mode === 'dark' ? 'oscuro' : 'claro'} · cambia con el toggle
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
          <Swatch c={t.bg} name="Fondo" border />
          <Swatch c={t.surface} name="Superficie" border />
          <Swatch c={t.text} name="Tinta" />
          <Swatch c={t.textSec} name="Tinta 2" />
          <Swatch c={t.accent} name="Acento" />
          <Swatch c={t.danger} name="Sobregiro" />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 20,
          }}
        >
          <SecLabel>Color por caja</SecLabel>
          <span style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textTer }}>
            croma homogéneo, varía el tono — cada sobre es reconocible de un vistazo
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
          {['ahorro', 'varios', 'pasajes', 'ocio', 'diezmo', 'snacks', 'ofrenda', 'empresa'].map(
            (id) => (
              <Swatch
                key={id}
                c={cajaColor(id, t)}
                name={
                  id === 'empresa' ? 'Empresa' : (CAJAS.find((c) => c.id === id) || {}).nombre || id
                }
                sub={cajaColor(id, t)}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BrandCard, Swatch });
