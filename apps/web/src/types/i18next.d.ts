import 'i18next';
import { defaultNS, resources } from '@app/i18n';

// Keys tipadas: t('auth:login.title') compila, t('auth:no.existe') NO.
// La estructura sale de es/ (fuente de verdad) — en/ ya está atado por `satisfies`.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['es'];
  }
}
