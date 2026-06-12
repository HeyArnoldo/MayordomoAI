import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AppException } from '../common/errors/app.exception';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { UserRole, UserStatus } from '@app/contracts';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'u1',
    email: 'a@b.com',
    name: 'Test',
    role: UserRole.USER,
    status: UserStatus.PENDING,
    passwordHash: null,
    ...overrides,
  }) as User;

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<UsersService>;
  let jwt: jest.Mocked<JwtService>;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    jwt = {
      sign: jest.fn().mockReturnValue('tok'),
    } as unknown as jest.Mocked<JwtService>;

    service = new AuthService(users, jwt);
  });

  describe('register', () => {
    it('throws AppException auth.email_already_registered when email is taken', async () => {
      users.findByEmail.mockResolvedValue(makeUser());
      await expect(
        service.register({ email: 'a@b.com', name: 'X', password: 'p' }),
      ).rejects.toMatchObject({
        code: 'auth.email_already_registered',
      });
    });

    it('thrown exception has CONFLICT status', async () => {
      users.findByEmail.mockResolvedValue(makeUser());
      let caught: AppException | undefined;
      try {
        await service.register({ email: 'a@b.com', name: 'X', password: 'p' });
      } catch (e) {
        caught = e as AppException;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.CONFLICT);
    });
  });

  describe('login', () => {
    it('throws AppException auth.invalid_credentials when user not found', async () => {
      users.findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'x@y.com', password: 'p' })).rejects.toMatchObject({
        code: 'auth.invalid_credentials',
      });
    });

    it('throws AppException auth.invalid_credentials when password is wrong', async () => {
      users.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: await bcrypt.hash('right', 1) }),
      );
      await expect(service.login({ email: 'a@b.com', password: 'wrong' })).rejects.toMatchObject({
        code: 'auth.invalid_credentials',
      });
    });

    it('thrown invalid_credentials exception has UNAUTHORIZED status', async () => {
      users.findByEmail.mockResolvedValue(null);
      let caught: AppException | undefined;
      try {
        await service.login({ email: 'x@y.com', password: 'p' });
      } catch (e) {
        caught = e as AppException;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });
  });
});
