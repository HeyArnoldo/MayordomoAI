import { tool, ToolSet } from 'ai';
import { z } from 'zod';
import { Repository } from 'typeorm';
import { CreateTransactionInput, TransactionSource, TransactionType } from '@app/contracts';
import { BoxesService } from '../boxes/boxes.service';
import { TransactionsService, toTransactionDto } from '../transactions/transactions.service';
import { RecurringService } from '../recurring/recurring.service';
import { ToolAudit } from './tool-audit.entity';

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
  audits: Repository<ToolAudit>;
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

/**
 * Resuelve nombre de caja → id. Devuelve undefined si el nombre significa
 * "todas". Si no existe, error con las cajas disponibles para que el modelo
 * se recupere solo en el siguiente paso.
 */
async function resolveBox(
  ctx: AgentToolsContext,
  boxName: string | undefined,
): Promise<{ boxId?: string; error?: { error: string; availableBoxes: string[]; hint: string } }> {
  if (!boxName || ALL_BOXES.has(boxName.trim().toLowerCase())) return {};
  const all = await ctx.boxes.findAll(ctx.userId);
  const box = all.find((b) => b.name.toLowerCase() === boxName.trim().toLowerCase());
  if (box) return { boxId: box.id };
  return {
    error: {
      error: `No existe una caja llamada "${boxName}"`,
      availableBoxes: all.filter((b) => b.active).map((b) => b.name),
      hint: 'Omite boxName para buscar en TODAS las cajas.',
    },
  };
}

/** Agrega boxName legible a cada movimiento (el modelo no debe ver solo UUIDs). */
async function withBoxNames<T extends { boxId: string | null }>(
  ctx: AgentToolsContext,
  txs: T[],
): Promise<(T & { boxName: string | null })[]> {
  const all = await ctx.boxes.findAll(ctx.userId);
  const names = new Map(all.map((b) => [b.id, b.name]));
  return txs.map((t) => ({ ...t, boxName: t.boxId ? (names.get(t.boxId) ?? null) : null }));
}

export function buildAgentTools(ctx: AgentToolsContext): ToolSet {
  return {
    getBoxBalances: tool({
      description:
        'Estado actual de todas las cajas del usuario: % asignado, monto asignado del mes, gastado, saldo disponible y acumulado (fondos). Úsala para "cómo voy", "cuánto me queda", "saldo".',
      inputSchema: z.object({}),
      execute: async (args) =>
        audited(ctx, 'getBoxBalances', args, () => ctx.boxes.withBalances(ctx.userId)),
    }),

    listTransactions: tool({
      description:
        'Lista los movimientos más recientes del usuario. TODOS los filtros son opcionales: ' +
        'sin type trae ingresos+gastos+tránsitos juntos; sin boxName busca en TODAS las cajas; ' +
        'sin fechas trae lo más reciente. Para "mis últimos N movimientos" llama SOLO con limit=N. ' +
        'Fechas en YYYY-MM-DD (zona America/Lima).',
      inputSchema: z.object({
        type: z
          .enum(TransactionType)
          .optional()
          .describe('income | expense | transit. OMITIR para todos los tipos.'),
        boxName: z
          .string()
          .optional()
          .describe('Nombre exacto de UNA caja, ej "Ocio". OMITIR para todas las cajas.'),
        from: z.string().optional().describe('Fecha desde, YYYY-MM-DD'),
        to: z.string().optional().describe('Fecha hasta, YYYY-MM-DD'),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: async (args) =>
        audited(ctx, 'listTransactions', args, async () => {
          const { boxId, error } = await resolveBox(ctx, args.boxName);
          if (error) return error;
          const txs = await ctx.transactions.list(ctx.userId, {
            type: args.type,
            boxId,
            from: args.from,
            to: args.to,
            includeVoided: false,
            limit: args.limit,
            offset: 0,
          });
          return withBoxNames(ctx, txs.map(toTransactionDto));
        }),
    }),

    searchTransactions: tool({
      description:
        'Busca movimientos por texto en la nota/descripción (ej "taxi", "Claude", "supermercado"). ' +
        'Úsala para "cuánto gasté en X", "cuándo pagué Y". Devuelve coincidencias con total sumado.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Texto a buscar en las notas'),
        from: z.string().optional().describe('Fecha desde, YYYY-MM-DD'),
        to: z.string().optional().describe('Fecha hasta, YYYY-MM-DD'),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async (args) =>
        audited(ctx, 'searchTransactions', args, async () => {
          const txs = await ctx.transactions.list(ctx.userId, {
            from: args.from,
            to: args.to,
            includeVoided: false,
            limit: 300,
            offset: 0,
          });
          const q = args.query.toLowerCase();
          const matches = txs
            .map(toTransactionDto)
            .filter((t) => t.note?.toLowerCase().includes(q))
            .slice(0, args.limit);
          const total = matches.reduce((s, t) => s + t.amount, 0);
          return { matches: await withBoxNames(ctx, matches), count: matches.length, total };
        }),
    }),

    getSpendingByBox: tool({
      description:
        'Gasto agregado POR CAJA en un rango de fechas: total, cantidad de movimientos y % del ' +
        'asignado. Úsala para "en qué me excedo", "en qué caja gasto más", comparativas del mes.',
      inputSchema: z.object({
        from: z.string().describe('Fecha desde, YYYY-MM-DD'),
        to: z.string().describe('Fecha hasta, YYYY-MM-DD'),
      }),
      execute: async (args) =>
        audited(ctx, 'getSpendingByBox', args, async () => {
          const txs = await ctx.transactions.list(ctx.userId, {
            type: TransactionType.EXPENSE,
            from: args.from,
            to: args.to,
            includeVoided: false,
            limit: 500,
            offset: 0,
          });
          const balances = await ctx.boxes.withBalances(ctx.userId);
          const byBox = new Map<string, { total: number; count: number }>();
          for (const t of txs) {
            if (!t.boxId) continue;
            const acc = byBox.get(t.boxId) ?? { total: 0, count: 0 };
            acc.total += Number(t.amount);
            acc.count += 1;
            byBox.set(t.boxId, acc);
          }
          return balances
            .filter((b) => b.active)
            .map((b) => {
              const agg = byBox.get(b.id) ?? { total: 0, count: 0 };
              return {
                boxName: b.name,
                spent: Math.round(agg.total * 100) / 100,
                movements: agg.count,
                allocated: b.allocated,
                pctOfAllocated:
                  b.allocated > 0 ? Math.round((agg.total / b.allocated) * 100) : null,
              };
            })
            .sort((a, b) => b.spent - a.spent);
        }),
    }),

    getTopExpenses: tool({
      description:
        'Los N gastos más grandes de un rango de fechas. Úsala para "mi gasto más fuerte", "en qué se me fue la plata".',
      inputSchema: z.object({
        from: z.string().describe('Fecha desde, YYYY-MM-DD'),
        to: z.string().describe('Fecha hasta, YYYY-MM-DD'),
        n: z.number().int().min(1).max(20).default(5),
      }),
      execute: async (args) =>
        audited(ctx, 'getTopExpenses', args, async () => {
          const txs = await ctx.transactions.list(ctx.userId, {
            type: TransactionType.EXPENSE,
            from: args.from,
            to: args.to,
            includeVoided: false,
            limit: 200,
            offset: 0,
          });
          const all = await ctx.boxes.findAll(ctx.userId);
          return txs
            .map(toTransactionDto)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, args.n)
            .map((t) => ({
              ...t,
              boxName: all.find((b) => b.id === t.boxId)?.name ?? null,
            }));
        }),
    }),

    registerTransaction: tool({
      description:
        `Registra un movimiento (gasto en una caja, ingreso que se reparte por %, o tránsito). ` +
        `REGLA: si es un gasto >= S/${CONFIRMATION_THRESHOLD} o viene de una transcripción de voz dudosa, ` +
        `PRIMERO pregunta al usuario y llama esta tool con userConfirmed=true solo después de su "sí".`,
      inputSchema: z.object({
        type: z.enum(TransactionType),
        boxName: z.string().optional().describe('Nombre de la caja (solo gastos)'),
        amount: z.number().positive().describe('Monto en soles (S/)'),
        note: z.string().max(300).optional(),
        userConfirmed: z
          .boolean()
          .default(false)
          .describe('true SOLO si el usuario ya confirmó explícitamente este registro'),
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
              message: `Monto alto (S/${args.amount.toFixed(2)}). Pide confirmación al usuario antes de registrar.`,
            };
          }
          let boxId: string | null | undefined;
          if (args.type === TransactionType.EXPENSE) {
            if (!args.boxName) return { error: 'Un gasto necesita el nombre de la caja' };
            const all = await ctx.boxes.findAll(ctx.userId);
            boxId = all.find((b) => b.name.toLowerCase() === args.boxName!.toLowerCase())?.id;
            if (!boxId) {
              return {
                error: `No existe la caja "${args.boxName}"`,
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
          // Devuelve el saldo resultante para que el bot responda "te quedan S/X".
          const balances = await ctx.boxes.withBalances(ctx.userId);
          const box = balances.find((b) => b.id === tx.boxId);
          return { registered: toTransactionDto(tx), boxBalance: box ?? null };
        }),
    }),

    getExchangeRate: tool({
      description:
        'Tipo de cambio actual entre dos monedas (códigos ISO, ej PEN→USD). ' +
        'Úsala cuando pidan montos en dólares u otra moneda — NO pidas el tipo de cambio al usuario.',
      inputSchema: z.object({
        from: z.string().length(3).describe('Moneda origen, ej "PEN"'),
        to: z.string().length(3).describe('Moneda destino, ej "USD"'),
      }),
      execute: async (args) =>
        audited(ctx, 'getExchangeRate', args, async () => {
          try {
            const res = await fetch(`https://open.er-api.com/v6/latest/${args.from.toUpperCase()}`);
            if (!res.ok) return { error: 'El servicio de tipo de cambio no respondió.' };
            const data = (await res.json()) as { rates?: Record<string, number> };
            const rate = data.rates?.[args.to.toUpperCase()];
            if (!rate) return { error: `No hay tasa para ${args.to}` };
            return { from: args.from.toUpperCase(), to: args.to.toUpperCase(), rate };
          } catch {
            return { error: 'El servicio de tipo de cambio no respondió.' };
          }
        }),
    }),

    listRecurringExpenses: tool({
      description:
        'Lista los gastos fijos mensuales del usuario (línea celular, suscripciones, alquiler) con ' +
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
      description:
        'Registra un gasto fijo mensual (NO es un gasto de hoy: es un compromiso recurrente). ' +
        'El mayordomo recordará por WhatsApp el día del vencimiento y solo se anota cuando el ' +
        'usuario confirma. Ej: "mi línea celular son 39.90 cada día 5, sale de Varios".',
      inputSchema: z.object({
        name: z.string().min(1).max(120).describe('Nombre, ej "Línea celular"'),
        amount: z.number().positive().describe('Monto mensual en soles'),
        dayOfMonth: z.number().int().min(1).max(31).describe('Día del mes en que vence'),
        boxName: z.string().describe('Caja de la que sale, ej "Varios"'),
      }),
      execute: async (args) =>
        audited(ctx, 'addRecurringExpense', args, async () => {
          const all = await ctx.boxes.findAll(ctx.userId);
          const box = all.find(
            (b) => b.active && b.name.toLowerCase() === args.boxName.trim().toLowerCase(),
          );
          if (!box) {
            return {
              error: `No existe la caja "${args.boxName}"`,
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
            note: 'El recordatorio llega por WhatsApp el día del vencimiento; se registra solo cuando el usuario confirma.',
          };
        }),
    }),

    removeRecurringExpense: tool({
      description:
        'Da de baja un gasto fijo (deja de recordarse; el historial no se toca). ' +
        'SIEMPRE pide confirmación al usuario antes.',
      inputSchema: z.object({
        name: z.string().describe('Nombre del gasto fijo a dar de baja'),
        userConfirmed: z.boolean().default(false),
      }),
      execute: async (args) =>
        audited(ctx, 'removeRecurringExpense', args, async () => {
          const items = await ctx.recurring.list(ctx.userId);
          const match = items.find((i) => i.name.toLowerCase() === args.name.trim().toLowerCase());
          if (!match) {
            return {
              error: `No hay un gasto fijo llamado "${args.name}"`,
              available: items.map((i) => i.name),
            };
          }
          if (!args.userConfirmed) {
            return {
              needsConfirmation: true,
              item: match,
              message: 'Pide confirmación antes de dar de baja este gasto fijo.',
            };
          }
          return { removed: await ctx.recurring.deactivate(ctx.userId, match.id) };
        }),
    }),

    updateAllocation: tool({
      description:
        'Cambia el presupuesto: los % de reparto de las cajas personales activas. El set resultante ' +
        'debe sumar EXACTAMENTE 100 — incluye en items solo las cajas que cambian; el resto conserva su %. ' +
        'Aplica SOLO a ingresos futuros (el historial conserva su reparto). ' +
        'REGLA: primero muestra al usuario el reparto nuevo completo (caja por caja) y llama con ' +
        'userConfirmed=true solo después de su "sí" explícito.',
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              boxName: z.string().describe('Nombre exacto de la caja, ej "Ahorro"'),
              pct: z.number().min(0).max(100).describe('Nuevo % para esa caja'),
            }),
          )
          .min(1),
        userConfirmed: z
          .boolean()
          .default(false)
          .describe('true SOLO si el usuario ya confirmó el nuevo reparto'),
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
                error: `No existe la caja "${item.boxName}" (o no participa del reparto personal)`,
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
                  ? 'Muestra este reparto al usuario y pide confirmación antes de aplicar.'
                  : `El reparto propuesto suma ${total}%, no 100%. Ajusta con el usuario antes de confirmar.`,
            };
          }

          try {
            const saved = await ctx.boxes.updateAllocation(ctx.userId, { items });
            return {
              updated: saved.map((b) => ({ boxName: b.name, pct: parseFloat(b.pct) })),
              note: 'Aplica a ingresos futuros; los ingresos pasados conservan su reparto.',
            };
          } catch (err) {
            return {
              error: err instanceof Error ? err.message : 'No se pudo actualizar el reparto',
              currentAllocation: proposed,
            };
          }
        }),
    }),

    voidTransaction: tool({
      description:
        'Anula un movimiento (soft delete, recalcula saldos). SIEMPRE pide confirmación al usuario antes de anular.',
      inputSchema: z.object({
        transactionId: z.string().uuid(),
        userConfirmed: z.boolean().default(false),
      }),
      execute: async (args) =>
        audited(ctx, 'voidTransaction', args, async () => {
          if (!args.userConfirmed) {
            return { needsConfirmation: true, message: 'Pide confirmación antes de anular.' };
          }
          const tx = await ctx.transactions.void(ctx.userId, args.transactionId);
          return { voided: toTransactionDto(tx) };
        }),
    }),
  };
}
