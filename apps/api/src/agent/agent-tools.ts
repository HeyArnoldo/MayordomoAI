import { tool, ToolSet } from 'ai';
import { z } from 'zod';
import { Repository } from 'typeorm';
import { CreateTransactionInput, TransactionSource, TransactionType } from '@app/contracts';
import { BoxesService } from '../boxes/boxes.service';
import { TransactionsService, toTransactionDto } from '../transactions/transactions.service';
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
        'Lista movimientos del usuario con filtros opcionales. Fechas en YYYY-MM-DD (zona America/Lima). Úsala para "qué gasté", "movimientos de ayer/esta semana".',
      inputSchema: z.object({
        type: z.enum(TransactionType).optional().describe('income | expense | transit'),
        boxName: z.string().optional().describe('Nombre de la caja, ej "Ocio"'),
        from: z.string().optional().describe('Fecha desde, YYYY-MM-DD'),
        to: z.string().optional().describe('Fecha hasta, YYYY-MM-DD'),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: async (args) =>
        audited(ctx, 'listTransactions', args, async () => {
          let boxId: string | undefined;
          if (args.boxName) {
            const all = await ctx.boxes.findAll(ctx.userId);
            boxId = all.find((b) => b.name.toLowerCase() === args.boxName!.toLowerCase())?.id;
            if (!boxId) return { error: `No existe una caja llamada "${args.boxName}"` };
          }
          const txs = await ctx.transactions.list(ctx.userId, {
            type: args.type,
            boxId,
            from: args.from,
            to: args.to,
            includeVoided: false,
            limit: args.limit,
            offset: 0,
          });
          return txs.map(toTransactionDto);
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
