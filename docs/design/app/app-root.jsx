// MayordomoAI — App root: router móvil/desktop, frames, switch de dispositivo, tema, toasts

function MobileApp() {
  const { state, dispatch } = useStore();
  if (state.auth === 'login')
    return (
      <Frame>
        <LoginScreen />
      </Frame>
    );
  if (state.auth === 'verify')
    return (
      <Frame>
        <VerifyScreen />
      </Frame>
    );

  const r = state.route;
  let content;
  if (r.startsWith('caja:')) content = <CajaDetalleScreen cajaId={r.slice(5)} />;
  else if (r.startsWith('mov:')) content = <MovDetalleScreen movId={Number(r.slice(4))} />;
  else
    content = {
      dashboard: <DashboardScreen />,
      movimientos: <MovimientosScreen />,
      chat: <ChatScreen />,
      cajas: <CajasScreen />,
      reportes: <ReportesScreen />,
      ajustes: <AjustesScreen />,
      empresa: <EmpresaScreen />,
    }[r] || <DashboardScreen />;

  const isTab = ['dashboard', 'movimientos', 'chat', 'cajas'].includes(r);
  return (
    <Frame>
      <div className="flex-1 flex flex-col min-h-0" key={r}>
        <div className="flex-1 flex flex-col min-h-0 animate-screen">{content}</div>
      </div>
      {isTab && <TabBar />}
      {state.sheet === 'registro' && <RegistroSheet />}
      {state.sheet === 'notif' && <NotifSheet />}
      <Toast />
    </Frame>
  );
}

// Wrapper que añade el spacer de status bar dentro del frame iOS
function Frame({ children }) {
  return (
    <div className="absolute inset-0 bg-page flex flex-col font-sans overflow-hidden">
      <div className="h-[62px] shrink-0" />
      {children}
    </div>
  );
}

function Toast() {
  const { state, dispatch } = useStore();
  React.useEffect(() => {
    if (state.toast) {
      const id = setTimeout(() => dispatch({ type: 'TOAST', v: null }), 2400);
      return () => clearTimeout(id);
    }
  }, [state.toast]);
  if (!state.toast) return null;
  return (
    <div
      className="absolute left-0 right-0 flex justify-center z-[60] pointer-events-none"
      style={{ bottom: 96 }}
    >
      <div className="bg-ink text-page px-4 py-2.5 rounded-full text-[13px] font-semibold shadow-lg animate-toast flex items-center gap-2">
        <Icon name="check" size={14} sw={2.6} className="text-pos" />
        {state.toast}
      </div>
    </div>
  );
}

// ── Root con tema + switch de dispositivo ──────────────────────
function Root() {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    applyTheme(wrapRef.current, state.mode, state.accent);
  }, [state.mode, state.accent]);

  return (
    <StoreCtx.Provider value={{ state, dispatch }}>
      <div
        ref={wrapRef}
        className="min-h-screen w-full flex flex-col items-center bg-page transition-colors"
        style={{ fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}
      >
        {/* toolbar de presentación */}
        <div className="sticky top-0 z-50 w-full flex items-center justify-between px-5 py-3 bg-card/80 backdrop-blur border-b border-line">
          <Wordmark size={15} mark={22} />
          <div className="flex items-center gap-2">
            <div className="flex bg-cardAlt rounded-full p-1 gap-1">
              {[
                ['mobile', 'Móvil'],
                ['desktop', 'Escritorio'],
              ].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => dispatch({ type: 'DEVICE', v: k })}
                  className={cx(
                    'px-3.5 h-8 rounded-full text-[12.5px] font-semibold transition',
                    state.device === k ? 'bg-card text-ink shadow-card' : 'text-ink2',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              onClick={() =>
                dispatch({ type: 'MODE', v: state.mode === 'dark' ? 'light' : 'dark' })
              }
              className="w-8 h-8 rounded-full bg-cardAlt flex items-center justify-center text-ink2"
            >
              <Icon name={state.mode === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
            <div className="hidden sm:flex gap-1.5 items-center pl-1">
              {[
                ['verde', '#0E7A4D'],
                ['teal', '#0F7E96'],
                ['indigo', '#41599E'],
              ].map(([k, c]) => (
                <button
                  key={k}
                  onClick={() => dispatch({ type: 'ACCENT', v: k })}
                  className={cx(
                    'w-6 h-6 rounded-full transition',
                    state.accent === k && 'ring-2 ring-offset-2 ring-offset-card',
                  )}
                  style={{ background: c, ['--tw-ring-color']: c }}
                />
              ))}
            </div>
          </div>
        </div>
        {/* escenario */}
        <div className="flex-1 w-full flex items-center justify-center p-6 overflow-auto">
          {state.device === 'mobile' ? (
            <IOSDevice dark={state.mode === 'dark'} width={402} height={874}>
              <MobileApp />
            </IOSDevice>
          ) : (
            <ChromeWindow width={1360} height={860} url="mayordomoai.xyz">
              <div className="relative w-full h-full overflow-hidden">
                {state.auth === 'app' ? <DeskApp /> : <DesktopOnboarding />}
                {state.auth === 'app' && state.sheet === 'registro' && <RegistroSheet />}
                <Toast />
              </div>
            </ChromeWindow>
          )}
        </div>
        <div className="text-[11px] text-ink3 pb-4 font-mono">
          {state.auth === 'app'
            ? 'Toca, escribe, registra — todo es interactivo'
            : 'Inicia sesión con Google para entrar'}
        </div>
      </div>
    </StoreCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
