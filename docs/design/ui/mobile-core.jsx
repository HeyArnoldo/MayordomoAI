// MayordomoAI — shell del teléfono + Login + Vincular WhatsApp + Dashboard
// Usa tokens/componentes de ui/tokens.jsx (window globals).

// ── Shell de app dentro del iPhone ─────────────────────────────
function PhoneShell({ children, tab, header = true, screenLabel }) {
  const t = useT();
  return (
    <IOSDevice dark={t.mode === 'dark'} width={402} height={874}>
      <div
        data-screen-label={screenLabel}
        style={{
          position: 'absolute',
          inset: 0,
          background: t.bg,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONT_UI,
        }}
      >
        <div style={{ height: 62, flexShrink: 0 }}></div>
        {header && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 20px 10px',
              flexShrink: 0,
            }}
          >
            <Wordmark size={17} mark={26} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                <Ic d={ICONS.bell} size={17} color={t.textSec} />
              </div>
              <Avatar size={36} name="J" />
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        {tab !== undefined && <TabBar active={tab} />}
      </div>
    </IOSDevice>
  );
}

function TabBar({ active }) {
  const t = useT();
  const tabs = [
    { id: 'inicio', label: 'Inicio', icon: ICONS.home },
    { id: 'movs', label: 'Movs', icon: ICONS.list },
    { id: 'plus' },
    { id: 'chat', label: 'Chat', icon: ICONS.chat },
    { id: 'cajas', label: 'Cajas', icon: ICONS.gear },
  ];
  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        padding: '10px 12px 28px',
        background: t.surface,
        borderTop: `1px solid ${t.border}`,
      }}
    >
      {tabs.map((tb) =>
        tb.id === 'plus' ? (
          <div
            key="plus"
            style={{
              width: 50,
              height: 50,
              borderRadius: 18,
              background: t.accent,
              marginTop: -2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 6px 16px ${t.accent}55`,
            }}
          >
            <Ic d={ICONS.plus} size={22} color={t.onAccent} sw={2.4} />
          </div>
        ) : (
          <div
            key={tb.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              width: 56,
              paddingTop: 4,
            }}
          >
            <Ic
              d={tb.icon}
              size={21}
              color={active === tb.id ? t.accent : t.textTer}
              sw={active === tb.id ? 2.1 : 1.8}
            />
            <span
              style={{
                fontFamily: FONT_UI,
                fontSize: 10.5,
                fontWeight: 600,
                color: active === tb.id ? t.accent : t.textTer,
              }}
            >
              {tb.label}
            </span>
          </div>
        ),
      )}
    </div>
  );
}

// ── 01 · Login (Google OAuth + allowlist) ──────────────────────
function LoginScreen() {
  const t = useT();
  return (
    <PhoneShell header={false} screenLabel="Login">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 28px 44px' }}>
        <div style={{ flex: 1.1 }}></div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <Mark size={72} />
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: FONT_UI,
                fontWeight: 700,
                fontSize: 28,
                letterSpacing: '-0.03em',
                color: t.text,
              }}
            >
              Mayordomo<span style={{ color: t.accent }}>AI</span>
            </div>
            <div
              style={{
                fontFamily: FONT_UI,
                fontSize: 15,
                color: t.textSec,
                marginTop: 8,
                lineHeight: 1.5,
                maxWidth: 270,
              }}
            >
              Tu dinero en mini-cajas, administrado conversando por WhatsApp.
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}></div>
        {/* mini-preview de la metáfora */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 36 }}>
          {['ahorro', 'pasajes', 'ocio', 'diezmo'].map((id) => (
            <div
              key={id}
              style={{
                width: 54,
                height: 40,
                borderRadius: 10,
                position: 'relative',
                overflow: 'hidden',
                background: cajaColor(id, t) + (t.mode === 'dark' ? '26' : '17'),
                border: `1px solid ${t.border}`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  clipPath: 'polygon(0 0, 100% 0, 100% 20%, 50% 78%, 0 20%)',
                  background: cajaColor(id, t) + '44',
                }}
              ></div>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2.5,
                  background: cajaColor(id, t),
                }}
              ></div>
            </div>
          ))}
        </div>
        <Btn size="lg" kind="secondary" style={{ width: '100%', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M21.6 12.2c0-.7-.06-1.4-.18-2H12v3.9h5.4a4.6 4.6 0 01-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z"
              fill="#4285F4"
            />
            <path
              d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0012 22z"
              fill="#34A853"
            />
            <path d="M6.4 14a6 6 0 010-3.9V7.5H3.1a10 10 0 000 9l3.3-2.6z" fill="#FBBC05" />
            <path
              d="M12 6c1.5 0 2.8.5 3.8 1.5L18.7 4.6A10 10 0 003.1 7.5L6.4 10c.8-2.3 3-4 5.6-4z"
              fill="#EA4335"
            />
          </svg>
          Continuar con Google
        </Btn>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            marginTop: 18,
          }}
        >
          <Ic d={ICONS.check} size={13} color={t.textTer} sw={2.2} />
          <span style={{ fontFamily: FONT_UI, fontSize: 12, color: t.textTer }}>
            Acceso con lista de espera — tu cuenta se activa por invitación
          </span>
        </div>
      </div>
    </PhoneShell>
  );
}

// ── 02 · Vincular y verificar número de WhatsApp ───────────────
function VerifyScreen() {
  const t = useT();
  const digits = ['4', '8', '2', '', '', ''];
  return (
    <PhoneShell header={false} screenLabel="Vincular WhatsApp">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 24px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 4 }}>
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
            <Ic d={ICONS.chevL} size={16} color={t.textSec} />
          </div>
          <SecLabel>Paso 2 de 2</SecLabel>
        </div>
        {/* progreso */}
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 99, background: t.accent }}></div>
          <div style={{ flex: 1, height: 4, borderRadius: 99, background: t.accent }}></div>
        </div>
        <h1
          style={{
            fontFamily: FONT_UI,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: '-0.03em',
            color: t.text,
            margin: '28px 0 10px',
          }}
        >
          Verifica tu número
        </h1>
        <p
          style={{
            fontFamily: FONT_UI,
            fontSize: 14.5,
            color: t.textSec,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          Te enviamos un código de 6 dígitos por WhatsApp al número que registraste. Así nadie puede
          reclamar un número ajeno.
        </p>
        <Card style={{ marginTop: 24 }} pad={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 13,
                background: t.accentSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ic d={ICONS.phone} size={19} color={t.accent} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_MONO, fontWeight: 600, fontSize: 15, color: t.text }}>
                +51 987 654 321
              </div>
              <div style={{ fontFamily: FONT_UI, fontSize: 12, color: t.textTer, marginTop: 1 }}>
                Número desde el que escribirás al bot
              </div>
            </div>
            <span style={{ fontFamily: FONT_UI, fontSize: 12.5, fontWeight: 600, color: t.accent }}>
              Cambiar
            </span>
          </div>
        </Card>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'center', marginTop: 30 }}>
          {digits.map((d, i) => (
            <div
              key={i}
              style={{
                width: 46,
                height: 56,
                borderRadius: 14,
                boxSizing: 'border-box',
                background: t.surface,
                border: `1.5px solid ${i === 3 ? t.accent : t.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: FONT_MONO,
                fontWeight: 600,
                fontSize: 22,
                color: t.text,
                boxShadow: i === 3 ? `0 0 0 3px ${t.accent}33` : 'none',
              }}
            >
              {d}
              {i === 3 && (
                <span
                  style={{ width: 1.5, height: 24, background: t.accent, marginLeft: 1 }}
                ></span>
              )}
            </div>
          ))}
        </div>
        <div
          style={{
            textAlign: 'center',
            marginTop: 18,
            fontFamily: FONT_UI,
            fontSize: 13,
            color: t.textSec,
          }}
        >
          ¿No te llegó? <span style={{ color: t.accent, fontWeight: 600 }}>Reenviar código</span>{' '}
          <span style={{ color: t.textTer }}>(0:42)</span>
        </div>
        <div style={{ flex: 1 }}></div>
        <Btn size="lg" style={{ width: '100%', opacity: 0.5 }}>
          Verificar y vincular
        </Btn>
        <div
          style={{
            textAlign: 'center',
            marginTop: 14,
            fontFamily: FONT_UI,
            fontSize: 12,
            color: t.textTer,
          }}
        >
          Un número solo puede pertenecer a una cuenta.
        </div>
      </div>
    </PhoneShell>
  );
}

// ── 03 · Dashboard de cajas ────────────────────────────────────
function DashboardScreen() {
  const t = useT();
  const gastoCajas = CAJAS.filter((c) => c.tipo === 'gasto');
  const ahorro = CAJAS.find((c) => c.id === 'ahorro');
  const totalAsignado = gastoCajas.reduce((s, c) => s + c.asignado, 0);
  const totalGastado = gastoCajas.reduce((s, c) => s + c.gastado, 0);
  return (
    <PhoneShell tab="inicio" screenLabel="Dashboard de cajas">
      <div
        style={{
          flex: 1,
          padding: '2px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflow: 'hidden',
        }}
      >
        {/* hero: disponible */}
        <Card pad={14} style={{ position: 'relative', overflow: 'hidden' }}>
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
          <div
            style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            <div>
              <SecLabel>Disponible · Junio 2026</SecLabel>
              <div style={{ marginTop: 5 }}>
                <Money v={DISPONIBLE} size={30} weight={650} />
              </div>
              <div style={{ fontFamily: FONT_UI, fontSize: 12.5, color: t.textSec, marginTop: 4 }}>
                Gastaste{' '}
                <span style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>
                  S/{fmt(totalGastado)}
                </span>{' '}
                de S/{fmt(totalAsignado)} asignado
              </div>
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}
            >
              <Badge color={t.accent}>Personal</Badge>
              <span style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textTer }}>
                Empresa ›
              </span>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <ProgressBar pct={(totalGastado / totalAsignado) * 100} color={t.accent} height={7} />
          </div>
        </Card>
        {/* fondo de ahorro destacado */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 7,
            }}
          >
            <SecLabel>Tus cajas</SecLabel>
            <span style={{ fontFamily: FONT_UI, fontSize: 12, fontWeight: 600, color: t.accent }}>
              Editar %
            </span>
          </div>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: cajaColor('ahorro', t),
                }}
              ></div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: cajaColor('ahorro', t) + (t.mode === 'dark' ? '26' : '17'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ic d={ICONS.arrUp} size={17} color={cajaColor('ahorro', t)} sw={2.2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT_UI, fontWeight: 650, fontSize: 14, color: t.text }}>
                  Ahorro{' '}
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10.5,
                      fontWeight: 500,
                      color: t.textTer,
                      marginLeft: 3,
                    }}
                  >
                    FONDO · 25%
                  </span>
                </div>
                <div
                  style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textSec, marginTop: 1 }}
                >
                  Acumula +S/{fmt(ahorro.asignado)} este mes
                </div>
              </div>
              <Money v={ahorro.acumulado} size={18} weight={650} color={cajaColor('ahorro', t)} />
            </div>
          </Card>
        </div>
        {/* grid de sobres */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {gastoCajas.map((c) => (
            <EnvelopeCard key={c.id} caja={c} compact />
          ))}
        </div>
        {/* últimos movimientos */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 2,
            }}
          >
            <SecLabel>Recientes</SecLabel>
            <span style={{ fontFamily: FONT_UI, fontSize: 12, fontWeight: 600, color: t.accent }}>
              Ver todo ›
            </span>
          </div>
          <MovRow mov={MOVS[0]} dense last />
        </div>
      </div>
    </PhoneShell>
  );
}

Object.assign(window, { PhoneShell, TabBar, LoginScreen, VerifyScreen, DashboardScreen });
