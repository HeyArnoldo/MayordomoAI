import { useLocale } from '@/hooks/use-locale';

/** Montado en el root: sincroniza i18next con el idioma del usuario en toda la app. */
export function LocaleSync() {
  useLocale();
  return null;
}
