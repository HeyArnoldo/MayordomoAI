import { Injectable, Logger } from '@nestjs/common';
import { Channel } from '@app/contracts';
import { AiUsageService } from '../ai-usage/ai-usage.service';

/**
 * Transcripción de notas de voz vía OpenAI directo (si hay OPENAI_API_KEY)
 * o Azure OpenAI (deployment de gpt-4o-transcribe o whisper). REST directo:
 * una nota de voz de WhatsApp llega en OGG/Opus y ambos providers la
 * aceptan sin transcodificar.
 */
@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(private readonly usage: AiUsageService) {}

  enabled(): boolean {
    return Boolean(
      process.env.OPENAI_API_KEY || (process.env.AZURE_RESOURCE_NAME && process.env.AZURE_API_KEY),
    );
  }

  async transcribe(audio: Buffer, userId?: string, mimeType = 'audio/ogg'): Promise<string | null> {
    if (!this.enabled()) {
      this.logger.warn('[dev] transcripción saltada: faltan credenciales de IA');
      return null;
    }

    const useOpenAi = Boolean(process.env.OPENAI_API_KEY);
    let url: string;
    let model: string;
    const headers: Record<string, string> = {};

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), 'voice.ogg');
    form.append('language', 'es');
    form.append('response_format', 'json');

    if (useOpenAi) {
      url = 'https://api.openai.com/v1/audio/transcriptions';
      headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
      model = process.env.OPENAI_TRANSCRIBE_MODEL ?? 'gpt-4o-transcribe';
      form.append('model', model);
    } else {
      model = process.env.AZURE_TRANSCRIBE_DEPLOYMENT ?? 'gpt-4o-transcribe';
      const apiVersion = process.env.AZURE_TRANSCRIBE_API_VERSION ?? '2025-03-01-preview';
      url =
        `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com/openai/deployments/` +
        `${model}/audio/transcriptions?api-version=${apiVersion}`;
      headers['api-key'] = process.env.AZURE_API_KEY!;
    }

    const res = await fetch(url, { method: 'POST', headers, body: form });
    if (!res.ok) {
      this.logger.error(`transcripción falló (${res.status}): ${await res.text()}`);
      return null;
    }
    // gpt-4o-transcribe devuelve usage (tokens de audio); whisper-1 solo text.
    const data = (await res.json()) as {
      text?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (userId) {
      this.usage.record({
        userId,
        kind: 'transcription',
        model,
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
        channel: Channel.WHATSAPP,
      });
    }
    return data.text?.trim() ?? null;
  }
}
