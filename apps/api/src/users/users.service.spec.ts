import { HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UserRole, UserStatus } from '@app/contracts';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'u1',
    email: 'a@b.com',
    name: 'Test',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    ...overrides,
  }) as User;

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    count: jest.Mock;
    delete: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      count: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
    };
    service = new UsersService(repo as never);
  });

  describe('deleteAccount', () => {
    it('throws user.last_admin_cannot_delete when deleting the last admin', async () => {
      repo.count.mockResolvedValue(1);
      await expect(service.deleteAccount(makeUser({ role: UserRole.ADMIN }))).rejects.toMatchObject(
        { code: 'user.last_admin_cannot_delete' },
      );
    });

    it('thrown exception has CONFLICT status', async () => {
      repo.count.mockResolvedValue(1);
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.deleteAccount(makeUser({ role: UserRole.ADMIN }));
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.CONFLICT);
    });

    it('does not throw when there are multiple admins', async () => {
      repo.count.mockResolvedValue(2);
      await expect(
        service.deleteAccount(makeUser({ role: UserRole.ADMIN })),
      ).resolves.toBeUndefined();
    });
  });
});
