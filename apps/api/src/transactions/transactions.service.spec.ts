import { HttpStatus } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import {
  TransactionType,
  TransactionSource,
  createTransactionSchema,
  listTransactionsSchema,
} from '@app/contracts';
import { Box } from '../boxes/box.entity';

// ---------------------------------------------------------------------------
// S3-T1: assertNoTransitRows invariant validator (pure helper, no DB needed)
// ---------------------------------------------------------------------------

/**
 * Pure invariant: throws if any non-voided transit row exists.
 * This mirrors the verify-zero gate in the RemoveTransitType migration.
 */
function assertNoTransitRows(rows: Array<{ type: string; deletedAt: Date | null }>): void {
  const active = rows.filter((r) => r.type === 'transit' && r.deletedAt === null);
  if (active.length > 0) {
    throw new Error(
      `[assertNoTransitRows] ${active.length} non-voided transit row(s) remain. ` +
        `Void them before narrowing the enum.`,
    );
  }
}

describe('assertNoTransitRows — migration verify-zero gate', () => {
  it('does not throw when there are no transit rows', () => {
    expect(() => assertNoTransitRows([])).not.toThrow();
  });

  it('does not throw when all transit rows are voided (deletedAt set)', () => {
    const voided = [{ type: 'transit', deletedAt: new Date() }];
    expect(() => assertNoTransitRows(voided)).not.toThrow();
  });

  it('throws when at least one non-voided transit row exists', () => {
    const rows = [
      { type: 'income', deletedAt: null },
      { type: 'transit', deletedAt: null }, // active transit row — must block migration
    ];
    expect(() => assertNoTransitRows(rows)).toThrow(/non-voided transit row/);
  });

  it('throws for multiple non-voided transit rows', () => {
    const rows = [
      { type: 'transit', deletedAt: null },
      { type: 'transit', deletedAt: null },
    ];
    expect(() => assertNoTransitRows(rows)).toThrow(/2 non-voided transit row/);
  });
});

// ---------------------------------------------------------------------------
// S3-T3: Schema-level transit rejection (spec §"transit is rejected")
// ---------------------------------------------------------------------------

describe('TransactionType contract — transit is rejected', () => {
  it('createTransactionSchema rejects type=transit', () => {
    const result = createTransactionSchema.safeParse({ type: 'transit', amount: 10 });
    expect(result.success).toBe(false);
  });

  it('listTransactionsSchema rejects type=transit as filter', () => {
    const result = listTransactionsSchema.safeParse({ type: 'transit' });
    expect(result.success).toBe(false);
  });

  it('createTransactionSchema accepts income', () => {
    const result = createTransactionSchema.safeParse({ type: 'income', amount: 100 });
    expect(result.success).toBe(true);
  });

  it('createTransactionSchema accepts expense', () => {
    const result = createTransactionSchema.safeParse({ type: 'expense', amount: 50 });
    expect(result.success).toBe(true);
  });
});

const makeBox = (overrides: Partial<Box> = {}): Box =>
  ({
    id: 'b1',
    userId: 'u1',
    active: true,
    pct: '25.00',
    ...overrides,
  }) as Box;

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const makeBoxesService = () => ({
  findOne: jest.fn(),
  activePersonal: jest.fn(),
});

describe('TransactionsService', () => {
  let service: TransactionsService;
  let repo: ReturnType<typeof makeRepo>;
  let boxes: ReturnType<typeof makeBoxesService>;

  beforeEach(() => {
    repo = makeRepo();
    boxes = makeBoxesService();
    service = new TransactionsService(repo as never, boxes as never);
  });

  describe('create', () => {
    it('throws transaction.expense_requires_box when expense has no boxId', async () => {
      repo.findOne.mockResolvedValue(null); // no waMessageId dedup
      await expect(
        service.create('u1', { type: TransactionType.EXPENSE, amount: 10 }, TransactionSource.PWA),
      ).rejects.toMatchObject({ code: 'transaction.expense_requires_box' });
    });

    it('thrown expense_requires_box has BAD_REQUEST status', async () => {
      repo.findOne.mockResolvedValue(null);
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.create(
          'u1',
          { type: TransactionType.EXPENSE, amount: 10 },
          TransactionSource.PWA,
        );
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('throws transaction.box_inactive when expense box is inactive', async () => {
      repo.findOne.mockResolvedValue(null);
      boxes.findOne.mockResolvedValue(makeBox({ active: false }));
      await expect(
        service.create(
          'u1',
          { type: TransactionType.EXPENSE, amount: 10, boxId: 'b1' },
          TransactionSource.PWA,
        ),
      ).rejects.toMatchObject({ code: 'transaction.box_inactive' });
    });

    it('throws transaction.no_boxes_for_income when no active boxes exist', async () => {
      repo.findOne.mockResolvedValue(null);
      boxes.activePersonal.mockResolvedValue([]);
      await expect(
        service.create('u1', { type: TransactionType.INCOME, amount: 100 }, TransactionSource.PWA),
      ).rejects.toMatchObject({ code: 'transaction.no_boxes_for_income' });
    });
  });

  describe('findOne', () => {
    it('throws transaction.not_found when transaction does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'tx1')).rejects.toMatchObject({
        code: 'transaction.not_found',
      });
    });

    it('thrown exception has NOT_FOUND status', async () => {
      repo.findOne.mockResolvedValue(null);
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.findOne('u1', 'tx1');
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });
});
