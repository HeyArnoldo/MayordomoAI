// MayordomoAI — Onboarding: Login (Google) → Verificar número → app

function LoginScreen() {
  const { state, dispatch } = useStore();
  const cajitas = ['ahorro', 'pasajes', 'ocio', 'diezmo'];
  return (
    <div className="h-full flex flex-col px-7 pb-11 bg-page">
      <div className="flex-[1.1]" />
      <div className="flex flex-col items-center gap-[18px]">
        <Mark size={72} />
        <div className="text-center">
          <div className="font-bold text-[28px] tracking-[-0.03em] text-ink">
            Mayordomo<span className="text-brand">AI</span>
          </div>
          <div className="text-[15px] text-ink2 mt-2 leading-relaxed max-w-[270px]">
            Tu dinero en mini-cajas, administrado conversando por WhatsApp.
          </div>
        </div>
      </div>
      <div className="flex-1" />
      <div className="flex gap-2 justify-center mb-9">
        {cajitas.map((id) => {
          const c = cajaColor(id, state.mode);
          return (
            <div
              key={id}
              className="w-[54px] h-10 rounded-[10px] relative overflow-hidden border border-line"
              style={{ background: c + (state.mode === 'dark' ? '26' : '17') }}
            >
              <div
                className="absolute inset-0"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 100% 20%, 50% 78%, 0 20%)',
                  background: c + '44',
                }}
              />
              <div className="absolute top-0 left-0 right-0 h-[2.5px]" style={{ background: c }} />
            </div>
          );
        })}
      </div>
      <button
        onClick={() => dispatch({ type: 'AUTH', v: 'verify' })}
        className="h-[50px] w-full rounded-[14px] bg-card text-ink border border-lineStrong font-semibold text-[16px] inline-flex items-center justify-center gap-2.5 active:bg-cardAlt transition"
      >
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
      </button>
      <div className="flex items-center justify-center gap-1.5 mt-[18px]">
        <Icon name="check" size={13} sw={2.2} className="text-ink3" />
        <span className="text-[12px] text-ink3">
          Acceso por invitación — tu cuenta se activa al ser aprobada
        </span>
      </div>
    </div>
  );
}

function VerifyScreen() {
  const { state, dispatch } = useStore();
  const [code, setCode] = React.useState(['', '', '', '', '', '']);
  const refs = React.useRef([]);
  const full = code.every((d) => d !== '');
  const setDigit = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...code];
    next[i] = v;
    setCode(next);
    if (v && i < 5) refs.current[i + 1] && refs.current[i + 1].focus();
  };
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1].focus();
  };
  return (
    <div className="h-full flex flex-col px-6 pb-10 bg-page">
      <div className="flex items-center gap-3 pt-2 pb-1">
        <button
          onClick={() => dispatch({ type: 'AUTH', v: 'login' })}
          className="w-9 h-9 rounded-full bg-card border border-line flex items-center justify-center text-ink2"
        >
          <Icon name="chevL" size={16} />
        </button>
        <SecLabel>Paso 2 de 2</SecLabel>
      </div>
      <div className="flex gap-1.5 mt-3.5">
        <div className="flex-1 h-1 rounded-full bg-brand" />
        <div className="flex-1 h-1 rounded-full bg-brand" />
      </div>
      <h1 className="font-bold text-[26px] tracking-[-0.03em] text-ink mt-7 mb-2.5">
        Verifica tu número
      </h1>
      <p className="text-[14.5px] text-ink2 leading-relaxed m-0">
        Te enviamos un código de 6 dígitos por WhatsApp al número que registraste. Así nadie puede
        reclamar un número ajeno.
      </p>
      <Card className="mt-6 p-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[13px] bg-brandSoft flex items-center justify-center text-brand">
            <Icon name="phone" size={19} />
          </div>
          <div className="flex-1">
            <div className="font-mono font-semibold text-[15px] text-ink">+51 987 654 321</div>
            <div className="text-[12px] text-ink3 mt-px">Número desde el que escribirás al bot</div>
          </div>
          <button
            onClick={() => dispatch({ type: 'AUTH', v: 'login' })}
            className="text-[12.5px] font-semibold text-brand"
          >
            Cambiar
          </button>
        </div>
      </Card>
      <div className="flex gap-2.5 justify-center mt-8">
        {code.map((d, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            value={d}
            inputMode="numeric"
            maxLength={1}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            className="w-[46px] h-14 rounded-[14px] box-border bg-card border-[1.5px] border-line text-center font-mono font-semibold text-[22px] text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/20 transition"
          />
        ))}
      </div>
      <div className="text-center mt-[18px] text-[13px] text-ink2">
        ¿No te llegó? <span className="text-brand font-semibold">Reenviar código</span>{' '}
        <span className="text-ink3">(0:42)</span>
      </div>
      <div className="flex-1" />
      <Btn
        size="lg"
        className="w-full"
        disabled={!full}
        onClick={() => dispatch({ type: 'AUTH', v: 'app' })}
      >
        Verificar y vincular
      </Btn>
      <div className="text-center mt-3.5 text-[12px] text-ink3">
        Un número solo puede pertenecer a una cuenta.{' '}
        <span
          className="text-brand font-semibold cursor-pointer"
          onClick={() => dispatch({ type: 'AUTH', v: 'app' })}
        >
          Saltar →
        </span>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, VerifyScreen });

// ── Onboarding desktop (split-screen) ──────────────────────────
function DesktopOnboarding() {
  const { state, dispatch } = useStore();
  const cajas = ['ahorro', 'pasajes', 'ocio', 'diezmo', 'snacks', 'varios'];
  return (
    <div className="flex h-full bg-page">
      {/* panel de marca */}
      <div
        className="flex flex-col justify-between w-[44%] shrink-0 p-12 relative overflow-hidden"
        style={{ background: 'var(--c-brand)' }}
      >
        <div className="relative z-10">
          <Wordmark
            size={20}
            mark={30}
            className="[&_*]:!text-onBrand [&_.text-brand]:!text-onBrand"
          />
        </div>
        <div className="relative z-10">
          <h1
            className="font-bold text-[38px] leading-[1.1] tracking-[-0.03em]"
            style={{ color: 'var(--c-onBrand)' }}
          >
            Tu dinero,
            <br />
            en mini-cajas.
          </h1>
          <p
            className="text-[16px] mt-4 max-w-[380px] leading-relaxed"
            style={{ color: 'var(--c-onBrand)', opacity: 0.85 }}
          >
            Reparte cada ingreso automáticamente y registra gastos conversando por WhatsApp. El
            mayordomo lleva la cuenta por ti.
          </p>
          {/* preview de sobres */}
          <div className="flex gap-2.5 mt-8">
            {cajas.map((id) => (
              <div
                key={id}
                className="w-[64px] h-12 rounded-xl relative overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.16)' }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: 'polygon(0 0, 100% 0, 100% 22%, 50% 80%, 0 22%)',
                    background: 'rgba(255,255,255,0.22)',
                  }}
                />
                <div
                  className="absolute top-0 left-0 right-0 h-[2.5px]"
                  style={{ background: 'rgba(255,255,255,0.6)' }}
                />
              </div>
            ))}
          </div>
        </div>
        <div
          className="relative z-10 flex items-center gap-6"
          style={{ color: 'var(--c-onBrand)' }}
        >
          {[
            ['phone', 'Registro por WhatsApp'],
            ['mic', 'Notas de voz'],
            ['shield', 'Tu historial, solo tuyo'],
          ].map(([ic, t]) => (
            <div key={t} className="flex items-center gap-2 opacity-90">
              <Icon name={ic} size={16} />
              <span className="text-[12.5px] font-medium">{t}</span>
            </div>
          ))}
        </div>
        {/* textura sutil */}
        <div
          className="absolute -right-20 -bottom-24 w-[360px] h-[360px] rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />
        <div
          className="absolute right-16 top-10 w-[180px] h-[180px] rounded-full"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />
      </div>
      {/* panel del formulario */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <button
          onClick={() => dispatch({ type: 'MODE', v: state.mode === 'dark' ? 'light' : 'dark' })}
          className="absolute top-6 right-6 w-9 h-9 rounded-full bg-card border border-line flex items-center justify-center text-ink2 hover:bg-cardAlt"
        >
          <Icon name={state.mode === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
        <div className="w-full max-w-[380px]">
          {state.auth === 'login' ? <DesktopLoginForm /> : <DesktopVerifyForm />}
        </div>
      </div>
    </div>
  );
}

function DesktopLoginForm() {
  const { dispatch } = useStore();
  return (
    <div className="flex flex-col">
      <div className="hidden">
        <Mark size={48} />
      </div>
      <h2 className="font-bold text-[26px] tracking-[-0.03em] text-ink">Inicia sesión</h2>
      <p className="text-[14.5px] text-ink2 mt-2 leading-relaxed">
        Entra con tu cuenta de Google. El acceso es por invitación — tu cuenta se activa al ser
        aprobada.
      </p>
      <button
        onClick={() => dispatch({ type: 'AUTH', v: 'verify' })}
        className="h-[50px] w-full rounded-[14px] bg-card text-ink border border-lineStrong font-semibold text-[15px] inline-flex items-center justify-center gap-2.5 mt-7 hover:bg-cardAlt transition"
      >
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
      </button>
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-line" />
        <span className="text-[11.5px] text-ink3 font-mono">O</span>
        <div className="flex-1 h-px bg-line" />
      </div>
      <div className="rounded-[14px] border border-line bg-card p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-[11px] bg-brandSoft text-brand flex items-center justify-center shrink-0">
          <Icon name="sparkle" size={17} />
        </div>
        <div>
          <div className="font-semibold text-[13.5px] text-ink">¿Aún no tienes acceso?</div>
          <div className="text-[12.5px] text-ink2 mt-0.5">
            Únete a la lista de espera y te avisamos por WhatsApp cuando se active tu cuenta.
          </div>
          <button className="text-[12.5px] font-semibold text-brand mt-2">
            Unirme a la lista →
          </button>
        </div>
      </div>
      <div className="text-[11.5px] text-ink3 text-center mt-6">
        Al continuar aceptas los Términos y la Política de privacidad.
      </div>
    </div>
  );
}

function DesktopVerifyForm() {
  const { dispatch } = useStore();
  const [code, setCode] = React.useState(['', '', '', '', '', '']);
  const refs = React.useRef([]);
  const full = code.every((d) => d !== '');
  const setDigit = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const n = [...code];
    n[i] = v;
    setCode(n);
    if (v && i < 5) refs.current[i + 1] && refs.current[i + 1].focus();
  };
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1].focus();
  };
  return (
    <div className="flex flex-col">
      <button
        onClick={() => dispatch({ type: 'AUTH', v: 'login' })}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-ink2 mb-5 self-start"
      >
        <Icon name="back" size={15} />
        Volver
      </button>
      <h2 className="font-bold text-[26px] tracking-[-0.03em] text-ink">Verifica tu número</h2>
      <p className="text-[14.5px] text-ink2 mt-2 leading-relaxed">
        Enviamos un código de 6 dígitos por WhatsApp a{' '}
        <span className="font-mono font-semibold text-ink">+51 987 654 321</span>.
      </p>
      <div className="flex gap-2.5 mt-7">
        {code.map((d, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            value={d}
            inputMode="numeric"
            maxLength={1}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            className="w-12 h-14 rounded-[14px] box-border bg-card border-[1.5px] border-line text-center font-mono font-semibold text-[22px] text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/20 transition"
          />
        ))}
      </div>
      <div className="text-[13px] text-ink2 mt-4">
        ¿No te llegó? <span className="text-brand font-semibold">Reenviar código</span>{' '}
        <span className="text-ink3">(0:42)</span>
      </div>
      <Btn
        size="lg"
        className="w-full mt-7"
        disabled={!full}
        onClick={() => dispatch({ type: 'AUTH', v: 'app' })}
      >
        Verificar y entrar
      </Btn>
      <button
        onClick={() => dispatch({ type: 'AUTH', v: 'app' })}
        className="text-[12.5px] text-ink3 mt-4 text-center"
      >
        Verificar más tarde · <span className="text-brand font-semibold">Saltar</span>
      </button>
    </div>
  );
}

Object.assign(window, { DesktopOnboarding, DesktopLoginForm, DesktopVerifyForm });
