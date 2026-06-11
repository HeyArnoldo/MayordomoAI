// MayordomoAI — Registro manual + Configuración de cajas + Reportes

// ── 06 · Registro manual (sheet) ───────────────────────────────
function RegistroScreen() {
  const t = useT();
  const [tipo, setTipo] = React.useState('Gasto');
  const [cajaSel, setCajaSel] = React.useState('pasajes');
  const tipos = ['Gasto', 'Ingreso', 'Tránsito'];
  const gastoCajas = CAJAS.filter((c) => c.tipo === 'gasto');
  return (
    <PhoneShell header={false} screenLabel="Registro manual">
      {/* fondo dashboard atenuado + sheet */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          background: t.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(22,33,26,0.32)',
        }}
      >
        <div
          style={{
            background: t.bg,
            borderRadius: `${t.r + 8}px ${t.r + 8}px 0 0`,
            padding: '10px 22px 38px',
            boxShadow: t.shadowLg,
          }}
        >
          <div
            style={{
              width: 40,
              height: 4.5,
              borderRadius: 99,
              background: t.borderStrong,
              margin: '0 auto 16px',
            }}
          ></div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontFamily: FONT_UI,
                fontWeight: 700,
                fontSize: 19,
                letterSpacing: '-0.02em',
                color: t.text,
                margin: 0,
              }}
            >
              Registrar movimiento
            </h2>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 99,
                background: t.surfaceAlt,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ic d={ICONS.x} size={14} color={t.textSec} sw={2.2} />
            </div>
          </div>
          {/* tipo segmentado */}
          <div
            style={{
              display: 'flex',
              background: t.surfaceAlt,
              borderRadius: 12,
              padding: 4,
              gap: 4,
            }}
          >
            {tipos.map((tp) => (
              <div
                key={tp}
                onClick={() => setTipo(tp)}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 9,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: FONT_UI,
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  background: tipo === tp ? t.surface : 'transparent',
                  color: tipo === tp ? t.text : t.textSec,
                  boxShadow: tipo === tp ? t.shadow : 'none',
                  border: tipo === tp ? `1px solid ${t.border}` : '1px solid transparent',
                  boxSizing: 'border-box',
                }}
              >
                {tp}
              </div>
            ))}
          </div>
          {/* monto */}
          <div style={{ textAlign: 'center', padding: '26px 0 20px' }}>
            <SecLabel>Monto</SecLabel>
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span
                style={{ fontFamily: FONT_MONO, fontSize: 22, color: t.textTer, fontWeight: 500 }}
              >
                S/
              </span>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 46,
                  fontWeight: 600,
                  color: t.text,
                  letterSpacing: '-0.03em',
                }}
              >
                24<span style={{ color: t.textTer }}>.50</span>
              </span>
              <span
                style={{
                  width: 2,
                  height: 38,
                  background: t.accent,
                  borderRadius: 99,
                  alignSelf: 'center',
                }}
              ></span>
            </div>
          </div>
          {/* caja */}
          <SecLabel style={{ marginBottom: 9 }}>Caja</SecLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {gastoCajas.map((c) => {
              const col = cajaColor(c.id, t);
              const sel = cajaSel === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setCajaSel(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '8px 13px',
                    borderRadius: 99,
                    cursor: 'pointer',
                    background: sel ? col + (t.mode === 'dark' ? '30' : '1C') : t.surface,
                    border: `1.5px solid ${sel ? col : t.border}`,
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: col }}></span>
                  <span
                    style={{
                      fontFamily: FONT_UI,
                      fontWeight: 600,
                      fontSize: 13,
                      color: sel ? t.text : t.textSec,
                    }}
                  >
                    {c.nombre}
                  </span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: t.textTer }}>
                    S/{fmt(saldo(c))}
                  </span>
                </div>
              );
            })}
          </div>
          {/* nota + adjuntos */}
          <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
            <div
              style={{
                flex: 1,
                height: 46,
                borderRadius: 13,
                background: t.surface,
                border: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ fontFamily: FONT_UI, fontSize: 13.5, color: t.textTer }}>
                Nota (opcional)
              </span>
            </div>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                background: t.surface,
                border: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ic d={ICONS.camera} size={19} color={t.textSec} />
            </div>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                background: t.surface,
                border: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ic d={ICONS.calendar} size={18} color={t.textSec} />
            </div>
          </div>
          <Btn size="lg" style={{ width: '100%', marginTop: 18 }}>
            Registrar gasto · <span style={{ fontFamily: FONT_MONO }}>S/24.50</span>
          </Btn>
          <div
            style={{
              textAlign: 'center',
              marginTop: 12,
              fontFamily: FONT_UI,
              fontSize: 12,
              color: t.textTer,
            }}
          >
            Quedarían{' '}
            <span style={{ fontFamily: FONT_MONO, fontWeight: 600, color: t.textSec }}>
              S/79.00
            </span>{' '}
            en Pasajes
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}

// ── 07 · Configuración de cajas y % ────────────────────────────
function CajasConfigScreen() {
  const t = useT();
  const total = CAJAS.reduce((s, c) => s + c.pct, 0);
  const ok = total === 100;
  return (
    <PhoneShell tab="cajas" header={false} screenLabel="Configuración de cajas">
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
            Cajas y reparto
          </h1>
          <Btn
            kind="soft"
            size="sm"
            icon={
              <Ic
                d={ICONS.plus}
                size={14}
                color={t.mode === 'dark' ? t.accent : t.accentDeep}
                sw={2.4}
              />
            }
          >
            Nueva
          </Btn>
        </div>
        {/* validación de suma */}
        <Card pad={13} style={{ marginTop: 14, borderColor: ok ? t.accent + '55' : t.danger }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: ok ? t.accentSoft : t.dangerSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ic
                d={ok ? ICONS.check : ICONS.x}
                size={15}
                color={ok ? t.accent : t.danger}
                sw={2.4}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_UI, fontWeight: 650, fontSize: 13.5, color: t.text }}>
                Los porcentajes suman{' '}
                <span style={{ fontFamily: FONT_MONO, color: ok ? t.accent : t.danger }}>
                  {total}%
                </span>
              </div>
              <div style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textSec, marginTop: 1 }}>
                Cada ingreso se reparte automáticamente
              </div>
            </div>
          </div>
          {/* barra apilada del reparto */}
          <div
            style={{
              display: 'flex',
              height: 8,
              borderRadius: 99,
              overflow: 'hidden',
              marginTop: 11,
              gap: 2,
            }}
          >
            {CAJAS.map((c) => (
              <div key={c.id} style={{ width: c.pct + '%', background: cajaColor(c.id, t) }}></div>
            ))}
          </div>
        </Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '16px 0 6px',
          }}
        >
          <SecLabel>7 cajas activas</SecLabel>
          <span style={{ fontFamily: FONT_UI, fontSize: 12, fontWeight: 600, color: t.accent }}>
            Los cambios aplican a ingresos futuros
          </span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 20px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {CAJAS.map((c) => {
          const col = cajaColor(c.id, t);
          return (
            <Card key={c.id} pad={0}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px' }}>
                {/* grip */}
                <svg width="8" height="14" viewBox="0 0 8 14" style={{ flexShrink: 0 }}>
                  {[0, 6].map((x) =>
                    [0, 5, 10].map((y) => (
                      <circle key={x + '-' + y} cx={x + 1} cy={y + 2} r="1.4" fill={t.textTer} />
                    )),
                  )}
                </svg>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3.5,
                    background: col,
                    flexShrink: 0,
                  }}
                ></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{ fontFamily: FONT_UI, fontWeight: 650, fontSize: 14, color: t.text }}
                  >
                    {c.nombre}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <Badge color={c.tipo === 'fondo' ? col : t.textTer}>
                      {c.tipo === 'fondo' ? 'fondo · acumula' : 'gasto · reinicia'}
                    </Badge>
                    <span style={{ fontFamily: FONT_UI, fontSize: 11, color: t.textTer }}>
                      personal
                    </span>
                  </div>
                </div>
                {/* stepper de % */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0,
                    background: t.inset,
                    border: `1px solid ${t.border}`,
                    borderRadius: 11,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 34,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: t.textSec,
                      fontSize: 16,
                      cursor: 'pointer',
                    }}
                  >
                    −
                  </div>
                  <div
                    style={{
                      width: 46,
                      textAlign: 'center',
                      fontFamily: FONT_MONO,
                      fontWeight: 600,
                      fontSize: 14,
                      color: t.text,
                      borderLeft: `1px solid ${t.border}`,
                      borderRight: `1px solid ${t.border}`,
                      lineHeight: '34px',
                    }}
                  >
                    {c.pct}%
                  </div>
                  <div
                    style={{
                      width: 30,
                      height: 34,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: t.textSec,
                      fontSize: 16,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 11.5,
            color: t.textTer,
            textAlign: 'center',
            padding: '6px 20px 4px',
            lineHeight: 1.5,
          }}
        >
          El historial no se reescribe: cada ingreso guarda su propio reparto.
        </div>
      </div>
    </PhoneShell>
  );
}

// ── 08 · Reportes ──────────────────────────────────────────────
function ReportesScreen() {
  const t = useT();
  const gastoCajas = CAJAS.filter((c) => c.tipo === 'gasto' && c.gastado > 0).sort(
    (a, b) => b.gastado - a.gastado,
  );
  const max = gastoCajas[0].gastado;
  const semanas = [
    { label: 'S1', v: 320 },
    { label: 'S2', v: 510 },
    { label: 'S3', v: 624 },
    { label: 'S4', v: 290 },
  ];
  const maxSem = Math.max(...semanas.map((s) => s.v));
  return (
    <PhoneShell tab="inicio" header={false} screenLabel="Reportes">
      <div
        style={{
          padding: '6px 20px 0',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
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
          Reportes
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 99,
              padding: '7px 14px',
            }}
          >
            <span style={{ fontFamily: FONT_UI, fontWeight: 600, fontSize: 12.5, color: t.text }}>
              Junio 2026
            </span>
            <Ic
              d={ICONS.chevR}
              size={11}
              color={t.textTer}
              style={{ transform: 'rotate(90deg)' }}
            />
          </div>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 99,
              background: t.surface,
              border: `1px solid ${t.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ic d={ICONS.download} size={15} color={t.textSec} />
          </div>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '14px 20px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* totales del mes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Card pad={14}>
            <SecLabel>Ingresos</SecLabel>
            <div style={{ marginTop: 6 }}>
              <Money v={3200} size={21} weight={650} color={t.positive} sign="+" />
            </div>
            <div style={{ fontFamily: FONT_UI, fontSize: 11, color: t.textTer, marginTop: 3 }}>
              2 ingresos repartidos
            </div>
          </Card>
          <Card pad={14}>
            <SecLabel>Gastos</SecLabel>
            <div style={{ marginTop: 6 }}>
              <Money v={1744.36} size={21} weight={650} sign="−" />
            </div>
            <div style={{ fontFamily: FONT_UI, fontSize: 11, color: t.textTer, marginTop: 3 }}>
              −12% vs. mayo
            </div>
          </Card>
        </div>
        {/* gasto por semana */}
        <Card pad={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <SecLabel>Gasto por semana</SecLabel>
            <span style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textTer }}>
              fecha contable · Lima
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 14,
              height: 110,
              marginTop: 14,
              padding: '0 4px',
            }}
          >
            {semanas.map((s, i) => (
              <div
                key={s.label}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
              >
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: t.textSec }}>{s.v}</span>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 44,
                    height: (s.v / maxSem) * 72,
                    borderRadius: '7px 7px 3px 3px',
                    background: i === 2 ? t.accent : t.accentSoft,
                    border: i === 2 ? 'none' : `1px solid ${t.accent}33`,
                    boxSizing: 'border-box',
                  }}
                ></div>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: t.textTer }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </Card>
        {/* gasto por caja */}
        <Card pad={16}>
          <SecLabel style={{ marginBottom: 13 }}>Gasto por caja</SecLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {gastoCajas.map((c) => {
              const col = cajaColor(c.id, t);
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 62,
                      fontFamily: FONT_UI,
                      fontWeight: 600,
                      fontSize: 12,
                      color: t.textSec,
                      flexShrink: 0,
                    }}
                  >
                    {c.nombre}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 14,
                      borderRadius: 5,
                      background: t.inset,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: (c.gastado / max) * 100 + '%',
                        height: '100%',
                        borderRadius: 5,
                        background: col,
                      }}
                    ></div>
                  </div>
                  <span
                    style={{
                      width: 64,
                      textAlign: 'right',
                      fontFamily: FONT_MONO,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: t.text,
                      flexShrink: 0,
                    }}
                  >
                    {fmt(c.gastado)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
        {/* top gasto */}
        <Card pad={14} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: cajaColor('empresa', t) + (t.mode === 'dark' ? '26' : '17'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ic d={ICONS.chart} size={16} color={cajaColor('empresa', t)} sw={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT_UI, fontWeight: 650, fontSize: 13, color: t.text }}>
              Tu gasto más fuerte
            </div>
            <div style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textSec, marginTop: 1 }}>
              Claude Max · Empresa · Lun 8
            </div>
          </div>
          <Money v={372.71} size={15} weight={650} />
        </Card>
      </div>
    </PhoneShell>
  );
}

Object.assign(window, { RegistroScreen, CajasConfigScreen, ReportesScreen });
