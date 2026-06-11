import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { WhatsappService, EvolutionWebhookPayload } from './whatsapp.service';

/**
 * Webhook PÚBLICO de Evolution (sin JWT). Seguridad por token compartido:
 * configura el mismo valor en WA_WEBHOOK_TOKEN y en el header del webhook
 * de Evolution. Responde 200 al instante y procesa async para no acumular
 * reintentos.
 */
@Controller('webhook')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsapp: WhatsappService) {}

  @Post('whatsapp')
  @HttpCode(200)
  receive(
    @Body() payload: EvolutionWebhookPayload,
    @Headers('x-webhook-token') headerToken: string | undefined,
    @Query('token') queryToken: string | undefined,
  ): { ok: true } {
    const expected = process.env.WA_WEBHOOK_TOKEN;
    if (expected && headerToken !== expected && queryToken !== expected) {
      throw new UnauthorizedException();
    }
    if (!expected) {
      this.logger.warn('WA_WEBHOOK_TOKEN no configurado — webhook abierto (solo dev).');
    }

    // 200 inmediato; el procesamiento sigue en background.
    void this.whatsapp
      .processInbound(payload)
      .catch((err) => this.logger.error(`webhook falló: ${err}`));
    return { ok: true };
  }
}
