import { Injectable, Logger } from '@nestjs/common';

/**
 * Transcripción de notas de voz vía OpenAI directo (si hay OPENAI_API_KEY)
 * o Azure OpenAI (deployment de gpt-4o-transcribe o whisper). REST directo:
 * una nota de voz de WhatsApp llega en OGG/Opus y ambos providers la
 * aceptan sin transcodificar.
 */
@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  enabled(): boolean {
    return Boolean(
      process.env.OPENAI_API_KEY || (process.env.AZURE_RESOURCE_NAME && process.env.AZURE_API_KEY),
    );
  }

  async transcribe(audio: Buffer, mimeType = 'audio/ogg'): Promise<string | null> {
    if (!this.enabled()) {
      this.logger.warn('[dev] transcripción saltada: faltan credenciales de IA');
      return null;
    }

    const useOpenAi = Boolean(process.env.OPENAI_API_KEY);
    let url: string;
    const headers: Record<string, string> = {};

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), 'voice.ogg');
    form.append('language', 'es');
    form.append('response_format', 'json');

    if (useOpenAi) {
      url = 'https://api.openai.com/v1/audio/transcriptions';
      headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
      form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL ?? 'gpt-4o-transcribe');
    } else {
      const deployment = process.env.AZURE_TRANSCRIBE_DEPLOYMENT ?? 'gpt-4o-transcribe';
      const apiVersion = process.env.AZURE_TRANSCRIBE_API_VERSION ?? '2025-03-01-preview';
      url =
        `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com/openai/deployments/` +
        `${deployment}/audio/transcriptions?api-version=${apiVersion}`;
      headers['api-key'] = process.env.AZURE_API_KEY!;
    }

    const res = await fetch(url, { method: 'POST', headers, body: form });
    if (!res.ok) {
      this.logger.error(`transcripción falló (${res.status}): ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as { text?: string };
    return data.text?.trim() ?? null;
  }
}
