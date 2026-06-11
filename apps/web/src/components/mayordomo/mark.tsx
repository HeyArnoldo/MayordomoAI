/** Marca: cuadrado redondeado con solapa de sobre — el "sobre mayordomo". */
export function Mark({ size = 32 }: { size?: number }) {
  const radius = Math.round(size * 0.3);
  return (
    <div
      className="relative shrink-0 overflow-hidden bg-brand"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" className="block">
        <path
          d="M5 10 L16 19 L27 10"
          fill="none"
          stroke="var(--on-brand)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 24 L16 15 L27 24"
          fill="none"
          stroke="var(--on-brand)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.45"
        />
      </svg>
    </div>
  );
}

export function Wordmark({ size = 18, mark = 22 }: { size?: number; mark?: number }) {
  return (
    <div className="flex items-center" style={{ gap: Math.round(mark * 0.36) }}>
      <Mark size={mark} />
      <span className="font-bold tracking-tight text-ink" style={{ fontSize: size, lineHeight: 1 }}>
        Mayordomo<span className="text-brand">AI</span>
      </span>
    </div>
  );
}
