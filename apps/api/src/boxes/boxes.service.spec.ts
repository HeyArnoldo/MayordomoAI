import { HttpStatus } from '@nestjs/common';
import { BoxesService } from './boxes.service';
import { Box } from './box.entity';
import { BoxMode, BoxScope, BoxType, DEFAULT_LOCALE } from '@app/contracts';
import type { CreateBoxInput } from '@app/contracts';

const makeBox = (overrides: Partial<Box> = {}): Box =>
  ({
    id: 'b1',
    userId: 'u1',
    name: 'Savings',
    pct: '25.00',
    type: BoxType.FUND,
    scope: BoxScope.PERSONAL,
    active: true,
    sortOrder: 0,
    mode: BoxMode.PERCENT,
    fixedAmount: null,
    createdAt: new Date(),
    ...overrides,
  }) as Box;

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  count: jest.fn(),
  maximum: jest.fn(),
  manager: { query: jest.fn() },
});

describe('BoxesService', () => {
  let service: BoxesService;
  let repo: ReturnType<typeof makeRepo>;
  const i18n = { t: jest.fn().mockReturnValue('Box name') };

  beforeEach(() => {
    repo = makeRepo();
    service = new BoxesService(repo as never, i18n as never);
  });

  describe('findOne', () => {
    it('throws box.not_found when box does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'b1')).rejects.toMatchObject({
        code: 'box.not_found',
      });
    });

    it('thrown exception has NOT_FOUND status', async () => {
      repo.findOne.mockResolvedValue(null);
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.findOne('u1', 'b1');
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('returns the box when found', async () => {
      const box = makeBox();
      repo.findOne.mockResolvedValue(box);
      const result = await service.findOne('u1', 'b1');
      expect(result).toBe(box);
    });
  });

  describe('updateAllocation', () => {
    it('throws box.not_in_allocation when an item references a non-existent box', async () => {
      repo.find.mockResolvedValue([makeBox({ id: 'b1' })]);
      await expect(
        service.updateAllocation('u1', {
          items: [
            { id: 'unknown', pct: 50 },
            { id: 'b1', pct: 50 },
          ],
        }),
      ).rejects.toMatchObject({ code: 'box.not_in_allocation' });
    });

    it('thrown box.not_in_allocation carries id param', async () => {
      repo.find.mockResolvedValue([makeBox({ id: 'b1' })]);
      let caught: { code: string; params?: Record<string, string | number> } | undefined;
      try {
        await service.updateAllocation('u1', { items: [{ id: 'unknown', pct: 100 }] });
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.code).toBe('box.not_in_allocation');
      expect(caught?.params?.id).toBeDefined();
    });

    it('throws box.allocation_must_sum_100 when percentages do not sum to 100', async () => {
      repo.find.mockResolvedValue([makeBox({ id: 'b1', pct: '25.00' })]);
      await expect(
        service.updateAllocation('u1', { items: [{ id: 'b1', pct: 50 }] }),
      ).rejects.toMatchObject({ code: 'box.allocation_must_sum_100' });
    });

    it('thrown box.allocation_must_sum_100 carries total param', async () => {
      repo.find.mockResolvedValue([makeBox({ id: 'b1', pct: '25.00' })]);
      let caught: { code: string; params?: Record<string, string | number> } | undefined;
      try {
        await service.updateAllocation('u1', { items: [{ id: 'b1', pct: 50 }] });
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.code).toBe('box.allocation_must_sum_100');
      expect(caught?.params?.total).toBeDefined();
    });

    it('fixed boxes are excluded from the percent-sum invariant', async () => {
      // One fixed box (id: 'f1') + one percent box at 100%: should pass
      const fixedBox = makeBox({
        id: 'f1',
        mode: BoxMode.FIXED,
        fixedAmount: '500.00',
        pct: '0.00',
      });
      const pctBox = makeBox({ id: 'b1', mode: BoxMode.PERCENT, pct: '100.00' });
      repo.find.mockResolvedValue([fixedBox, pctBox]);
      repo.save.mockImplementation((boxes: Box[]) => Promise.resolve(boxes));
      // Only updating the pct box; fixed box is excluded from invariant check
      const result = await service.updateAllocation('u1', { items: [{ id: 'b1', pct: 100 }] });
      expect(result).toHaveLength(2);
    });
  });

  describe('seedDefaults', () => {
    it('calls i18n.t for box names (i18n still used in seedDefaults)', async () => {
      repo.find.mockResolvedValue([]);
      repo.create.mockImplementation((data: Partial<Box>) => ({ ...data }) as Box);
      repo.save.mockImplementation((boxes: Box[]) => Promise.resolve(boxes));
      await service.seedDefaults('u1', DEFAULT_LOCALE);
      expect(i18n.t).toHaveBeenCalled();
    });
  });

  describe('assertFixedDoesNotExceedIncome (via create)', () => {
    const fixedInput: CreateBoxInput = {
      name: 'Rent',
      pct: 0,
      type: BoxType.EXPENSE,
      scope: BoxScope.PERSONAL,
      mode: BoxMode.FIXED,
      fixedAmount: 500,
    };

    beforeEach(() => {
      repo.maximum.mockResolvedValue(0);
      repo.create.mockImplementation((data: Partial<Box>) => ({ ...data }) as Box);
      repo.save.mockImplementation((box: Box) => Promise.resolve(box));
    });

    it('allows creating a fixed box when income is 0 (zero-income trap)', async () => {
      // income = 0 → no constraint yet; any fixed amount must be allowed
      repo.manager.query.mockResolvedValue([{ total: '0' }]);
      repo.find.mockResolvedValue([]); // no existing fixed boxes
      await expect(service.create('u1', fixedInput)).resolves.toBeDefined();
    });

    it('allows creating a fixed box when fixed === income (all-fixed budget)', async () => {
      // fixed (500) = income (500) → entire income in fixed envelopes; valid
      repo.manager.query.mockResolvedValue([{ total: '500.00' }]);
      repo.find.mockResolvedValue([]); // no other fixed boxes
      await expect(
        service.create('u1', { ...fixedInput, fixedAmount: 500 }),
      ).resolves.toBeDefined();
    });

    it('rejects when fixed strictly exceeds income (income > 0)', async () => {
      // existing fixed = 600, income = 500 → proposed 600 > 500 must be rejected
      repo.manager.query.mockResolvedValue([{ total: '500.00' }]);
      repo.find.mockResolvedValue([
        makeBox({ id: 'f1', mode: BoxMode.FIXED, fixedAmount: '600.00' }),
      ]);
      await expect(service.create('u1', { ...fixedInput, fixedAmount: 100 })).rejects.toMatchObject(
        {
          code: 'box.fixed_exceeds_income',
        },
      );
    });

    it('rejects with box.fixed_exceeds_income error code only when income > 0', async () => {
      // income = 1000, proposed = 800 + 300 = 1100 → rejected
      repo.manager.query.mockResolvedValue([{ total: '1000.00' }]);
      repo.find.mockResolvedValue([
        makeBox({ id: 'f1', mode: BoxMode.FIXED, fixedAmount: '800.00' }),
      ]);
      await expect(service.create('u1', { ...fixedInput, fixedAmount: 300 })).rejects.toMatchObject(
        {
          code: 'box.fixed_exceeds_income',
        },
      );
    });
  });
});
