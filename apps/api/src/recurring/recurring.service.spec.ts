import { HttpStatus } from '@nestjs/common';
import { RecurringService } from './recurring.service';

const makeRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
});

const makeBoxesRepo = () => ({
  findOneByOrFail: jest.fn(),
});

describe('RecurringService', () => {
  let service: RecurringService;
  let repo: ReturnType<typeof makeRepo>;
  let boxes: ReturnType<typeof makeBoxesRepo>;

  beforeEach(() => {
    repo = makeRepo();
    boxes = makeBoxesRepo();
    service = new RecurringService(repo as never, boxes as never);
  });

  describe('deactivate', () => {
    it('throws recurring.not_found when the expense does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.deactivate('u1', 'r1')).rejects.toMatchObject({
        code: 'recurring.not_found',
      });
    });

    it('thrown exception has NOT_FOUND status', async () => {
      repo.findOne.mockResolvedValue(null);
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.deactivate('u1', 'r1');
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });
});
