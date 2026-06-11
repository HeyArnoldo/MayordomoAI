import { useRef, useState } from 'react';

/** Hook + input de código de 6 dígitos (auto-avance, backspace, pegado). */
export function useCodeInput() {
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const full = code.every((d) => d !== '');
  const reset = () => setCode(['', '', '', '', '', '']);
  return { code, setCode, full, value: code.join(''), reset };
}

export function CodeInput({
  code,
  onChange,
}: {
  code: string[];
  onChange: (code: string[]) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setDigit = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...code];
    next[i] = v;
    onChange(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (digits.length < 2) return;
    e.preventDefault();
    onChange(digits.padEnd(6, '').split('').slice(0, 6));
    refs.current[Math.min(digits.length, 5)]?.focus();
  };

  return (
    <div className="flex justify-center gap-2.5" onPaste={onPaste}>
      {code.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          maxLength={1}
          autoFocus={i === 0}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          className="box-border h-14 w-[46px] rounded-[14px] border-[1.5px] border-line bg-surface text-center font-mono text-[22px] font-semibold text-ink transition outline-none focus:border-brand focus:ring-4 focus:ring-brand/20"
        />
      ))}
    </div>
  );
}
