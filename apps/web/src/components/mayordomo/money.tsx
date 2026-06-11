import { cn } from '@/lib/utils';

const formatter = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Monto en mono con cifras tabulares y "S/" más chico — siempre alineable. */
export function Money({
  value,
  sign,
  className,
}: {
  value: number;
  sign?: '+' | '−' | '↔';
  className?: string;
}) {
  return (
    <span className={cn('money font-semibold', className)}>
      {sign ? `${sign} ` : ''}
      <span className="mr-0.5 text-[0.68em] opacity-60">S/</span>
      {formatter.format(value)}
    </span>
  );
}
