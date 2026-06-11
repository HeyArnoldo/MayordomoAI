// MayordomoAI — Dashboard desktop (PWA en navegador)

function SideNavItem({ icon, label, active, badge }) {
  const t = useT();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        height: 40,
        padding: '0 12px',
        borderRadius: 10,
        cursor: 'pointer',
        background: active ? t.accentSoft : 'transparent',
        color: active ? (t.mode === 'dark' ? t.accent : t.accentDeep) : t.textSec,
      }}
    >
      <Ic
        d={icon}
        size={18}
        color={active ? (t.mode === 'dark' ? t.accent : t.accentDeep) : t.textSec}
        sw={active ? 2 : 1.8}
      />
      <span
        style={{ fontFamily: FONT_UI, fontWeight: active ? 650 : 550, fontSize: 13.5, flex: 1 }}
      >
        {label}
      </span>
      {badge && (
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            fontWeight: 600,
            background: t.accent,
            color: t.onAccent,
            borderRadius: 99,
            padding: '2px 7px',
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function DesktopDashboard() {
  const t = useT();
  const gastoCajas = CAJAS.filter((c) => c.tipo === 'gasto');
  const ahorro = CAJAS.find((c) => c.id === 'ahorro');
  const totalAsignado = gastoCajas.reduce((s, c) => s + c.asignado, 0);
  const totalGastado = gastoCajas.reduce((s, c) => s + c.gastado, 0);
  return (
    <ChromeWindow width={1360} height={860} url="mayordomoai.xyz">
      <div
        data-screen-label="Dashboard desktop"
        style={{
          display: 'flex',
          height: '100%',
          background: t.bg,
          fontFamily: FONT_UI,
          overflow: 'hidden',
        }}
      >
        {/* ── sidebar ── */}
        <div
          style={{
            width: 228,
            flexShrink: 0,
            borderRight: `1px solid ${t.border}`,
            background: t.surface,
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 14px 16px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ padding: '0 6px' }}>
            <Wordmark size={16.5} mark={26} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 26 }}>
            <SideNavItem icon={ICONS.home} label="Inicio" active />
            <SideNavItem icon={ICONS.list} label="Movimientos" />
            <SideNavItem icon={ICONS.chat} label="Conversaciones" badge="2" />
            <SideNavItem icon={ICONS.chart} label="Reportes" />
            <SideNavItem icon={ICONS.gear} label="Cajas y reparto" />
          </div>
          <div style={{ flex: 1 }}></div>
          {/* estado del bot */}
          <div
            style={{
              borderRadius: 12,
              border: `1px solid ${t.border}`,
              background: t.inset,
              padding: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span
                style={{ width: 7, height: 7, borderRadius: 99, background: t.positive }}
              ></span>
              <span style={{ fontFamily: FONT_UI, fontWeight: 650, fontSize: 12, color: t.text }}>
                Bot conectado
              </span>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: t.textTer, marginTop: 4 }}>
              +51 987 654 321 · verificado
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 4px' }}>
            <Avatar size={32} name="J" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: FONT_UI,
                  fontWeight: 650,
                  fontSize: 12.5,
                  color: t.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                João Souza
              </div>
              <div style={{ fontFamily: FONT_UI, fontSize: 10.5, color: t.textTer }}>
                Cuenta activa
              </div>
            </div>
            <Ic d={ICONS.logout} size={15} color={t.textTer} />
          </div>
        </div>
        {/* ── main ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* top bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 28px 0',
              flexShrink: 0,
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: FONT_UI,
                  fontWeight: 700,
                  fontSize: 21,
                  letterSpacing: '-0.025em',
                  color: t.text,
                  margin: 0,
                }}
              >
                Hola, João
              </h1>
              <div style={{ fontFamily: FONT_UI, fontSize: 12.5, color: t.textSec, marginTop: 2 }}>
                Martes 10 de junio · todo al día desde tu último mensaje
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 10,
                  padding: '8px 14px',
                }}
              >
                <Ic d={ICONS.calendar} size={14} color={t.textSec} />
                <span
                  style={{ fontFamily: FONT_UI, fontWeight: 600, fontSize: 12.5, color: t.text }}
                >
                  Junio 2026
                </span>
              </div>
              <Btn icon={<Ic d={ICONS.plus} size={15} color={t.onAccent} sw={2.4} />}>
                Registrar
              </Btn>
            </div>
          </div>
          <div
            style={{ flex: 1, display: 'flex', gap: 16, padding: '16px 28px 22px', minHeight: 0 }}
          >
            {/* columna principal */}
            <div
              style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}
            >
              {/* stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 12 }}>
                <Card pad={16} style={{ position: 'relative', overflow: 'hidden' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      background: `linear-gradient(90deg, ${gastoCajas.map((c) => cajaColor(c.id, t)).join(',')})`,
                    }}
                  ></div>
                  <SecLabel>Disponible este mes</SecLabel>
                  <div style={{ marginTop: 7 }}>
                    <Money v={DISPONIBLE} size={27} weight={650} />
                  </div>
                  <div style={{ marginTop: 9 }}>
                    <ProgressBar
                      pct={(totalGastado / totalAsignado) * 100}
                      color={t.accent}
                      height={6}
                    />
                  </div>
                  <div
                    style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textSec, marginTop: 6 }}
                  >
                    S/{fmt(totalGastado)} usados de S/{fmt(totalAsignado)}
                  </div>
                </Card>
                <Card pad={16}>
                  <SecLabel>Fondo de ahorro</SecLabel>
                  <div style={{ marginTop: 7 }}>
                    <Money
                      v={ahorro.acumulado}
                      size={27}
                      weight={650}
                      color={cajaColor('ahorro', t)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 9 }}>
                    <Ic d={ICONS.arrUp} size={12} color={t.positive} sw={2.4} />
                    <span style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textSec }}>
                      +S/{fmt(ahorro.asignado)} este mes · acumula
                    </span>
                  </div>
                </Card>
                <Card pad={16}>
                  <SecLabel>Ámbito empresa</SecLabel>
                  <div style={{ marginTop: 7 }}>
                    <Money v={1280.4} size={27} weight={650} color={cajaColor('empresa', t)} />
                  </div>
                  <div
                    style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textSec, marginTop: 9 }}
                  >
                    Último: Claude Max −S/372.71
                  </div>
                </Card>
              </div>
              {/* sobres */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 9,
                  }}
                >
                  <SecLabel>Tus cajas · reparto al 100%</SecLabel>
                  <span
                    style={{
                      fontFamily: FONT_UI,
                      fontSize: 12,
                      fontWeight: 600,
                      color: t.accent,
                      cursor: 'pointer',
                    }}
                  >
                    Editar reparto
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 11 }}>
                  {gastoCajas.map((c) => (
                    <EnvelopeCard key={c.id} caja={c} />
                  ))}
                </div>
              </div>
              {/* movimientos */}
              <Card
                pad={0}
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '13px 18px 9px',
                    flexShrink: 0,
                  }}
                >
                  <SecLabel>Movimientos recientes</SecLabel>
                  <span
                    style={{
                      fontFamily: FONT_UI,
                      fontSize: 12,
                      fontWeight: 600,
                      color: t.accent,
                      cursor: 'pointer',
                    }}
                  >
                    Ver historial ›
                  </span>
                </div>
                <div style={{ padding: '0 18px', overflow: 'hidden' }}>
                  {MOVS.slice(0, 3).map((m, i) => (
                    <MovRow key={m.id} mov={m} dense last={i === 2} />
                  ))}
                </div>
              </Card>
            </div>
            {/* panel del asistente */}
            <Card
              pad={0}
              style={{
                width: 330,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '13px 16px',
                  borderBottom: `1px solid ${t.border}`,
                  flexShrink: 0,
                }}
              >
                <Mark size={30} />
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontFamily: FONT_UI, fontWeight: 700, fontSize: 13.5, color: t.text }}
                  >
                    Asistente
                  </div>
                  <div style={{ fontFamily: FONT_UI, fontSize: 11, color: t.textSec }}>
                    Mismo hilo que WhatsApp
                  </div>
                </div>
                <CanalBadge canal="web" />
              </div>
              <div
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  padding: '14px 14px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  background: t.bg,
                }}
              >
                <Bubble from="user" canal="whatsapp" time="1:15 p. m.">
                  me gasté como 30 lucas en el almuerzo
                </Bubble>
                <Bubble from="bot">
                  Listo, <b>S/30 en Ocio</b> ✓
                  <MovConfirmCard cajaId="ocio" monto={30} restante={34.34} />
                </Bubble>
                <Bubble from="user" canal="web" time="Ahora">
                  ¿cuál fue mi gasto más fuerte de ayer?
                </Bubble>
                <Bubble from="bot">
                  Ayer tu mayor gasto fue <b>S/372.71</b> en Empresa (Claude Max).
                </Bubble>
              </div>
              <div
                style={{
                  padding: '10px 12px 12px',
                  borderTop: `1px solid ${t.border}`,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 99,
                    background: t.bg,
                    border: `1px solid ${t.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{ fontFamily: FONT_UI, fontSize: 12.5, color: t.textTer }}>
                    Pregúntale a tu mayordomo…
                  </span>
                </div>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 99,
                    background: t.accentSoft,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Ic d={ICONS.mic} size={16} color={t.mode === 'dark' ? t.accent : t.accentDeep} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </ChromeWindow>
  );
}

Object.assign(window, { SideNavItem, DesktopDashboard });
