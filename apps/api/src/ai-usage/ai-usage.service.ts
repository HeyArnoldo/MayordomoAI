import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from '@app/contracts';
import { AiUsageKind, AiUsageLog } from './ai-usage-log.entity';

/**
 * Precios en USD por 1M de tokens (actualizar a mano cuando el provider
 * los cambie — por eso el panel dice "estimado"). Matching por prefijo:
 * cubre nombres de deployment de Azure tipo "gpt-4o-2".
 */
const PRICES: Array<{ prefix: string; inputPerM: number; outputPerM: number }> = [
  { prefix: 'gpt-4o-mini-transcribe', inputPerM: 3.0, outputPerM: 5.0 },
  { prefix: 'gpt-4o-transcribe', inputPerM: 6.0, outputPerM: 10.0 },
  { prefix: 'gpt-4o-mini', inputPerM: 0.15, outputPerM: 0.6 },
  { prefix: 'gpt-4o', inputPerM: 2.5, outputPerM: 10.0 },
  { prefix: 'gpt-4.1-mini', inputPerM: 0.4, outputPerM: 1.6 },
  { prefix: 'gpt-4.1', inputPerM: 2.0, outputPerM: 8.0 },
];

export interface UsageEvent {
  userId: string;
  kind: AiUsageKind;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  channel?: Channel;
}

export interface UserUsageAggregate {
  userId: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  kinds: Record<string, { requests: number; costUsd: number }>;
}

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(@InjectRepository(AiUsageLog) private readonly repo: Repository<AiUsageLog>) {}

  /**
   * Fire-and-forget: un fallo registrando uso JAMÁS rompe la respuesta al
   * usuario. Por eso no se await-ea en los call sites.
   */
  record(event: UsageEvent): void {
    const cost = estimateCost(event.model, event.inputTokens, event.outputTokens);
    void this.repo
      .insert({
        userId: event.userId,
        kind: event.kind,
        model: event.model,
        inputTokens: event.inputTokens ?? null,
        outputTokens: event.outputTokens ?? null,
        costUsd: cost !== null ? cost.toFixed(6) : null,
        channel: event.channel ?? null,
      })
      .catch((err) => this.logger.error(`no se pudo registrar uso IA: ${err}`));
  }

  /** Agregado por usuario y kind desde una fecha (para el panel admin). */
  async aggregateSince(from: Date): Promise<UserUsageAggregate[]> {
    const rows = await this.repo
      .createQueryBuilder('u')
      .select('u.userId', 'userId')
      .addSelect('u.kind', 'kind')
      .addSelect('COUNT(*)', 'requests')
      .addSelect('COALESCE(SUM(u.inputTokens), 0)', 'inputTokens')
      .addSelect('COALESCE(SUM(u.outputTokens), 0)', 'outputTokens')
      .addSelect('COALESCE(SUM(u.costUsd), 0)', 'costUsd')
      .where('u.createdAt >= :from', { from })
      .groupBy('u.userId')
      .addGroupBy('u.kind')
      .getRawMany<{
        userId: string;
        kind: string;
        requests: string;
        inputTokens: string;
        outputTokens: string;
        costUsd: string;
      }>();

    const byUser = new Map<string, UserUsageAggregate>();
    for (const r of rows) {
      const agg = byUser.get(r.userId) ?? {
        userId: r.userId,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        kinds: {},
      };
      const requests = parseInt(r.requests, 10);
      const cost = parseFloat(r.costUsd);
      agg.requests += requests;
      agg.inputTokens += parseInt(r.inputTokens, 10);
      agg.outputTokens += parseInt(r.outputTokens, 10);
      agg.costUsd += cost;
      agg.kinds[r.kind] = { requests, costUsd: cost };
      byUser.set(r.userId, agg);
    }
    return [...byUser.values()].sort((a, b) => b.costUsd - a.costUsd);
  }
}

function estimateCost(model: string, input?: number, output?: number): number | null {
  const price = PRICES.find((p) => model.startsWith(p.prefix));
  if (!price || (input === undefined && output === undefined)) return null;
  return (
    ((input ?? 0) / 1_000_000) * price.inputPerM + ((output ?? 0) / 1_000_000) * price.outputPerM
  );
}
