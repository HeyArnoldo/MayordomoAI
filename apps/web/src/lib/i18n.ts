import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import { defaultNS, resources } from '@app/i18n';
import { DEFAULT_LOCALE, mapBrowserLanguage } from '@app/contracts';

// Recursos empaquetados (sin fetch): init síncrono, sin Suspense.
// Arranca con el idioma del navegador; LocaleSync lo ajusta al del usuario logueado.
void i18n.use(initReactI18next).init({
  resources,
  defaultNS,
  lng: mapBrowserLanguage(typeof navigator !== 'undefined' ? navigator.language : null),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false }, // React ya escapa
});

// Zod global sigue al idioma activo: los mensajes default de validación
// (min/max/etc.) salen del locale nativo de Zod 4, no de strings custom.
const applyZodLocale = (lng: string): void => {
  z.config(mapBrowserLanguage(lng) === 'es' ? z.locales.es() : z.locales.en());
};
applyZodLocale(i18n.language);
i18n.on('languageChanged', applyZodLocale);

export default i18n;
