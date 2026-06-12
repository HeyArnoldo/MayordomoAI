import { HttpStatus } from '@nestjs/common';
import { PhoneVerificationService } from './phone-verification.service';
import { User } from './user.entity';
import { PhoneNumber } from './phone-number.entity';
import { UserRole, UserStatus, DEFAULT_LOCALE } from '@app/contracts';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'u1',
    email: 'a@b.com',
    name: 'Test',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    language: DEFAULT_LOCALE,
    currency: null,
    onboardedAt: null,
    ...overrides,
  }) as User;

const makePhone = (overrides: Partial<PhoneNumber> = {}): PhoneNumber =>
  ({
    id: 'ph1',
    userId: 'u1',
    e164: '+51987654321',
    verified: false,
    verificationCodeHash: null,
    codeExpiresAt: null,
    codeSentAt: null,
    ...overrides,
  }) as PhoneNumber;

const makeRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('PhoneVerificationService', () => {
  let service: PhoneVerificationService;
  let phones: ReturnType<typeof makeRepo>;
  let users: ReturnType<typeof makeRepo>;
  let evolution: { sendText: jest.Mock; enabled: jest.Mock };

  beforeEach(() => {
    phones = makeRepo();
    users = makeRepo();
    evolution = {
      sendText: jest.fn().mockResolvedValue(undefined),
      enabled: jest.fn().mockReturnValue(false),
    };
    // i18n not needed for error paths
    const i18n = { t: jest.fn().mockReturnValue('msg') };
    service = new PhoneVerificationService(
      phones as never,
      users as never,
      evolution as never,
      i18n as never,
    );
  });

  describe('requestCode', () => {
    it('throws phone.number_already_taken when number belongs to another user', async () => {
      phones.findOne.mockResolvedValueOnce(makePhone({ userId: 'other' }));
      await expect(service.requestCode(makeUser(), '+51987654321')).rejects.toMatchObject({
        code: 'phone.number_already_taken',
      });
    });

    it('thrown exception has CONFLICT status', async () => {
      phones.findOne.mockResolvedValueOnce(makePhone({ userId: 'other' }));
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.requestCode(makeUser(), '+51987654321');
      } catch (e) {
        caught = e as { getStatus: () => number };
      }
      expect(caught?.getStatus()).toBe(HttpStatus.CONFLICT);
    });
  });

  describe('resend', () => {
    it('throws phone.not_registered when no phone record exists', async () => {
      phones.findOne.mockResolvedValue(null);
      await expect(service.resend(makeUser())).rejects.toMatchObject({
        code: 'phone.not_registered',
      });
    });

    it('thrown phone.not_registered has NOT_FOUND status', async () => {
      phones.findOne.mockResolvedValue(null);
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.resend(makeUser());
      } catch (e) {
        caught = e as { getStatus: () => number };
      }
      expect(caught?.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('throws phone.already_verified when phone is verified', async () => {
      phones.findOne.mockResolvedValue(makePhone({ verified: true }));
      await expect(service.resend(makeUser())).rejects.toMatchObject({
        code: 'phone.already_verified',
      });
    });

    it('throws phone.resend_too_soon with seconds param when in cooldown', async () => {
      phones.findOne.mockResolvedValue(
        makePhone({ codeSentAt: new Date(Date.now() - 10_000) }), // 10s ago, cooldown is 60s
      );
      let caught: { code: string; params?: Record<string, number | string> } | undefined;
      try {
        await service.resend(makeUser());
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.code).toBe('phone.resend_too_soon');
      expect(caught?.params?.seconds).toBeDefined();
    });
  });

  describe('verify', () => {
    it('throws phone.not_registered when no phone record exists', async () => {
      phones.findOne.mockResolvedValue(null);
      await expect(service.verify(makeUser(), '123456')).rejects.toMatchObject({
        code: 'phone.not_registered',
      });
    });

    it('throws phone.no_active_code when no verification hash/expiry present', async () => {
      phones.findOne.mockResolvedValue(
        makePhone({ verificationCodeHash: null, codeExpiresAt: null }),
      );
      await expect(service.verify(makeUser(), '123456')).rejects.toMatchObject({
        code: 'phone.no_active_code',
      });
    });

    it('throws phone.code_expired when code is past expiry', async () => {
      phones.findOne.mockResolvedValue(
        makePhone({
          verificationCodeHash: 'hash',
          codeExpiresAt: new Date(Date.now() - 1000),
        }),
      );
      await expect(service.verify(makeUser(), '123456')).rejects.toMatchObject({
        code: 'phone.code_expired',
      });
    });

    it('throws phone.code_incorrect when code does not match hash', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('correct', 1);
      phones.findOne.mockResolvedValue(
        makePhone({
          verificationCodeHash: hash,
          codeExpiresAt: new Date(Date.now() + 60_000),
        }),
      );
      await expect(service.verify(makeUser(), 'wrong01')).rejects.toMatchObject({
        code: 'phone.code_incorrect',
      });
    });
  });
});
