import { tool, ToolSet } from 'ai';
import { z } from 'zod';
import { Repository } from 'typeorm';
import {
  BoxMode,
  BoxScope,
  BoxType,
  Locale,
  localeSchema,
  currencySchema,
  SUPPORTED_CURRENCIES,
  TransactionType,
} from '@app/contracts';
import { formatMoney } from '@app/i18n';
import { BoxesService, toBoxDto } from '../boxes/boxes.service';
import { TransactionsService, toTransactionDto } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import type { I18nService } from '../i18n/i18n.service';
import { ToolAudit } from './tool-audit.entity';
import { toolErrorMessage } from './tool-error.helper';
import { AgentToolExecutorService } from './agent-tool-executor.service';

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
  users: UsersService;
  /** OnboardingService — required for confirmOnboarding tool; optional for backward compat. */
  onboarding?: OnboardingService;
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

/** Audita y ejecuta: cada tool pasa por acá.
 *
 * Punto central de manejo de errores: si la tool (o un servicio que invoca)
 * lanza una excepción, se traduce vía toolErrorMessage al idioma del usuario y
 * se devuelve como `{ error }` para que el LLM la vea localizada — cerrando la
 * fuga de mensajes en inglés cuando un AppException de servicio escapa del
 * execute sin catch propio. Sin ctx.i18n se conserva el comportamiento previo
 * (re-throw), evitando regresiones en entornos sin i18n.
 */
async function audited<T>(
  ctx: AgentToolsContext,
  toolName: string,
  args: unknown,
  run: () => Promise<T>,
): Promise<T | { error: string }> {
  let result: T;
  try {
    result = await run();
  } catch (err) {
    if (!ctx.i18n) throw err;
    const errorResult = { error: toolErrorMessage(err, ctx.locale, ctx.i18n) };
    await ctx.audits.save(
      ctx.audits.create({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        tool: toolName,
        args,
        result: errorResult,
      }),
    );
    return errorResult;
  }
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

export function buildAgentTools(
  ctx: AgentToolsContext,
  executor?: AgentToolExecutorService,
): ToolSet {
  // Build or reuse executor. When omitted (in-app agent path), construct from
  // ctx service handles so agent-tools.spec.ts stays green without DI changes.
  const exec =
    executor ?? new AgentToolExecutorService(ctx.boxes, ctx.transactions, ctx.users, ctx.audits);

  // Per-call context for the executor (strips service handles).
  const ec = {
    userId: ctx.userId,
    conversationId: ctx.conversationId,
    locale: ctx.locale,
    currency: ctx.currency,
    i18n: ctx.i18n,
  };

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
      execute: async (_args) => exec.getBoxBalances(ec),
    }),

    queryTransactions: tool({
      description: isEn
        ? "Flexible query over the user's transactions: filtering, text search and aggregation in ONE tool. " +
          'ALL filters are optional: without type it returns income+expenses; without boxNames it searches ALL boxes; ' +
          'without dates it returns the most recent. textQuery searches the note ("taxi", "supermarket"). ' +
          'groupBy=box/day/week/month aggregates with total, count and average per group — use it for ' +
          '"where am I overspending", "which box do I spend the most in", monthly comparisons. ' +
          'orderBy=amount for the biggest expenses. Dates in YYYY-MM-DD (America/Lima timezone).'
        : 'Consulta flexible sobre los movimientos del usuario: filtros, búsqueda por texto y agregación en UNA tool. ' +
          'TODOS los filtros son opcionales: sin type trae ingresos+gastos; sin boxNames busca en TODAS las cajas; ' +
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
              ? 'income | expense. OMIT for all types.'
              : 'income | expense. OMITIR para todos los tipos.',
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
      execute: async (args) => exec.queryTransactions(ec, args),
    }),

    registerTransaction: tool({
      description: isEn
        ? `Records a transaction (expense in a box, or income distributed by %). ` +
          `RULE: if it is an expense >= ${threshold} or comes from a doubtful voice transcription, ` +
          `FIRST ask the user and call this tool with userConfirmed=true only after their explicit "yes".`
        : `Registra un movimiento (gasto en una caja, o ingreso que se reparte por %). ` +
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
      execute: async (args) => exec.registerTransaction(ec, args),
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
        ? "Lists the user's fixed-mode expense boxes (previously called recurring expenses). " +
          'Use for "my fixed expenses", "how much am I committed to", and ALWAYS before advising on box allocation. ' +
          'To add a new fixed expense, use createBox with mode=fixed. To remove one, use updateBox with active=false.'
        : 'Lista las cajas de gasto de monto fijo del usuario (antes llamadas gastos recurrentes). ' +
          'Úsala para "mis fijos", "cuánto tengo comprometido", y SIEMPRE antes de aconsejar sobre el reparto de cajas. ' +
          'Para agregar un gasto fijo usa createBox con mode=fixed. Para darlo de baja, usa updateBox con active=false.',
      inputSchema: z.object({}),
      execute: async (args) =>
        audited(ctx, 'listRecurringExpenses', args, async () => {
          const all = await ctx.boxes.findAll(ctx.userId);
          const fixedExpenseBoxes = all.filter(
            (b) => b.active && b.mode === BoxMode.FIXED && b.type === 'expense',
          );
          const monthlyTotal = fixedExpenseBoxes.reduce(
            (sum, b) => sum + (b.fixedAmount != null ? parseFloat(b.fixedAmount) : 0),
            0,
          );
          return {
            items: fixedExpenseBoxes.map((b) => ({
              id: b.id,
              name: b.name,
              fixedAmount: b.fixedAmount != null ? parseFloat(b.fixedAmount) : 0,
            })),
            monthlyTotal: Math.round(monthlyTotal * 100) / 100,
          };
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
        ? 'Creates a new box (envelope). ' +
          'For percent mode (default): created with 0% allocation — right after, propose the new allocation with updateAllocation so the set sums 100 again. ' +
          'For fixed mode: provide fixedAmount (monthly amount off-the-top). Fixed mode is personal-only. ' +
          'type "expense" resets monthly; "fund" accumulates (savings).'
        : 'Crea una caja (sobre) nueva. ' +
          'Modo percent (default): se crea con 0% de reparto — justo después propón el nuevo reparto con updateAllocation para que vuelva a sumar 100. ' +
          'Modo fixed: indica fixedAmount (monto fijo mensual, descontado primero). Solo para cajas personales. ' +
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
        mode: z
          .enum(BoxMode)
          .default(BoxMode.PERCENT)
          .describe(
            isEn
              ? 'percent (default, uses % of income) | fixed (off-the-top monthly amount, personal only)'
              : 'percent (default, usa % del ingreso) | fixed (monto fijo mensual, solo personal)',
          ),
        fixedAmount: z
          .number()
          .positive()
          .optional()
          .describe(
            isEn
              ? `Monthly fixed amount in ${ctx.currency}. Required when mode=fixed.`
              : `Monto fijo mensual en ${ctx.currency}. Requerido cuando mode=fixed.`,
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
            mode: args.mode,
            fixedAmount: args.fixedAmount ?? null,
          });
          const note =
            args.mode === BoxMode.FIXED
              ? isEn
                ? `Fixed box created with monthly amount of ${fmt(args.fixedAmount ?? 0)}.`
                : `Caja fija creada con monto mensual de ${fmt(args.fixedAmount ?? 0)}.`
              : isEn
                ? 'The box was created with 0% allocation: propose the new allocation with updateAllocation so the set sums 100 again.'
                : 'La caja quedó con 0% de reparto: propón el nuevo reparto con updateAllocation para que el set vuelva a sumar 100.';
          return { created: toBoxDto(box), note };
        }),
    }),

    updateBox: tool({
      description: isEn
        ? 'Renames, activates, deactivates, or switches the mode of an existing box. ' +
          'Structural change: ALWAYS ask the user for confirmation first (userConfirmed=true only after an explicit yes). ' +
          'To change % allocation only, use updateAllocation. ' +
          'To switch to fixed mode: provide mode=fixed + fixedAmount. ' +
          'Deactivating a percent box with % > 0 leaves the allocation below 100: propose a rebalance right after.'
        : 'Renombra, activa, desactiva o cambia el modo de una caja existente. ' +
          'Cambio estructural: SIEMPRE pide confirmación al usuario antes (userConfirmed=true solo tras su sí explícito). ' +
          'Para cambiar solo el %, usa updateAllocation. ' +
          'Para cambiar a modo fijo: indica mode=fixed + fixedAmount. ' +
          'Desactivar una caja percent con % > 0 deja el reparto debajo de 100: propón un rebalanceo después.',
      inputSchema: z.object({
        boxName: z.string().describe(isEn ? 'Current exact box name' : 'Nombre exacto actual'),
        newName: z.string().min(1).max(60).optional(),
        active: z.boolean().optional(),
        mode: z
          .enum(BoxMode)
          .optional()
          .describe(
            isEn
              ? 'Switch to percent or fixed mode. When switching to fixed, also provide fixedAmount.'
              : 'Cambia a modo percent o fixed. Al cambiar a fixed, también indica fixedAmount.',
          ),
        fixedAmount: z
          .number()
          .positive()
          .optional()
          .describe(
            isEn
              ? `New monthly fixed amount in ${ctx.currency}. Required when mode=fixed.`
              : `Nuevo monto fijo mensual en ${ctx.currency}. Requerido cuando mode=fixed.`,
          ),
        userConfirmed: z.boolean().default(false),
      }),
      execute: async (args) =>
        audited(ctx, 'updateBox', args, async () => {
          if (
            args.newName === undefined &&
            args.active === undefined &&
            args.mode === undefined &&
            args.fixedAmount === undefined
          ) {
            return {
              error: isEn
                ? 'Provide at least one of: newName, active, mode, fixedAmount.'
                : 'Indica al menos uno de: newName, active, mode, fixedAmount.',
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
                ...(args.mode !== undefined ? { mode: args.mode } : {}),
                ...(args.fixedAmount !== undefined ? { fixedAmount: args.fixedAmount } : {}),
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
              ...(args.mode !== undefined ? { mode: args.mode } : {}),
              ...(args.fixedAmount !== undefined ? { fixedAmount: args.fixedAmount } : {}),
            },
            ctx.locale,
          );
          const pct = parseFloat(updated.pct);
          const updatedMode = updated.mode ?? BoxMode.PERCENT;
          if (args.active === false && updatedMode === BoxMode.PERCENT && pct > 0) {
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

    confirmOnboarding: tool({
      description: isEn
        ? 'Marks the AI onboarding flow as complete. Call this ONLY after: (1) all desired boxes have been created, (2) all active percent-mode boxes sum to exactly 100%, and (3) the user has confirmed the setup looks correct. Calling this exits onboarding mode and switches the agent to standard mode for future messages.'
        : 'Marca el flujo de onboarding de IA como completado. Llama a esta tool SOLO después de: (1) todas las cajas deseadas fueron creadas, (2) las cajas en modo percent activas suman exactamente 100%, y (3) el usuario confirmó que la configuración está correcta. Llamar esto sale del modo onboarding y cambia el agente a modo estándar para mensajes futuros.',
      inputSchema: z.object({}),
      execute: async (_args) =>
        audited(ctx, 'confirmOnboarding', _args, async () => {
          if (!ctx.onboarding) {
            return {
              error: isEn
                ? 'Onboarding service not available in this context.'
                : 'El servicio de onboarding no está disponible en este contexto.',
            };
          }
          // Validate percent-box invariant before marking complete
          const personal = await ctx.boxes.activePersonal(ctx.userId);
          const percentBoxes = personal.filter((b) => (b.mode ?? 'percent') === 'percent');
          const pctSum =
            Math.round(percentBoxes.reduce((s, b) => s + parseFloat(b.pct), 0) * 100) / 100;
          if (percentBoxes.length > 0 && pctSum !== 100) {
            return {
              error: isEn
                ? `Cannot complete onboarding: percent boxes sum to ${pctSum}%, not 100%. Adjust the allocation with updateAllocation first.`
                : `No se puede completar el onboarding: las cajas percent suman ${pctSum}%, no 100%. Ajusta el reparto con updateAllocation primero.`,
              currentPctSum: pctSum,
              percentBoxes: percentBoxes.map((b) => ({ name: b.name, pct: parseFloat(b.pct) })),
            };
          }
          await ctx.onboarding.confirmOnboarding(ctx.userId);
          return {
            completed: true,
            message: isEn
              ? 'Onboarding complete! The agent is now in standard mode.'
              : '¡Onboarding completado! El agente está ahora en modo estándar.',
          };
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
