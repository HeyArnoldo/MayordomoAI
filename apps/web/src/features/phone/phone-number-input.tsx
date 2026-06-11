import { useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Países frecuentes del producto. El código va SIN '+' (se arma el E.164). */
const COUNTRIES = [
  { iso: 'PE', name: 'Perú', code: '51' },
  { iso: 'MX', name: 'México', code: '52' },
  { iso: 'CO', name: 'Colombia', code: '57' },
  { iso: 'AR', name: 'Argentina', code: '54' },
  { iso: 'CL', name: 'Chile', code: '56' },
  { iso: 'EC', name: 'Ecuador', code: '593' },
  { iso: 'BO', name: 'Bolivia', code: '591' },
  { iso: 'VE', name: 'Venezuela', code: '58' },
  { iso: 'BR', name: 'Brasil', code: '55' },
  { iso: 'US', name: 'Estados Unidos', code: '1' },
  { iso: 'ES', name: 'España', code: '34' },
] as const;

/** Descompone un E.164 en país + dígitos nacionales (código más largo gana). */
function parseE164(e164: string | undefined): { iso: string; digits: string } {
  if (!e164?.startsWith('+')) return { iso: 'PE', digits: '' };
  const raw = e164.slice(1);
  const match = [...COUNTRIES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => raw.startsWith(c.code));
  if (!match) return { iso: 'PE', digits: '' };
  return { iso: match.iso, digits: raw.slice(match.code.length) };
}

/**
 * Input de teléfono estilo Discord: país a la izquierda, número con el
 * prefijo BLOQUEADO a la derecha. El input solo acepta dígitos (sin '+',
 * sin espacios) y expone autocomplete tel del navegador.
 */
export function PhoneNumberInput({
  initialE164,
  onChange,
  autoFocus = false,
}: {
  initialE164?: string;
  onChange: (e164: string) => void;
  autoFocus?: boolean;
}) {
  const parsed = parseE164(initialE164);
  const [iso, setIso] = useState(parsed.iso);
  const [digits, setDigits] = useState(parsed.digits);

  const country = COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0];
  const emit = (nextIso: string, nextDigits: string) => {
    const c = COUNTRIES.find((x) => x.iso === nextIso) ?? COUNTRIES[0];
    onChange(nextDigits ? `+${c.code}${nextDigits}` : '');
  };

  return (
    <div className="grid grid-cols-[150px_1fr] gap-3">
      <div className="space-y-1.5">
        <Label className="text-[12.5px] text-ink-2">Código del país</Label>
        <Select
          value={iso}
          onValueChange={(v) => {
            setIso(v);
            emit(v, digits);
          }}
        >
          <SelectTrigger className="h-12 w-full rounded-[14px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.iso} value={c.iso}>
                <span className="font-mono text-[11px] text-ink-3">{c.iso}</span> {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone-national" className="text-[12.5px] text-ink-2">
          Número de teléfono
        </Label>
        <div className="flex h-12 items-center overflow-hidden rounded-[14px] border border-line-strong bg-surface transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/20">
          {/* prefijo bloqueado: viene del selector, no se tipea */}
          <span className="select-none border-r border-line bg-surface-alt/60 px-3 font-mono text-[15px] leading-[46px] font-semibold text-ink-3">
            +{country.code}
          </span>
          <input
            id="phone-national"
            type="tel"
            name="phone"
            autoComplete="tel-national"
            inputMode="numeric"
            autoFocus={autoFocus}
            value={digits}
            placeholder="987654321"
            maxLength={12}
            onChange={(e) => {
              // Solo dígitos: ni '+', ni espacios, ni guiones (pegado incluido).
              const clean = e.target.value.replace(/\D/g, '');
              setDigits(clean);
              emit(iso, clean);
            }}
            className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-[15px] font-semibold text-ink outline-none placeholder:text-ink-3/50"
          />
        </div>
      </div>
    </div>
  );
}
