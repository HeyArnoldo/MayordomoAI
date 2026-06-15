import { OnboardingService } from './onboarding.service';
import { User } from '../users/user.entity';
import { UserRole, UserStatus, DEFAULT_LOCALE } from '@app/contracts';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'u1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    language: DEFAULT_LOCALE,
    currency: null,
    onboardedAt: null,
    onboardingCompleted: false,
    ...overrides,
  }) as User;

const makeRepo = () => ({
  update: jest.fn().mockResolvedValue({}),
  findOne: jest.fn(),
});

describe('OnboardingService', () => {
  let service: OnboardingService;
  let usersRepo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    usersRepo = makeRepo();
    service = new OnboardingService(usersRepo as never);
  });

  describe('isOnboarding', () => {
    it('returns true when onboardingCompleted is false', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser({ onboardingCompleted: false }));
      const result = await service.isOnboarding('u1');
      expect(result).toBe(true);
    });

    it('returns false when onboardingCompleted is true', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser({ onboardingCompleted: true }));
      const result = await service.isOnboarding('u1');
      expect(result).toBe(false);
    });

    it('returns false when user is not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      const result = await service.isOnboarding('unknown');
      expect(result).toBe(false);
    });
  });

  describe('confirmOnboarding', () => {
    it('sets onboardingCompleted to true for a pending user', async () => {
      const user = makeUser({ onboardingCompleted: false });
      usersRepo.findOne.mockResolvedValue(user);

      await service.confirmOnboarding('u1');

      expect(usersRepo.update).toHaveBeenCalledWith('u1', { onboardingCompleted: true });
    });

    it('is idempotent: calling twice does not double-update', async () => {
      const user = makeUser({ onboardingCompleted: true });
      usersRepo.findOne.mockResolvedValue(user);

      await service.confirmOnboarding('u1');

      // Already completed — should not call update again
      expect(usersRepo.update).not.toHaveBeenCalled();
    });

    it('is idempotent: calling on already-completed user returns without error', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser({ onboardingCompleted: true }));
      // Should resolve cleanly (no throw)
      await expect(service.confirmOnboarding('u1')).resolves.toBeUndefined();
    });

    it('does nothing when user is not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.confirmOnboarding('ghost')).resolves.toBeUndefined();
      expect(usersRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('auto-seed guard', () => {
    it('correctly identifies new user (onboardingCompleted=false) as needing onboarding', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser({ onboardingCompleted: false }));
      const isNew = await service.isOnboarding('u1');
      expect(isNew).toBe(true);
    });

    it('correctly identifies existing user (onboardingCompleted=true) as onboarded', async () => {
      usersRepo.findOne.mockResolvedValue(makeUser({ onboardingCompleted: true }));
      const isNew = await service.isOnboarding('u1');
      expect(isNew).toBe(false);
    });
  });
});
