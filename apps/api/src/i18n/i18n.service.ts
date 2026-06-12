import { Injectable } from '@nestjs/common';
import { createInstance, type i18n } from 'i18next';
import { resources } from '@app/i18n';
import { DEFAULT_LOCALE, type Locale } from '@app/contracts';

/**
 * i18next core como servicio Nest — NO nestjs-i18n (sobredimensionado para
 * ~50 strings). Misma fuente de recursos que la web (@app/i18n): un solo
 * árbol de keys para ambos lados.
 */
@Injectable()
export class I18nService {
  private readonly instance: i18n;

  constructor() {
    this.instance = createInstance({
      resources,
      fallbackLng: DEFAULT_LOCALE,
      defaultNS: 'api', // los mensajes server-side viven en el namespace `api`
      interpolation: { escapeValue: false }, // texto plano (WhatsApp/errores), no HTML
      initAsync: false, // recursos en memoria → init síncrono
    });
    void this.instance.init();
  }

  /** Traduce una key (namespace `api`) en el idioma del usuario. */
  t(locale: Locale, key: string, params?: Record<string, unknown>): string {
    return this.instance.t(key, { lng: locale, ...params });
  }
}
