import { HttpStatus } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionType, TransactionSource } from '@app/contracts';
import { Box } from '../boxes/box.entity';

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
