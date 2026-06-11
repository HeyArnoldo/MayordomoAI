import { Injectable, Logger } from '@nestjs/common';

/**
 * Cliente HTTP de Evolution API. Plug & play por .env: si faltan las
 * credenciales, los envíos se loguean y no rompen nada (modo dev).
 */
@Injectable()
export class EvolutionClient {
  private readonly logger = new Logger(EvolutionClient.name);

  enabled(): boolean {
    return Boolean(
      process.env.EVOLUTION_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE,
    );
  }

  private base(): string {
    return (process.env.EVOLUTION_URL ?? '').replace(/\/$/, '');
  }

  /** Envía texto a un número (E.164 sin '+', formato Evolution). */
  async sendText(e164: string, text: string): Promise<void> {
    if (!this.enabled()) {
      this.logger.warn(`[dev] sendText a ${e164}: ${text.slice(0, 80)}…`);
      return;
    }
    const number = e164.replace('+', '');
    const res = await fetch(`${this.base()}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EVOLUTION_API_KEY!,
      },
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) {
      this.logger.error(`sendText falló (${res.status}): ${await res.text()}`);
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
