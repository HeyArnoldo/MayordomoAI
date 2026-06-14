import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTransactionInput, Locale, TransactionSource, TransactionType } from '@app/contracts';
import { formatMoney } from '@app/i18n';
import { BoxesService } from '../boxes/boxes.service';
import { TransactionsService, toTransactionDto } from '../transactions/transactions.service';
import { RecurringService } from '../recurring/recurring.service';
import { UsersService } from '../users/users.service';
import type { I18nService } from '../i18n/i18n.service';
import { AppException } from '../common/errors/app.exception';
import { ToolAudit } from './tool-audit.entity';
import { toolErrorMessage } from './tool-error.helper';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Per-call execution context. Services are injected via DI (constructor);
 * per-request fields (userId, locale, etc.) flow here on each call.
 * This is AgentToolsContext MINUS the service handles.
 */
export interface ToolExecCtx {
  userId: string;
  conversationId: string | null;
  locale: Locale;
  currency: string;
  i18n?: Pick<I18nService, 't'>;
}

// ---------------------------------------------------------------------------
// Threshold (same constant, exported for parity with agent-tools.ts)
// ---------------------------------------------------------------------------

export const EXECUTOR_CONFIRMATION_THRESHOLD = 100;

// ---------------------------------------------------------------------------
// Helpers (moved from agent-tools.ts)
// ---------------------------------------------------------------------------

/** "all"/"todas"/"*" from the model = no box filter. */
const ALL_BOXES = new Set(['all', 'todas', 'todos', '*']);

/** ISO week string for a YYYY-MM-DD date → "2026-W23" (for groupBy=week). */
function isoWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Argument types (match the agent tool inputSchemas exactly)
// ---------------------------------------------------------------------------

export interface QueryTransactionsArgs {
  type?: TransactionType;
  boxNames?: string[];
  textQuery?: string;
  from?: string;
  to?: string;
  groupBy: 'none' | 'box' | 'day' | 'week' | 'month';
  orderBy: 'date' | 'amount';
  limit: number;
}

export interface RegisterTransactionArgs {
  type: TransactionType;
  boxName?: string;
  amount: number;
  note?: string;
  userConfirmed: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AgentToolExecutorService {
  private readonly logger = new Logger(AgentToolExecutorService.name);

  constructor(
    private readonly boxes: BoxesService,
    private readonly transactions: TransactionsService,
    // Kept for DI completeness and future tools; not used by the 3 MVP tools directly.
    private readonly recurring: RecurringService,
    private readonly users: UsersService,
    @InjectRepository(ToolAudit) private readonly audits: Repository<ToolAudit>,
  ) {}

  // ── Central audit + error wrapper (moved verbatim from agent-tools.ts) ──

  private async audited<T>(
    ctx: ToolExecCtx,
    toolName: string,
    args: unknown,
    run: () => Promise<T>,
  ): Promise<T | { error: string }> {
    let result: T;
    try {
      result = await run();
    } catch (err) {
      if (!ctx.i18n) throw err;
      // Non-AppException errors (e.g. TypeORM QueryFailedError) may carry
      // table/column/SQL details. Log them server-side and surface only a
      // generic localized message to the caller (closes the leak across the
      // external REST trust boundary). AppException messages are caller-safe.
      if (!(err instanceof AppException)) {
        this.logger.error(`Tool "${toolName}" failed with an unexpected error`, err as Error);
      }
      const errorResult = { error: toolErrorMessage(err, ctx.locale, ctx.i18n) };
      await this.audits.save(
        this.audits.create({
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          tool: toolName,
          args,
          result: errorResult,
        }),
      );
      return errorResult;
    }
    await this.audits.save(
      this.audits.create({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        tool: toolName,
        args,
        result: result as object,
      }),
    );
    return result;
  }

  // ── Tool methods ──────────────────────────────────────────────────────────

  getBoxBalances(ctx: ToolExecCtx): Promise<unknown | { error: string }> {
    return this.audited(ctx, 'getBoxBalances', {}, () => this.boxes.withBalances(ctx.userId));
  }

  queryTransactions(
    ctx: ToolExecCtx,
    args: QueryTransactionsArgs,
  ): Promise<unknown | { error: string }> {
    const isEn = ctx.locale === 'en';

    return this.audited(ctx, 'queryTransactions', args, async () => {
      const allBoxes = await this.boxes.findAll(ctx.userId);

      // Resolve box names → ids
      let boxIds: Set<string> | null = null;
      const wanted = (args.boxNames ?? []).filter((n) => !ALL_BOXES.has(n.trim().toLowerCase()));
      if (wanted.length > 0) {
        const ids = new Set<string>();
        const missing: string[] = [];
        for (const name of wanted) {
          const box = allBoxes.find((b) => b.name.toLowerCase() === name.trim().toLowerCase());
          if (box) ids.add(box.id);
          else missing.push(name);
        }
        if (missing.length > 0) {
          return {
            error: isEn
              ? `These boxes do not exist: ${missing.join(', ')}`
              : `Estas cajas no existen: ${missing.join(', ')}`,
            availableBoxes: allBoxes.filter((b) => b.active).map((b) => b.name),
            hint: isEn
              ? 'Omit boxNames to search across ALL boxes.'
              : 'Omite boxNames para buscar en TODAS las cajas.',
          };
        }
        boxIds = ids;
      }

      const scanAll =
        args.groupBy !== 'none' || !!args.textQuery || boxIds !== null || args.orderBy === 'amount';
      const txs = await this.transactions.list(ctx.userId, {
        type: args.type,
        from: args.from,
        to: args.to,
        includeVoided: false,
        limit: scanAll ? 500 : args.limit,
        offset: 0,
      });

      const truncated = txs.length === 500;

      const names = new Map(allBoxes.map((b) => [b.id, b.name]));
      const q = args.textQuery?.trim().toLowerCase();
      const matches = txs
        .map(toTransactionDto)
        .filter((t) => !boxIds || (t.boxId !== null && boxIds.has(t.boxId)))
        .filter((t) => !q || (t.note?.toLowerCase().includes(q) ?? false))
        .map((t) => ({ ...t, boxName: t.boxId ? (names.get(t.boxId) ?? null) : null }));

      const round2 = (n: number) => Math.round(n * 100) / 100;
      const total = round2(matches.reduce((s, t) => s + t.amount, 0));

      if (args.groupBy === 'none') {
        const sorted =
          args.orderBy === 'amount' ? [...matches].sort((a, b) => b.amount - a.amount) : matches;
        return {
          matches: sorted.slice(0, args.limit),
          count: matches.length,
          total,
          ...(truncated
            ? {
                warning: isEn
                  ? 'Only the most recent 500 transactions were scanned; results may be incomplete. Narrow the date range for exact figures.'
                  : 'Solo se escanearon los 500 movimientos más recientes; los resultados pueden estar incompletos. Acota el rango de fechas para cifras exactas.',
              }
            : {}),
        };
      }

      const keyOf = (t: (typeof matches)[number]): string => {
        switch (args.groupBy) {
          case 'box':
            return t.boxName ?? (isEn ? '(no box)' : '(sin caja)');
          case 'day':
            return t.date;
          case 'month':
            return t.date.slice(0, 7);
          default:
            return isoWeek(t.date);
        }
      };

      const groups = new Map<string, { total: number; count: number; max: number }>();
      for (const t of matches) {
        const k = keyOf(t);
        const g = groups.get(k) ?? { total: 0, count: 0, max: 0 };
        g.total += t.amount;
        g.count += 1;
        g.max = Math.max(g.max, t.amount);
        groups.set(k, g);
      }

      const allocated =
        args.groupBy === 'box'
          ? new Map((await this.boxes.withBalances(ctx.userId)).map((b) => [b.name, b.allocated]))
          : null;

      const rows = [...groups.entries()]
        .map(([key, g]) => ({
          group: key,
          total: round2(g.total),
          count: g.count,
          avg: round2(g.total / g.count),
          max: round2(g.max),
          ...(allocated
            ? {
                allocated: allocated.get(key) ?? null,
                pctOfAllocated:
                  (allocated.get(key) ?? 0) > 0
                    ? Math.round((g.total / allocated.get(key)!) * 100)
                    : null,
              }
            : {}),
        }))
        .sort((a, b) => b.total - a.total);

      return {
        groups: rows,
        count: matches.length,
        total,
        ...(truncated
          ? {
              warning: isEn
                ? 'Only the most recent 500 transactions were scanned; results may be incomplete. Narrow the date range for exact figures.'
                : 'Solo se escanearon los 500 movimientos más recientes; los resultados pueden estar incompletos. Acota el rango de fechas para cifras exactas.',
            }
          : {}),
      };
    });
  }

  registerTransaction(
    ctx: ToolExecCtx,
    args: RegisterTransactionArgs,
  ): Promise<unknown | { error: string }> {
    const isEn = ctx.locale === 'en';
    const fmt = (amount: number) => formatMoney(amount, ctx.currency, ctx.locale);

    return this.audited(ctx, 'registerTransaction', args, async () => {
      // Server-side confirmation guard — non-negotiable by prompt.
      if (
        args.type === TransactionType.EXPENSE &&
        args.amount >= EXECUTOR_CONFIRMATION_THRESHOLD &&
        !args.userConfirmed
      ) {
        return {
          needsConfirmation: true,
          message: isEn
            ? `High amount (${fmt(args.amount)}). Ask the user for confirmation before recording.`
            : `Monto alto (${fmt(args.amount)}). Pide confirmación al usuario antes de registrar.`,
        };
      }

      let boxId: string | null | undefined;
      if (args.type === TransactionType.EXPENSE) {
        if (!args.boxName) {
          return {
            error: isEn
              ? 'An expense requires the box name'
              : 'Un gasto necesita el nombre de la caja',
          };
        }
        const all = await this.boxes.findAll(ctx.userId);
        boxId = all.find((b) => b.name.toLowerCase() === args.boxName!.toLowerCase())?.id;
        if (!boxId) {
          return {
            error: isEn
              ? `Box "${args.boxName}" does not exist`
              : `No existe la caja "${args.boxName}"`,
            availableBoxes: all.filter((b) => b.active).map((b) => b.name),
          };
        }
      }

      const input: CreateTransactionInput = {
        type: args.type,
        boxId: boxId ?? null,
        amount: Math.round(args.amount * 100) / 100,
        note: args.note,
      };
      const tx = await this.transactions.create(ctx.userId, input, TransactionSource.PWA);
      const balances = await this.boxes.withBalances(ctx.userId);
      const box = balances.find((b) => b.id === tx.boxId);
      return { registered: toTransactionDto(tx), boxBalance: box ?? null };
    });
  }
}
