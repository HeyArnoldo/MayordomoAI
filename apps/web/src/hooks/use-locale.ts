import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { mapBrowserLanguage, type Locale } from '@app/contracts';
import { useMe } from '@/hooks/use-auth';

/**
 * Idioma efectivo: user.language (logueado) → navigator.language (pre-login).
 * Mantiene i18next sincronizado cuando cambia (login, logout, settings).
 */
export function useLocale(): Locale {
  const { data: me } = useMe();
  const { i18n } = useTranslation();
  const locale = me?.language ?? mapBrowserLanguage(navigator.language);

  useEffect(() => {
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [i18n, locale]);

  return locale;
}
