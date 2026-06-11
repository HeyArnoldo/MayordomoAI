import { Injectable, Logger } from '@nestjs/common';

/**
 * Transcripción de notas de voz vía Azure OpenAI (deployment de
 * gpt-4o-transcribe o whisper). REST directo: una nota de voz de WhatsApp
 * llega en OGG/Opus y Azure lo acepta sin transcodificar.
 */
@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  enabled(): boolean {
    return Boolean(process.env.AZURE_RESOURCE_NAME && process.env.AZURE_API_KEY);
  }

  async transcribe(audio: Buffer, mimeType = 'audio/ogg'): Promise<string | null> {
    if (!this.enabled()) {
      this.logger.warn('[dev] transcripción saltada: faltan credenciales de Azure');
      return null;
    }
    const deployment = process.env.AZURE_TRANSCRIBE_DEPLOYMENT ?? 'gpt-4o-transcribe';
    const apiVersion = process.env.AZURE_TRANSCRIBE_API_VERSION ?? '2025-03-01-preview';
    const url =
      `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com/openai/deployments/` +
      `${deployment}/audio/transcriptions?api-version=${apiVersion}`;

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), 'voice.ogg');
    form.append('language', 'es');
    form.append('response_format', 'json');

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': process.env.AZURE_API_KEY! },
      body: form,
    });
    if (!res.ok) {
      this.logger.error(`transcripción falló (${res.status}): ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as { text?: string };
    return data.text?.trim() ?? null;
  }
}
