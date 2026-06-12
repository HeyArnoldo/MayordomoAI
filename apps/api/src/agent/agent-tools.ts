import { tool, ToolSet } from 'ai';
import { z } from 'zod';
import { Repository } from 'typeorm';
import {
  BoxScope,
  BoxType,
  CreateTransactionInput,
  Locale,
  localeSchema,
  currencySchema,
  SUPPORTED_CURRENCIES,
  TransactionSource,
  TransactionType,
} from '@app/contracts';
import { formatMoney } from '@app/i18n';
import { BoxesService, toBoxDto } from '../boxes/boxes.service';
import { TransactionsService, toTransactionDto } from '../transactions/transactions.service';
import { RecurringService } from '../recurring/recurring.service';
import { UsersService } from '../users/users.service';
import type { I18nService } from '../i18n/i18n.service';
import { ToolAudit } from './tool-audit.entity';
import { toolErrorMessage } from './tool-error.helper';

/**
 * Herramientas del agente. GUARDRAILS CLAVE:
 * - El userId lo inyecta el BACKEND (de la sesión/número), jamás el modelo.
 * - Toda llamada queda auditada en tool_audits (reasoning trail visible).
 * - La escritura de montos altos exige confirmación explícita del usuario.
 * - El agente solo responde con lo que devuelven estas tools; cero invención.
 */

/** Umbral: gastos >= a esto requieren confirmación explícita antes de escribir. */
export const CONFIRMATION_THRESHOLD = 100;

export interface AgentToolsContext {
  userId: string;
  conversationId: string | null;
  boxes: BoxesService;
  transactions: TransactionsService;
  recurring: RecurringService;
  users: UsersService;
  audits: Repository<ToolAudit>;
  /** Idioma del usuario (persistido en DB). */
  locale: Locale;
  /** Moneda resuelta del usuario (resolveCurrency aplicado, nunca null). */
  currency: string;
  /**
   * I18nService instance for translating AppException codes into localized
   * tool error messages. When present, toolErrorMessage is used for all
   * catch paths so the LLM sees errors in the user's language.
   */
  i18n?: Pick<I18nService, 't'>;
}

/** Audita y ejecuta: cada tool pasa por acá. */
async function audited<T>(
  ctx: AgentToolsContext,
  toolName: string,
  args: unknown,
  run: () => Promise<T>,
): Promise<T> {
  const result = await run();
  await ctx.audits.save(
    ctx.audits.create({
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      tool: toolName,
      args,
      result: result as object,
    }),
  );
  return result;
}

/** "all"/"todas"/"*" del modelo = sin filtro de caja. */
const ALL_BOXES = new Set(['all', 'todas', 'todos', '*']);

/** Semana ISO de una fecha YYYY-MM-DD → "2026-W23" (para groupBy=week). */
function isoWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7; // lunes=1 ... domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // jueves de la semana ISO
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function buildAgentTools(ctx: AgentToolsContext): ToolSet {
  // Helpers locales para formatear montos en la moneda/idioma del usuario.
  const fmt = (amount: number) => formatMoney(amount, ctx.currency, ctx.locale);
  const threshold = fmt(CONFIRMATION_THRESHOLD);
  const isEn = ctx.locale === 'en';

  return {
    getBoxBalances: tool({
      description: isEn
        ? 'Current state of all the user\'s boxes: % allocated, monthly allocated amount, spent, available balance and accumulated funds. Use for "how am I doing", "how much do I have left", "balance".'
        : 'Estado actual de todas las cajas del usuario: % asignado, monto asignado del mes, gastado, saldo disponible y acumulado (fondos). Úsala para "cómo voy", "cuánto me queda", "saldo".',
      inputSchema: z.object({}),
      execute: async (args) =>
        audited(ctx, 'getBoxBalances', args, () => ctx.boxes.withBalances(ctx.userId)),
    }),

    queryTransactions: tool({
      description: isEn
        ? "Flexible query over the user's transactions: filtering, text search and aggregation in ONE tool. " +
          'ALL filters are optional: without type it returns income+expenses+transits; without boxNames it searches ALL boxes; ' +
          'without dates it returns the most recent. textQuery searches the note ("taxi", "supermarket"). ' +
          'groupBy=box/day/week/month aggregates with total, count and average per group — use it for ' +
          '"where am I overspending", "which box do I spend the most in", monthly comparisons. ' +
          'orderBy=amount for the biggest expenses. Dates in YYYY-MM-DD (America/Lima timezone).'
        : 'Consulta flexible sobre los movimientos del usuario: filtros, búsqueda por texto y agregación en UNA tool. ' +
          'TODOS los filtros son opcionales: sin type trae ingresos+gastos+tránsitos; sin boxNames busca en TODAS las cajas; ' +
          'sin fechas trae lo más reciente. textQuery busca en la nota ("taxi", "supermercado"). ' +
          'groupBy=box/day/week/month agrega con total, cantidad y promedio por grupo — úsala para ' +
          '"en qué me excedo", "en qué caja gasto más", comparativas mensuales. ' +
          'orderBy=amount para los gastos más grandes. Fechas en YYYY-MM-DD (zona America/Lima).',
      inputSchema: z.object({
        type: z
          .enum(TransactionType)
          .optional()
          .describe(
            isEn
              ? 'income | expense | transit. OMIT for all types.'
              : 'income | expense | transit. OMITIR para todos los tipos.',
          ),
        boxNames: z
          .array(z.string())
          .optional()
          .describe(
            isEn
              ? 'Exact box names to filter by. OMIT for all boxes.'
              : 'Nombres exactos de cajas a filtrar. OMITIR para todas las cajas.',
          ),
        textQuery: z
          .string()
          .optional()
          .describe(isEn ? 'Text to search in the note' : 'Texto a buscar en la nota'),
        from: z
          .string()
          .optional()
          .describe(isEn ? 'Date from, YYYY-MM-DD' : 'Fecha desde, YYYY-MM-DD'),
        to: z
          .string()
          .optional()
          .describe(isEn ? 'Date to, YYYY-MM-DD' : 'Fecha hasta, YYYY-MM-DD'),
        groupBy: z
          .enum(['none', 'box', 'day', 'week', 'month'])
          .default('none')
          .describe(
            isEn ? 'Aggregate by group instead of listing' : 'Agregar por grupo en vez de listar',
          ),
        orderBy: z.enum(['date', 'amount']).default('date'),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: async (args) =>
        audited(ctx, 'queryTransactions', args, async () => {
          const allBoxes = await ctx.boxes.findAll(ctx.userId);

          // Resuelve nombres → ids (filtro en memoria: list() solo filtra por una caja).
          let boxIds: Set<string> | null = null;
          const wanted = (args.boxNames ?? []).filter(
            (n) => !ALL_BOXES.has(n.trim().toLowerCase()),
          );
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

          // Texto/cajas/agregación se filtran post-query: hay que escanear más filas.
          const scanAll =
            args.groupBy !== 'none' ||
            !!args.textQuery ||
            boxIds !== null ||
            args.orderBy === 'amount';
          const txs = await ctx.transactions.list(ctx.userId, {
            type: args.type,
            from: args.from,
            to: args.to,
            includeVoided: false,
            limit: scanAll ? 500 : args.limit,
            offset: 0,
          });

          // Si llegan exactamente 500 filas, el escaneo pudo quedar truncado.
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
              args.orderBy === 'amount'
                ? [...matches].sort((a, b) => b.amount - a.amount)
                : matches;
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

          // Por caja: el asignado del mes permite detectar excesos (% del asignado).
          const allocated =
            args.groupBy === 'box'
              ? new Map(
                  (await ctx.boxes.withBalances(ctx.userId)).map((b) => [b.name, b.allocated]),
                )
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
        }),
    }),

    registerTransaction: tool({
      description: isEn
        ? `Records a transaction (expense in a box, income distributed by %, or transit). ` +
          `RULE: if it is an expense >= ${threshold} or comes from a doubtful voice transcription, ` +
          `FIRST ask the user and call this tool with userConfirmed=true only after their explicit "yes".`
        : `Registra un movimiento (gasto en una caja, ingreso que se reparte por %, o tránsito). ` +
          `REGLA: si es un gasto >= ${threshold} o viene de una transcripción de voz dudosa, ` +
          `PRIMERO pregunta al usuario y llama esta tool con userConfirmed=true solo después de su "sí".`,
      inputSchema: z.object({
        type: z.enum(TransactionType),
        boxName: z
          .string()
          .optional()
          .describe(isEn ? 'Box name (expenses only)' : 'Nombre de la caja (solo gastos)'),
        amount: z
          .number()
          .positive()
          .describe(isEn ? `Amount in ${ctx.currency}` : `Monto en ${ctx.currency}`),
        note: z.string().max(300).optional(),
        userConfirmed: z
          .boolean()
          .default(false)
          .describe(
            isEn
              ? 'true ONLY if the user has already explicitly confirmed this transaction'
              : 'true SOLO si el usuario ya confirmó explícitamente este registro',
          ),
      }),
      execute: async (args) =>
        audited(ctx, 'registerTransaction', args, async () => {
          // Guardrail server-side: el umbral no es negociable por prompt.
          if (
            args.type === TransactionType.EXPENSE &&
            args.amount >= CONFIRMATION_THRESHOLD &&
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
            const all = await ctx.boxes.findAll(ctx.userId);
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
          const tx = await ctx.transactions.create(ctx.userId, input, TransactionSource.PWA);
          // Devuelve el saldo resultante para que el bot responda con el saldo disponible.
          const balances = await ctx.boxes.withBalances(ctx.userId);
          const box = balances.find((b) => b.id === tx.boxId);
          return { registered: toTransactionDto(tx), boxBalance: box ?? null };
        }),
    }),

    getExchangeRate: tool({
      description: isEn
        ? `Current exchange rate between two currencies (ISO codes). ` +
          `Use when amounts are given in a currency other than the user's (${ctx.currency}) — do NOT ask the user for the exchange rate. ` +
          `The destination currency defaults to the user's currency (${ctx.currency}).`
        : `Tipo de cambio actual entre dos monedas (códigos ISO). ` +
          `Úsala cuando pidan montos en una moneda distinta a la del usuario (${ctx.currency}) — NO pidas el tipo de cambio al usuario. ` +
          `La moneda destino por defecto es la del usuario (${ctx.currency}).`,
      inputSchema: z.object({
        from: z
          .string()
          .length(3)
          .describe(isEn ? 'Origin currency, e.g. "USD"' : 'Moneda origen, ej "USD"'),
        // Destino con default en la moneda del usuario para el caso más común.
        to: z
          .string()
          .length(3)
          .default(ctx.currency)
          .describe(
            isEn
              ? `Destination currency (default: user's currency ${ctx.currency}), e.g. "${ctx.currency}"`
              : `Moneda destino (default: moneda del usuario ${ctx.currency}), ej "${ctx.currency}"`,
          ),
      }),
      execute: async (args) =>
        audited(ctx, 'getExchangeRate', args, async () => {
          try {
            const res = await fetch(`https://open.er-api.com/v6/latest/${args.from.toUpperCase()}`);
            if (!res.ok) {
              return {
                error: isEn
                  ? 'The exchange rate service did not respond.'
                  : 'El servicio de tipo de cambio no respondió.',
              };
            }
            const data = (await res.json()) as { rates?: Record<string, number> };
            const rate = data.rates?.[args.to.toUpperCase()];
            if (!rate) {
              return {
                error: isEn ? `No rate available for ${args.to}` : `No hay tasa para ${args.to}`,
              };
            }
            return { from: args.from.toUpperCase(), to: args.to.toUpperCase(), rate };
          } catch (err) {
            return {
              error: ctx.i18n
                ? toolErrorMessage(err, ctx.locale, ctx.i18n)
                : isEn
                  ? 'The exchange rate service did not respond.'
                  : 'El servicio de tipo de cambio no respondió.',
            };
          }
        }),
    }),

    listRecurringExpenses: tool({
      description: isEn
        ? "Lists the user's monthly fixed expenses (phone plan, subscriptions, rent) with " +
          'amount, due day, box and total monthly committed. Use for "my fixed expenses", ' +
          '"how much am I committed to", and ALWAYS before advising on box allocation.'
        : 'Lista los gastos fijos mensuales del usuario (línea celular, suscripciones, alquiler) con ' +
          'monto, día de vencimiento, caja y el total mensual comprometido. Úsala para "mis fijos", ' +
          '"cuánto tengo comprometido", y SIEMPRE antes de aconsejar sobre el reparto de cajas.',
      inputSchema: z.object({}),
      execute: async (args) =>
        audited(ctx, 'listRecurringExpenses', args, async () => ({
          items: await ctx.recurring.list(ctx.userId),
          monthlyTotal: await ctx.recurring.monthlyTotal(ctx.userId),
        })),
    }),

    addRecurringExpense: tool({
      description: isEn
        ? "Records a monthly fixed expense (NOT today's expense: it is a recurring commitment). " +
          'Mayordomo will remind via WhatsApp on the due day and only records it when the user confirms. ' +
          `E.g.: "my phone plan is ${fmt(39.9)} every 5th, comes from Miscellaneous".`
        : 'Registra un gasto fijo mensual (NO es un gasto de hoy: es un compromiso recurrente). ' +
          'El mayordomo recordará por WhatsApp el día del vencimiento y solo se anota cuando el ' +
          `usuario confirma. Ej: "mi línea celular son ${fmt(39.9)} cada día 5, sale de Varios".`,
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .max(120)
          .describe(isEn ? 'Name, e.g. "Phone plan"' : 'Nombre, ej "Línea celular"'),
        amount: z
          .number()
          .positive()
          .describe(
            isEn ? `Monthly amount in ${ctx.currency}` : `Monto mensual en ${ctx.currency}`,
          ),
        dayOfMonth: z
          .number()
          .int()
          .min(1)
          .max(31)
          .describe(isEn ? 'Day of month the expense is due' : 'Día del mes en que vence'),
        boxName: z
          .string()
          .describe(
            isEn ? 'Box to deduct from, e.g. "Miscellaneous"' : 'Caja de la que sale, ej "Varios"',
          ),
      }),
      execute: async (args) =>
        audited(ctx, 'addRecurringExpense', args, async () => {
          const all = await ctx.boxes.findAll(ctx.userId);
          const box = all.find(
            (b) => b.active && b.name.toLowerCase() === args.boxName.trim().toLowerCase(),
          );
          if (!box) {
            return {
              error: isEn
                ? `Box "${args.boxName}" does not exist`
                : `No existe la caja "${args.boxName}"`,
              availableBoxes: all.filter((b) => b.active).map((b) => b.name),
            };
          }
          const created = await ctx.recurring.create(ctx.userId, {
            name: args.name,
            amount: args.amount,
            dayOfMonth: args.dayOfMonth,
            boxId: box.id,
          });
          return {
            created,
            note: isEn
              ? 'The reminder arrives via WhatsApp on the due day; it is recorded only when the user confirms.'
              : 'El recordatorio llega por WhatsApp el día del vencimiento; se registra solo cuando el usuario confirma.',
          };
        }),
    }),

    removeRecurringExpense: tool({
      description: isEn
        ? 'Removes a fixed expense (stops reminding; history is not affected). ALWAYS ask the user for confirmation first.'
        : 'Da de baja un gasto fijo (deja de recordarse; el historial no se toca). SIEMPRE pide confirmación al usuario antes.',
      inputSchema: z.object({
        name: z
          .string()
          .describe(
            isEn ? 'Name of the fixed expense to remove' : 'Nombre del gasto fijo a dar de baja',
          ),
        userConfirmed: z.boolean().default(false),
      }),
      execute: async (args) =>
        audited(ctx, 'removeRecurringExpense', args, async () => {
          const items = await ctx.recurring.list(ctx.userId);
          const match = items.find((i) => i.name.toLowerCase() === args.name.trim().toLowerCase());
          if (!match) {
            return {
              error: isEn
                ? `No fixed expense named "${args.name}" found`
                : `No hay un gasto fijo llamado "${args.name}"`,
              available: items.map((i) => i.name),
            };
          }
          if (!args.userConfirmed) {
            return {
              needsConfirmation: true,
              item: match,
              message: isEn
                ? 'Ask the user for confirmation before removing this fixed expense.'
                : 'Pide confirmación antes de dar de baja este gasto fijo.',
            };
          }
          return { removed: await ctx.recurring.deactivate(ctx.userId, match.id) };
        }),
    }),

    updateAllocation: tool({
      description: isEn
        ? 'Changes the budget: the % allocation of active personal boxes. The resulting set ' +
          'must sum EXACTLY 100 — include in items only the boxes that change; the rest keep their %. ' +
          'Applies ONLY to future income (history retains its allocation). ' +
          'RULE: first show the user the complete new allocation (box by box) and call with ' +
          'userConfirmed=true only after their explicit "yes".'
        : 'Cambia el presupuesto: los % de reparto de las cajas personales activas. El set resultante ' +
          'debe sumar EXACTAMENTE 100 — incluye en items solo las cajas que cambian; el resto conserva su %. ' +
          'Aplica SOLO a ingresos futuros (el historial conserva su reparto). ' +
          'REGLA: primero muestra al usuario el reparto nuevo completo (caja por caja) y llama con ' +
          'userConfirmed=true solo después de su "sí" explícito.',
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              boxName: z
                .string()
                .describe(
                  isEn ? 'Exact box name, e.g. "Savings"' : 'Nombre exacto de la caja, ej "Ahorro"',
                ),
              pct: z
                .number()
                .min(0)
                .max(100)
                .describe(isEn ? 'New % for that box' : 'Nuevo % para esa caja'),
            }),
          )
          .min(1),
        userConfirmed: z
          .boolean()
          .default(false)
          .describe(
            isEn
              ? 'true ONLY if the user has already confirmed the new allocation'
              : 'true SOLO si el usuario ya confirmó el nuevo reparto',
          ),
      }),
      execute: async (args) =>
        audited(ctx, 'updateAllocation', args, async () => {
          const personal = await ctx.boxes.activePersonal(ctx.userId);
          const byName = new Map(personal.map((b) => [b.name.toLowerCase(), b]));

          const items: { id: string; pct: number }[] = [];
          for (const item of args.items) {
            const box = byName.get(item.boxName.trim().toLowerCase());
            if (!box) {
              return {
                error: isEn
                  ? `Box "${item.boxName}" does not exist (or does not participate in personal allocation)`
                  : `No existe la caja "${item.boxName}" (o no participa del reparto personal)`,
                availableBoxes: personal.map((b) => b.name),
              };
            }
            items.push({ id: box.id, pct: item.pct });
          }

          // Reparto resultante: lo que cambia + lo que se conserva.
          const changed = new Map(items.map((i) => [i.id, i.pct]));
          const proposed = personal.map((b) => ({
            boxName: b.name,
            pct: changed.get(b.id) ?? parseFloat(b.pct),
          }));
          const total = Math.round(proposed.reduce((s, p) => s + p.pct, 0) * 100) / 100;

          // Guardrail server-side: cambiar el presupuesto SIEMPRE pide confirmación.
          if (!args.userConfirmed) {
            return {
              needsConfirmation: true,
              proposedAllocation: proposed,
              total,
              message:
                total === 100
                  ? isEn
                    ? 'Show this allocation to the user and ask for confirmation before applying.'
                    : 'Muestra este reparto al usuario y pide confirmación antes de aplicar.'
                  : isEn
                    ? `The proposed allocation sums ${total}%, not 100%. Adjust with the user before confirming.`
                    : `El reparto propuesto suma ${total}%, no 100%. Ajusta con el usuario antes de confirmar.`,
            };
          }

          try {
            const saved = await ctx.boxes.updateAllocation(ctx.userId, { items });
            return {
              updated: saved.map((b) => ({ boxName: b.name, pct: parseFloat(b.pct) })),
              note: isEn
                ? 'Applies to future income; past income retains its allocation.'
                : 'Aplica a ingresos futuros; los ingresos pasados conservan su reparto.',
            };
          } catch (err) {
            return {
              error: ctx.i18n
                ? toolErrorMessage(err, ctx.locale, ctx.i18n)
                : err instanceof Error
                  ? err.message
                  : isEn
                    ? 'Could not update allocation'
                    : 'No se pudo actualizar el reparto',
              currentAllocation: proposed,
            };
          }
        }),
    }),

    createBox: tool({
      description: isEn
        ? 'Creates a new box (envelope). It is created with 0% allocation: right after creating it, ' +
          'propose the new allocation with updateAllocation so the set sums 100 again. ' +
          'type "expense" resets monthly; "fund" accumulates (savings).'
        : 'Crea una caja (sobre) nueva. Se crea con 0% de reparto: justo después de crearla, ' +
          'propón el nuevo reparto con updateAllocation para que el set vuelva a sumar 100. ' +
          'type "expense" reinicia cada mes; "fund" acumula (ahorro).',
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .max(60)
          .describe(isEn ? 'Box name, e.g. "Gym"' : 'Nombre de la caja, ej "Gimnasio"'),
        type: z
          .enum(BoxType)
          .default(BoxType.EXPENSE)
          .describe(
            isEn ? 'expense (monthly) | fund (accumulates)' : 'expense (mensual) | fund (acumula)',
          ),
      }),
      execute: async (args) =>
        audited(ctx, 'createBox', args, async () => {
          const all = await ctx.boxes.findAll(ctx.userId);
          const duplicate = all.find(
            (b) => b.name.toLowerCase() === args.name.trim().toLowerCase(),
          );
          if (duplicate) {
            return {
              error: isEn
                ? `A box named "${duplicate.name}" already exists`
                : `Ya existe una caja llamada "${duplicate.name}"`,
              ...(duplicate.active
                ? {}
                : {
                    hint: isEn
                      ? 'That box is inactive: you can reactivate it with updateBox (active=true) instead of creating a new one.'
                      : 'Esa caja está inactiva: puedes reactivarla con updateBox (active=true) en vez de crear una nueva.',
                  }),
            };
          }
          const box = await ctx.boxes.create(ctx.userId, {
            name: args.name.trim(),
            pct: 0,
            type: args.type,
            scope: BoxScope.PERSONAL,
          });
          return {
            created: toBoxDto(box),
            note: isEn
              ? 'The box was created with 0% allocation: propose the new allocation with updateAllocation so the set sums 100 again.'
              : 'La caja quedó con 0% de reparto: propón el nuevo reparto con updateAllocation para que el set vuelva a sumar 100.',
          };
        }),
    }),

    updateBox: tool({
      description: isEn
        ? 'Renames, activates or deactivates an existing box. Structural change: ALWAYS ask the user ' +
          'for confirmation first (userConfirmed=true only after an explicit yes). To change %, use ' +
          'updateAllocation. Deactivating a box with % > 0 leaves the allocation below 100: propose ' +
          'a rebalance with updateAllocation right after.'
        : 'Renombra, activa o desactiva una caja existente. Cambio estructural: SIEMPRE pide confirmación ' +
          'al usuario antes (userConfirmed=true solo tras su sí explícito). Para cambiar %, usa ' +
          'updateAllocation. Desactivar una caja con % > 0 deja el reparto debajo de 100: propón ' +
          'un rebalanceo con updateAllocation justo después.',
      inputSchema: z.object({
        boxName: z.string().describe(isEn ? 'Current exact box name' : 'Nombre exacto actual'),
        newName: z.string().min(1).max(60).optional(),
        active: z.boolean().optional(),
        userConfirmed: z.boolean().default(false),
      }),
      execute: async (args) =>
        audited(ctx, 'updateBox', args, async () => {
          if (args.newName === undefined && args.active === undefined) {
            return {
              error: isEn ? 'Provide newName and/or active.' : 'Indica newName y/o active.',
            };
          }
          const all = await ctx.boxes.findAll(ctx.userId);
          const box = all.find((b) => b.name.toLowerCase() === args.boxName.trim().toLowerCase());
          if (!box) {
            return {
              error: isEn
                ? `No box named "${args.boxName}" exists`
                : `No existe una caja llamada "${args.boxName}"`,
              availableBoxes: all.filter((b) => b.active).map((b) => b.name),
            };
          }
          if (args.newName !== undefined) {
            const duplicate = all.find(
              (b) => b.id !== box.id && b.name.toLowerCase() === args.newName!.trim().toLowerCase(),
            );
            if (duplicate) {
              return {
                error: isEn
                  ? `A box named "${duplicate.name}" already exists`
                  : `Ya existe una caja llamada "${duplicate.name}"`,
              };
            }
          }
          // Guardrail server-side: cambio estructural SIEMPRE pide confirmación.
          if (!args.userConfirmed) {
            return {
              needsConfirmation: true,
              box: toBoxDto(box),
              changes: {
                ...(args.newName !== undefined ? { newName: args.newName } : {}),
                ...(args.active !== undefined ? { active: args.active } : {}),
              },
              message: isEn
                ? 'Show the change to the user and ask for confirmation before applying.'
                : 'Muestra el cambio al usuario y pide confirmación antes de aplicar.',
            };
          }
          const updated = await ctx.boxes.update(
            ctx.userId,
            box.id,
            {
              ...(args.newName !== undefined ? { name: args.newName.trim() } : {}),
              ...(args.active !== undefined ? { active: args.active } : {}),
            },
            ctx.locale,
          );
          const pct = parseFloat(updated.pct);
          if (args.active === false && pct > 0) {
            return {
              updated: toBoxDto(updated),
              warning: isEn
                ? `The deactivated box had ${pct}%: the active allocation no longer sums 100. Propose a rebalance with updateAllocation.`
                : `La caja desactivada tenía ${pct}%: el reparto activo ya no suma 100. Propón un rebalanceo con updateAllocation.`,
            };
          }
          return { updated: toBoxDto(updated) };
        }),
    }),

    voidTransaction: tool({
      description: isEn
        ? 'Voids a transaction (soft delete, recalculates balances). ALWAYS ask the user for confirmation before voiding.'
        : 'Anula un movimiento (soft delete, recalcula saldos). SIEMPRE pide confirmación al usuario antes de anular.',
      inputSchema: z.object({
        transactionId: z.string().uuid(),
        userConfirmed: z.boolean().default(false),
      }),
      execute: async (args) =>
        audited(ctx, 'voidTransaction', args, async () => {
          if (!args.userConfirmed) {
            return {
              needsConfirmation: true,
              message: isEn
                ? 'Ask for confirmation before voiding.'
                : 'Pide confirmación antes de anular.',
            };
          }
          const tx = await ctx.transactions.void(ctx.userId, args.transactionId);
          return { voided: toTransactionDto(tx) };
        }),
    }),

    update_preferences: tool({
      description: isEn
        ? "Updates the user's language and/or currency preferences. " +
          'Use when the user says things like "speak to me in Spanish", "use dollars", "switch to English", "change my currency to EUR". ' +
          'When changing currency: WARN the user that historical amounts are NOT converted — only the symbol and format change going forward.'
        : 'Actualiza el idioma y/o la moneda del usuario. ' +
          'Úsala cuando el usuario diga cosas como "háblame en inglés", "usa dólares", "cambia a inglés", "cambia mi moneda a EUR". ' +
          'Al cambiar la moneda: ADVIERTE al usuario que los montos históricos NO se convierten — solo cambia el símbolo y formato a futuro.',
      inputSchema: z.object({
        language: localeSchema
          .optional()
          .describe(
            isEn
              ? 'New language: "es" (Spanish) or "en" (English)'
              : 'Nuevo idioma: "es" (español) o "en" (inglés)',
          ),
        currency: currencySchema
          .optional()
          .describe(
            isEn
              ? `New currency (ISO 4217). Supported: ${SUPPORTED_CURRENCIES.join(', ')}`
              : `Nueva moneda (ISO 4217). Soportadas: ${SUPPORTED_CURRENCIES.join(', ')}`,
          ),
      }),
      execute: async (args) =>
        audited(ctx, 'update_preferences', args, async () => {
          // Al menos uno de los dos campos debe estar presente (validación de dominio).
          if (args.language === undefined && args.currency === undefined) {
            return {
              error: isEn
                ? 'Provide at least language or currency to update.'
                : 'Indicar al menos language o currency para actualizar.',
            };
          }

          const user = await ctx.users.findById(ctx.userId);
          if (!user) {
            return {
              error: isEn ? 'User not found.' : 'Usuario no encontrado.',
            };
          }

          await ctx.users.updatePreferences(user, {
            language: args.language,
            currency: args.currency,
          });

          const newLang = args.language ?? user.language;
          const newCurrency = args.currency ?? user.currency ?? ctx.currency;

          // El resultado instruye al agente a cambiar de idioma y/o moneda inmediatamente.
          const parts: string[] = [];
          if (args.language !== undefined) {
            parts.push(
              isEn
                ? `Language updated to "${args.language}". From now on respond in ${args.language === 'en' ? 'English' : 'Spanish'}.`
                : `Idioma actualizado a "${args.language}". De ahora en adelante responde en ${args.language === 'en' ? 'inglés' : 'español'}.`,
            );
          }
          if (args.currency !== undefined) {
            parts.push(
              isEn
                ? `Currency updated to ${args.currency}. IMPORTANT: historical amounts are NOT converted — only the symbol and format change from now on.`
                : `Moneda actualizada a ${args.currency}. IMPORTANTE: los montos históricos NO se convierten — solo cambia el símbolo y formato a partir de ahora.`,
            );
          }

          return {
            updated: { language: newLang, currency: newCurrency },
            instruction: parts.join(' '),
          };
        }),
    }),
  };
}
