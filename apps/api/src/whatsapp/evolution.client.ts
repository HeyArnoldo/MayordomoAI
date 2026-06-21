import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * Cliente HTTP de Evolution API. Plug & play por .env: si faltan las
 * credenciales, los envíos se loguean y no rompen nada (modo dev).
 */
@Injectable()
export class EvolutionClient implements OnModuleInit {
  private readonly logger = new Logger(EvolutionClient.name);

  /**
   * Al arrancar deja constancia en el log de si el contenedor ve las
   * credenciales de Evolution. Nunca imprime la API key — solo instancia y
   * URL — para confirmar de un vistazo que el deploy las inyectó.
   */
  onModuleInit(): void {
    const missing = this.missingConfig();
    if (missing.length === 0) {
      this.logger.log(
        `WhatsApp outbound HABILITADO — instancia="${process.env.EVOLUTION_INSTANCE}" url="${this.base()}"`,
      );
      return;
    }
    const detail = `WhatsApp outbound DESHABILITADO — faltan ${missing.join(', ')}. Los mensajes se generan pero NO se entregan.`;
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(detail);
    } else {
      this.logger.warn(detail);
    }
  }

  enabled(): boolean {
    return this.missingConfig().length === 0;
  }

  /** Variables de Evolution ausentes. Vacío cuando el envío está habilitado. */
  private missingConfig(): string[] {
    const missing: string[] = [];
    if (!process.env.EVOLUTION_URL) missing.push('EVOLUTION_URL');
    if (!process.env.EVOLUTION_API_KEY) missing.push('EVOLUTION_API_KEY');
    if (!process.env.EVOLUTION_INSTANCE) missing.push('EVOLUTION_INSTANCE');
    return missing;
  }

  private base(): string {
    return (process.env.EVOLUTION_URL ?? '').replace(/\/$/, '');
  }

  /** Envía texto a un número (E.164 sin '+', formato Evolution). */
  async sendText(e164: string, text: string): Promise<void> {
    const missing = this.missingConfig();
    if (missing.length > 0) {
      // En dev es esperado (sin credenciales). En producción es un fallo de
      // configuración: el mensaje se generó pero NUNCA se entrega — debe ser
      // visible, no un warn silencioso.
      const detail = `WhatsApp NO enviado a ${e164}: faltan variables de Evolution (${missing.join(', ')}).`;
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(detail);
      } else {
        this.logger.warn(`[dev] ${detail} Texto: ${text.slice(0, 80)}…`);
      }
      return;
    }
    const number = e164.replace('+', '');
    try {
      const res = await fetch(`${this.base()}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.EVOLUTION_API_KEY!,
        },
        body: JSON.stringify({ number, text }),
      });
      if (!res.ok) {
        this.logger.error(`sendText a ${e164} falló (${res.status}): ${await res.text()}`);
      }
    } catch (err) {
      // fetch lanza ante DNS/timeout/conexión rechazada: sin este catch el
      // mensaje se pierde sin un motivo de red claro en el log.
      this.logger.error(`sendText a ${e164} no pudo conectar con Evolution: ${String(err)}`);
    }
  }

  /** Descarga el media de un mensaje en base64 (cuando el webhook no lo trae). */
  async getBase64(messageId: string): Promise<string | null> {
    if (!this.enabled()) return null;
    const res = await fetch(
      `${this.base()}/chat/getBase64FromMediaMessage/${process.env.EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.EVOLUTION_API_KEY!,
        },
        body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false }),
      },
    );
    if (!res.ok) {
      this.logger.error(`getBase64 falló (${res.status})`);
      return null;
    }
    const data = (await res.json()) as { base64?: string };
    return data.base64 ?? null;
  }
}
