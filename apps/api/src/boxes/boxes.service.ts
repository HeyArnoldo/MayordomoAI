import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AllocationInput,
  Box as BoxDto,
  BoxBalance,
  BoxScope,
  BoxType,
  CreateBoxInput,
  DEFAULT_LOCALE,
  Locale,
  UpdateBoxInput,
} from '@app/contracts';
import { accountingMonth, fromCents, isValidPctSum, toCents } from '../common/money';
import { I18nService } from '../i18n/i18n.service';
import { Box } from './box.entity';

/**
 * Set por defecto para una cuenta nueva — el mismo del design. Los nombres se
 * resuelven en el idioma del usuario AL CREARLAS (keys `defaultBoxes.*` del
 * namespace api); después son data del usuario y no se tocan.
 */
const DEFAULT_BOXES: Array<{ nameKey: string; pct: number; type: BoxType }> = [
  { nameKey: 'defaultBoxes.savings', pct: 25, type: BoxType.FUND },
  { nameKey: 'defaultBoxes.misc', pct: 20, type: BoxType.EXPENSE },
  { nameKey: 'defaultBoxes.transport', pct: 15, type: BoxType.EXPENSE },
  { nameKey: 'defaultBoxes.leisure', pct: 15, type: BoxType.EXPENSE },
  { nameKey: 'defaultBoxes.tithe', pct: 10, type: BoxType.EXPENSE },
  { nameKey: 'defaultBoxes.snacks', pct: 10, type: BoxType.EXPENSE },
  { nameKey: 'defaultBoxes.offering', pct: 5, type: BoxType.EXPENSE },
];

export function toBoxDto(b: Box): BoxDto {
  return {
    id: b.id,
    name: b.name,
    pct: parseFloat(b.pct),
    type: b.type,
    scope: b.scope,
    colorKey: b.colorKey,
    sortOrder: b.sortOrder,
    active: b.active,
    createdAt: b.createdAt.toISOString(),
  };
}

@Injectable()
export class BoxesService {
  constructor(
    @InjectRepository(Box) private readonly repo: Repository<Box>,
    private readonly i18n: I18nService,
  ) {}

  findAll(userId: string): Promise<Box[]> {
    return this.repo.find({ where: { userId }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async findOne(userId: string, id: string, locale: Locale = DEFAULT_LOCALE): Promise<Box> {
    const box = await this.repo.findOne({ where: { id, userId } });
    if (!box) throw new NotFoundException(this.i18n.t(locale, 'errors.boxNotFound'));
    return box;
  }

  /** Cajas activas de ámbito personal — las que participan del reparto por %. */
  activePersonal(userId: string): Promise<Box[]> {
    return this.repo.find({
      where: { userId, active: true, scope: BoxScope.PERSONAL },
      order: { sortOrder: 'ASC' },
    });
  }

  async create(userId: string, input: CreateBoxInput): Promise<Box> {
    const max = await this.repo.maximum('sortOrder', { userId });
    return this.repo.save(
      this.repo.create({
        userId,
        name: input.name,
        pct: input.pct.toFixed(2),
        type: input.type,
        scope: input.scope,
        colorKey: input.colorKey ?? null,
        sortOrder: input.sortOrder ?? (max ?? 0) + 1,
      }),
    );
  }

  async update(
    userId: string,
    id: string,
    input: UpdateBoxInput,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<Box> {
    const box = await this.findOne(userId, id, locale);
    if (input.name !== undefined) box.name = input.name;
    if (input.pct !== undefined) box.pct = input.pct.toFixed(2);
    if (input.type !== undefined) box.type = input.type;
    if (input.scope !== undefined) box.scope = input.scope;
    if (input.colorKey !== undefined) box.colorKey = input.colorKey;
    if (input.sortOrder !== undefined) box.sortOrder = input.sortOrder;
    if (input.active !== undefined) box.active = input.active;
    return this.repo.save(box);
  }

  /**
   * Actualización masiva del reparto. Valida que el set personal activo
   * resultante sume EXACTAMENTE 100. Aplica solo a ingresos futuros (el
   * historial conserva su split snapshot).
   */
  async updateAllocation(
    userId: string,
    input: AllocationInput,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<Box[]> {
    const boxes = await this.activePersonal(userId);
    const byId = new Map(boxes.map((b) => [b.id, b]));
    for (const item of input.items) {
      const box = byId.get(item.id);
      if (!box)
        throw new BadRequestException(
          this.i18n.t(locale, 'errors.boxNotInAllocation', { id: item.id }),
        );
      box.pct = item.pct.toFixed(2);
    }
    const pcts = boxes.map((b) => parseFloat(b.pct));
    if (!isValidPctSum(pcts)) {
      const total = pcts.reduce((s, p) => s + p, 0);
      throw new BadRequestException(
        this.i18n.t(locale, 'errors.allocationMustSum100', { total: total.toFixed(2) }),
      );
    }
    return this.repo.save(boxes);
  }

  /** Crea el set por defecto (en el idioma del usuario) si la cuenta no tiene cajas. Idempotente. */
  async seedDefaults(userId: string, locale: Locale = DEFAULT_LOCALE): Promise<Box[]> {
    const existing = await this.findAll(userId);
    if (existing.length > 0) return existing;
    const boxes = DEFAULT_BOXES.map((b, i) =>
      this.repo.create({
        userId,
        name: this.i18n.t(locale, b.nameKey),
        pct: b.pct.toFixed(2),
        type: b.type,
        scope: BoxScope.PERSONAL,
        sortOrder: i,
      }),
    );
    return this.repo.save(boxes);
  }

  /**
   * Estado del periodo (mes contable de Lima) por caja, calculado al leer:
   *   allocated = SUM(split del periodo) · spent = SUM(gastos confirmados)
   *   balance = allocated − spent · fund además acumula histórico.
   * La verdad SIEMPRE es el SUM — el saldo no se almacena nunca.
   */
  async withBalances(userId: string, now: Date = new Date()): Promise<BoxBalance[]> {
    const { from, to } = accountingMonth(now);
    const boxes = await this.findAll(userId);

    type Row = { boxId: string; total: string };
    const [allocMonth, spentMonth, allocAll, spentAll] = (await Promise.all([
      this.repo.manager.query(
        `SELECT s->>'boxId' AS "boxId", COALESCE(SUM((s->>'amount')::numeric), 0) AS total
         FROM transactions t, jsonb_array_elements(t.split) s
         WHERE t."userId" = $1 AND t.type = 'income' AND t.status = 'confirmed'
           AND t."deletedAt" IS NULL AND t.date BETWEEN $2 AND $3
         GROUP BY 1`,
        [userId, from, to],
      ),
      this.repo.manager.query(
        `SELECT t."boxId" AS "boxId", COALESCE(SUM(t.amount), 0) AS total
         FROM transactions t
         WHERE t."userId" = $1 AND t.type = 'expense' AND t.status = 'confirmed'
           AND t."deletedAt" IS NULL AND t."boxId" IS NOT NULL AND t.date BETWEEN $2 AND $3
         GROUP BY 1`,
        [userId, from, to],
      ),
      this.repo.manager.query(
        `SELECT s->>'boxId' AS "boxId", COALESCE(SUM((s->>'amount')::numeric), 0) AS total
         FROM transactions t, jsonb_array_elements(t.split) s
         WHERE t."userId" = $1 AND t.type = 'income' AND t.status = 'confirmed'
           AND t."deletedAt" IS NULL
         GROUP BY 1`,
        [userId],
      ),
      this.repo.manager.query(
        `SELECT t."boxId" AS "boxId", COALESCE(SUM(t.amount), 0) AS total
         FROM transactions t
         WHERE t."userId" = $1 AND t.type = 'expense' AND t.status = 'confirmed'
           AND t."deletedAt" IS NULL AND t."boxId" IS NOT NULL
         GROUP BY 1`,
        [userId],
      ),
    ])) as [Row[], Row[], Row[], Row[]];

    const toMap = (rows: Row[]) => new Map(rows.map((r) => [r.boxId, parseFloat(r.total)]));
    const allocM = toMap(allocMonth);
    const spentM = toMap(spentMonth);
    const allocA = toMap(allocAll);
    const spentA = toMap(spentAll);

    // Resta en centavos: jamás aritmética de flotantes sobre montos.
    return boxes.map((b) => {
      const allocated = toCents(allocM.get(b.id) ?? 0);
      const spent = toCents(spentM.get(b.id) ?? 0);
      const isFund = b.type === BoxType.FUND;
      const accumulated = toCents(allocA.get(b.id) ?? 0) - toCents(spentA.get(b.id) ?? 0);
      return {
        ...toBoxDto(b),
        allocated: fromCents(allocated),
        spent: fromCents(spent),
        balance: fromCents(allocated - spent),
        accumulated: isFund ? fromCents(accumulated) : null,
      };
    });
  }
}
