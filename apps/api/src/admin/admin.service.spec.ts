import { HttpStatus } from '@nestjs/common';
import { AdminService } from './admin.service';
import { User } from '../users/user.entity';
import { UserRole, UserStatus } from '@app/contracts';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'u1',
    email: 'a@b.com',
    name: 'Test',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    language: 'es',
    ...overrides,
  }) as User;

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  maximum: jest.fn(),
});

describe('AdminService', () => {
  let service: AdminService;
  let usersRepo: ReturnType<typeof makeRepo>;
  let phonesRepo: ReturnType<typeof makeRepo>;
  let boxesRepo: ReturnType<typeof makeRepo>;
  const aiUsage = { aggregateSince: jest.fn().mockResolvedValue([]) };
  const i18n = { t: jest.fn().mockReturnValue('Box') };

  beforeEach(() => {
    usersRepo = makeRepo();
    phonesRepo = makeRepo();
    boxesRepo = makeRepo();
    service = new AdminService(
      usersRepo as never,
      phonesRepo as never,
      boxesRepo as never,
      aiUsage as never,
      i18n as never,
    );
  });

  describe('updateStatus', () => {
    it('throws admin.cannot_change_own_status when actor targets themselves', async () => {
      await expect(
        service.updateStatus(makeUser({ id: 'u1' }), 'u1', UserStatus.PENDING),
      ).rejects.toMatchObject({ code: 'admin.cannot_change_own_status' });
    });

    it('thrown exception has BAD_REQUEST status', async () => {
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.updateStatus(makeUser({ id: 'u1' }), 'u1', UserStatus.PENDING);
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('throws admin.user_not_found when user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus(makeUser({ id: 'actor' }), 'other', UserStatus.PENDING),
      ).rejects.toMatchObject({ code: 'admin.user_not_found' });
    });

    it('thrown admin.user_not_found has NOT_FOUND status', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.updateStatus(makeUser({ id: 'actor' }), 'other', UserStatus.PENDING);
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('updateRole', () => {
    it('throws admin.cannot_change_own_role when actor targets themselves', async () => {
      await expect(
        service.updateRole(makeUser({ id: 'u1' }), 'u1', UserRole.USER),
      ).rejects.toMatchObject({ code: 'admin.cannot_change_own_role' });
    });

    it('throws admin.user_not_found when user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateRole(makeUser({ id: 'actor' }), 'other', UserRole.USER),
      ).rejects.toMatchObject({ code: 'admin.user_not_found' });
    });

    it('throws admin.last_admin when demoting the last admin', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser({ id: 'target', role: UserRole.ADMIN }));
      usersRepo.count.mockResolvedValue(1);
      await expect(
        service.updateRole(makeUser({ id: 'actor' }), 'target', UserRole.USER),
      ).rejects.toMatchObject({ code: 'admin.last_admin' });
    });

    it('thrown admin.last_admin has CONFLICT status', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser({ id: 'target', role: UserRole.ADMIN }));
      usersRepo.count.mockResolvedValue(1);
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.updateRole(makeUser({ id: 'actor' }), 'target', UserRole.USER);
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.CONFLICT);
    });
  });
});
