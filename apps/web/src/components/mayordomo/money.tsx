import { resolveCurrency } from '@app/contracts';
import { formatMoney } from '@app/i18n';
import { useMe } from '@/hooks/use-auth';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';

/** Monto en mono con cifras tabulares y símbolo de moneda del usuario — siempre alineable. */
export function Money({
  value,
  sign,
  className,
  style,
}: {
  value: number;
  sign?: '+' | '−' | '↔';
  className?: string;
  style?: React.CSSProperties;
}) {
  const { data: me } = useMe();
  const locale = useLocale();
  const currency = resolveCurrency(me?.currency);

  return (
    <span className={cn('money font-semibold', className)} style={style}>
      {sign ? `${sign} ` : ''}
      {formatMoney(value, currency, locale)}
    </span>
  );
}
