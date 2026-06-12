import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  COUNTRIES,
  FREQUENT_ISOS,
  findCountry,
  normalize,
  parseE164,
  type Country,
} from './countries';

const FREQUENT = FREQUENT_ISOS.map((iso) => findCountry(iso)).filter((c): c is Country =>
  Boolean(c),
);
const REST = COUNTRIES.filter((c) => !(FREQUENT_ISOS as readonly string[]).includes(c.iso));

function CountryOption({
  country,
  selected,
  onSelect,
}: {
  country: Country;
  selected: boolean;
  onSelect: (iso: string) => void;
}) {
  return (
    <CommandItem
      // value único por grupo: el iso evita colisiones entre países homónimos
      value={`${country.iso} ${country.name}`}
      keywords={[normalize(country.name), country.code, `+${country.code}`]}
      onSelect={() => onSelect(country.iso)}
      className="gap-2.5"
    >
      <span className="w-7 shrink-0 rounded-md bg-surface-alt px-1 py-0.5 text-center font-mono text-[10.5px] font-bold text-ink-3">
        {country.iso}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px]">{country.name}</span>
      <span className="shrink-0 font-mono text-[12px] text-ink-3">+{country.code}</span>
      {selected && <Check className="size-4 shrink-0 text-brand" />}
    </CommandItem>
  );
}

/**
 * Input de teléfono estilo Discord: país a la izquierda, número con el
 * prefijo BLOQUEADO a la derecha. El selector de país es un combobox con
 * búsqueda (nombre, ISO o código, ignora tildes) sobre la lista completa
 * E.164; los países frecuentes del producto aparecen arriba.
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
  const { t } = useTranslation('phone');
  const parsed = parseE164(initialE164);
  const [iso, setIso] = useState(parsed.iso);
  const [digits, setDigits] = useState(parsed.digits);
  const [pickerOpen, setPickerOpen] = useState(false);

  const country = findCountry(iso) ?? COUNTRIES[0];
  const emit = (nextIso: string, nextDigits: string) => {
    const c = findCountry(nextIso) ?? COUNTRIES[0];
    onChange(nextDigits ? `+${c.code}${nextDigits}` : '');
  };

  const selectCountry = (nextIso: string) => {
    setIso(nextIso);
    emit(nextIso, digits);
    setPickerOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[12.5px] text-ink-2">{t('input.countryLabel')}</Label>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              role="combobox"
              aria-expanded={pickerOpen}
              className="flex h-12 w-full items-center gap-2.5 rounded-[14px] border border-line-strong bg-surface px-3.5 text-left transition hover:bg-surface-alt/60 focus:outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/20"
            >
              <span className="shrink-0 rounded-md bg-surface-alt px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-3">
                {country.iso}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-ink">
                {country.name}
              </span>
              <span className="shrink-0 font-mono text-[13px] font-semibold text-ink-3">
                +{country.code}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-ink-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
            <Command
              filter={(value, search, keywords) => {
                const q = normalize(search);
                const haystack = normalize(`${value} ${(keywords ?? []).join(' ')}`);
                return haystack.includes(q) ? 1 : 0;
              }}
            >
              <CommandInput placeholder={t('input.searchPlaceholder')} />
              <CommandList className="max-h-64">
                <CommandEmpty>{t('input.noMatch')}</CommandEmpty>
                <CommandGroup heading={t('input.frequent')}>
                  {FREQUENT.map((c) => (
                    <CountryOption
                      key={c.iso}
                      country={c}
                      selected={c.iso === iso}
                      onSelect={selectCountry}
                    />
                  ))}
                </CommandGroup>
                <CommandGroup heading={t('input.allCountries')}>
                  {REST.map((c) => (
                    <CountryOption
                      key={c.iso}
                      country={c}
                      selected={c.iso === iso}
                      onSelect={selectCountry}
                    />
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone-national" className="text-[12.5px] text-ink-2">
          {t('input.phoneLabel')}
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
