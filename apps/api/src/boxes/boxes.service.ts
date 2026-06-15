import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AllocationInput,
  Box as BoxDto,
  BoxBalance,
  BoxMode,
  BoxScope,
  BoxType,
  CreateBoxInput,
  DEFAULT_LOCALE,
  Locale,
  UpdateBoxInput,
} from '@app/contracts';
import { AppException } from '../common/errors/app.exception';
import {
  accountingMonth,
  computeAllocation,
  fromCents,
  FundingBox,
  isValidPctSum,
  remainingToFill,
  sumFixedCents,
  toCents,
} from '../common/money';
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
    mode: b.mode ?? BoxMode.PERCENT,
    fixedAmount: b.fixedAmount != null ? parseFloat(b.fixedAmount) : null,
  };
}

/** Convert a Box entity to a FundingBox for pure money-math computations. */
function toFundingBox(b: Box): FundingBox {
  return {
    id: b.id,
    name: b.name,
    mode: b.mode ?? BoxMode.PERCENT,
    pct: parseFloat(b.pct),
    fixedAmount: b.fixedAmount != null ? parseFloat(b.fixedAmount) : null,
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
    void locale; // locale param kept for call-site compatibility; error is now code-based
    const box = await this.repo.findOne({ where: { id, userId } });
    if (!box) throw new AppException('box.not_found', HttpStatus.NOT_FOUND, 'Box not found');
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
    const mode = input.mode ?? BoxMode.PERCENT;

    // Guard: fixed mode only for personal scope
    if (mode === BoxMode.FIXED && input.scope === BoxScope.BUSINESS) {
      throw new AppException(
        'box.mode_not_supported_for_scope',
        HttpStatus.BAD_REQUEST,
        'Fixed mode is only supported for personal-scope boxes',
      );
    }

    // Guard: fixed mode requires fixedAmount > 0
    if (mode === BoxMode.FIXED && !(input.fixedAmount != null && input.fixedAmount > 0)) {
      throw new AppException(
        'box.fixed_requires_amount',
        HttpStatus.BAD_REQUEST,
        'A fixed-mode box requires a fixedAmount greater than 0',
      );
    }

    // Guard: Σ fixed must not exceed monthly income
    if (mode === BoxMode.FIXED && input.scope !== BoxScope.BUSINESS) {
      await this.assertFixedDoesNotExceedIncome(userId, input.fixedAmount ?? 0);
    }

    const max = await this.repo.maximum('sortOrder', { userId });
    return this.repo.save(
      this.repo.create({
        userId,
        name: input.name,
        pct: (input.pct ?? 0).toFixed(2),
        type: input.type,
        scope: input.scope,
        colorKey: input.colorKey ?? null,
        sortOrder: input.sortOrder ?? (max ?? 0) + 1,
        mode,
        fixedAmount: mode === BoxMode.FIXED ? (input.fixedAmount ?? 0).toFixed(2) : null,
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

    // Handle mode switch or fixedAmount update
    if (input.mode !== undefined || input.fixedAmount !== undefined) {
      const newMode = input.mode ?? box.mode ?? BoxMode.PERCENT;
      const targetScope = input.scope ?? box.scope;

      // Guard: fixed mode only for personal scope
      if (newMode === BoxMode.FIXED && targetScope === BoxScope.BUSINESS) {
        throw new AppException(
          'box.mode_not_supported_for_scope',
          HttpStatus.BAD_REQUEST,
          'Fixed mode is only supported for personal-scope boxes',
        );
      }

      // Guard: fixed mode requires fixedAmount > 0
      if (newMode === BoxMode.FIXED) {
        const newFixedAmount =
          input.fixedAmount ?? (box.fixedAmount != null ? parseFloat(box.fixedAmount) : null);
        if (!(newFixedAmount != null && newFixedAmount > 0)) {
          throw new AppException(
            'box.fixed_requires_amount',
            HttpStatus.BAD_REQUEST,
            'A fixed-mode box requires a fixedAmount greater than 0',
          );
        }

        // Guard: Σ fixed (excluding this box, adding new amount) must not exceed income
        await this.assertFixedDoesNotExceedIncome(userId, newFixedAmount, id);
        box.fixedAmount = newFixedAmount.toFixed(2);
      } else {
        // Switching to percent or already percent
        box.fixedAmount = null;
      }

      box.mode = newMode;
    }

    return this.repo.save(box);
  }

  /**
   * Actualización masiva del reparto. Valida que el set personal activo de cajas
   * en modo PERCENT sume EXACTAMENTE 100. Fixed boxes are excluded from this
   * invariant and MUST NOT be passed in items (they have no pct to update).
   * Aplica solo a ingresos futuros (el historial conserva su split snapshot).
   */
  async updateAllocation(
    userId: string,
    input: AllocationInput,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<Box[]> {
    void locale; // locale param kept for call-site compatibility; errors are now code-based
    const boxes = await this.activePersonal(userId);
    const byId = new Map(boxes.map((b) => [b.id, b]));

    for (const item of input.items) {
      const box = byId.get(item.id);
      if (!box)
        throw new AppException(
          'box.not_in_allocation',
          HttpStatus.BAD_REQUEST,
          `Box ${item.id} is not part of the active allocation`,
          { id: item.id },
        );
      // Fixed boxes have no pct to update via this endpoint
      if ((box.mode ?? BoxMode.PERCENT) === BoxMode.FIXED) continue;
      box.pct = item.pct.toFixed(2);
    }

    // Validate only PERCENT boxes sum to 100 (fixed boxes excluded)
    const pctBoxes = boxes.filter((b) => (b.mode ?? BoxMode.PERCENT) === BoxMode.PERCENT);
    const pcts = pctBoxes.map((b) => parseFloat(b.pct));
    if (!isValidPctSum(pcts)) {
      const total = pcts.reduce((s, p) => s + p, 0);
      throw new AppException(
        'box.allocation_must_sum_100',
        HttpStatus.BAD_REQUEST,
        `Allocation must sum to 100 (currently ${total.toFixed(2)})`,
        { total: total.toFixed(2) },
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
   * Helper: assert that adding `newFixedAmount` to the user's fixed-box pool does
   * not exceed the accounting-month income SUM (identical income source as withBalances).
   * Pass `excludeBoxId` when updating an existing fixed box (exclude its current amount).
   *
   * Income source (S1-D1 confirmed): Σ income split amounts for the accounting month
   * (the same allocM SUM from withBalances — NOT a single income event).
   */
  private async assertFixedDoesNotExceedIncome(
    userId: string,
    newFixedAmount: number,
    excludeBoxId?: string,
  ): Promise<void> {
    const now = new Date();
    const { from, to } = accountingMonth(now);

    // SUM of income split amounts for the accounting month (same query as allocM in withBalances)
    const incomeRows = (await this.repo.manager.query(
      `SELECT COALESCE(SUM((s->>'amount')::numeric), 0) AS total
       FROM transactions t, jsonb_array_elements(t.split) s
       WHERE t."userId" = $1 AND t.type = 'income' AND t.status = 'confirmed'
         AND t."deletedAt" IS NULL AND t.date BETWEEN $2 AND $3`,
      [userId, from, to],
    )) as Array<{ total: string }>;

    const incomeCents = toCents(parseFloat(incomeRows[0]?.total ?? '0'));

    // Get all existing active personal fixed boxes (excluding the box being updated)
    const existingFixed = await this.repo.find({
      where: { userId, active: true, scope: BoxScope.PERSONAL, mode: BoxMode.FIXED },
    });
    const existingFixedBoxes = existingFixed.filter((b) => b.id !== excludeBoxId).map(toFundingBox);

    const existingFixedCents = sumFixedCents(existingFixedBoxes);
    const proposedFixedCents = existingFixedCents + toCents(newFixedAmount);

    // Only enforce the guard when income is known (> 0) AND fixed strictly exceeds it.
    // income = 0  → no income recorded yet (e.g. new user); guard does not fire.
    // fixed = income → entire income committed to fixed envelopes; valid (remainder 0).
    if (incomeCents > 0 && proposedFixedCents > incomeCents) {
      throw new AppException(
        'box.fixed_exceeds_income',
        HttpStatus.UNPROCESSABLE_ENTITY,
        `Total fixed boxes would exceed monthly income`,
        {
          fixedTotal: fromCents(proposedFixedCents),
          income: fromCents(incomeCents),
        },
      );
    }
  }

  /**
   * Estado del periodo (mes contable de Lima) por caja, calculado al leer.
   *
   * Actual money (SUM queries — source of truth, unchanged):
   *   allocM  = Σ income split amounts per box this month
   *   spentM  = Σ confirmed expenses per box this month
   *   allocA  = Σ income split amounts per box all-time (for fund accumulation)
   *   spentA  = Σ confirmed expenses per box all-time (for fund accumulation)
   *
   * Target allocation (derived in TS via money.ts — ADR-1):
   *   income       = Σ allocM (total accounting-month income) ← S1-D1 confirmed source
   *   fixedBoxes   → allocated = fixedAmount
   *   percentBoxes → allocated = computeAllocation(income, pctBoxes) via largest-remainder
   *   remainingToFill (fixed only) = max(fixedAmount − amountFunded, 0)
   *
   * balance = allocated − spent (target-based, not actual-split-based for fixed boxes)
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

    // S1-D1: Total income = Σ allocM values (accounting-month income SUM across all boxes)
    const totalIncome = [...allocM.values()].reduce((s, v) => s + v, 0);

    // Separate active personal boxes for funding-math computation
    const activePersonalBoxes = boxes.filter((b) => b.active && b.scope === BoxScope.PERSONAL);
    const fundingBoxes = activePersonalBoxes.map(toFundingBox);

    // Compute target allocations via money.ts (ADR-1: service layer, not SQL)
    const allocationResults = computeAllocation(totalIncome, fundingBoxes);
    const allocationMap = new Map(allocationResults.map((r) => [r.id, r]));

    // Resta en centavos: jamás aritmética de flotantes sobre montos.
    return boxes.map((b) => {
      const mode = b.mode ?? BoxMode.PERCENT;
      const spent = toCents(spentM.get(b.id) ?? 0);
      const isFund = b.type === BoxType.FUND;
      const accumulated = toCents(allocA.get(b.id) ?? 0) - toCents(spentA.get(b.id) ?? 0);

      let allocatedCents: number;
      let boxRemainingToFill: number | null = null;

      const alloc = allocationMap.get(b.id);
      if (alloc) {
        // Active personal box: use funding-math target allocation
        allocatedCents = toCents(alloc.allocated);

        if (mode === BoxMode.FIXED && b.fixedAmount != null) {
          // amountFunded = how much income was actually split into this box this month
          const amountFunded = allocM.get(b.id) ?? 0;
          boxRemainingToFill = remainingToFill(parseFloat(b.fixedAmount), amountFunded);
        }
      } else {
        // Non-personal or inactive box: fall back to actual split amount (legacy behavior)
        allocatedCents = toCents(allocM.get(b.id) ?? 0);
      }

      return {
        ...toBoxDto(b),
        allocated: fromCents(allocatedCents),
        spent: fromCents(spent),
        balance: fromCents(allocatedCents - spent),
        accumulated: isFund ? fromCents(accumulated) : null,
        remainingToFill: boxRemainingToFill,
      };
    });
  }
}
