import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_LOCALE, LoginInput, RegisterInput, UserRole } from '@app/contracts';
import { AppException } from '../common/errors/app.exception';
import { GoogleProfileData, UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

export interface AuthResult {
  user: User;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  private sign(user: User): string {
    return this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
  }

  /** ADMIN_EMAIL actúa como whitelist: ese correo siempre recibe rol admin. */
  private roleFor(email: string): UserRole {
    return process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL
      ? UserRole.ADMIN
      : UserRole.USER;
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing)
      throw new AppException(
        'auth.email_already_registered',
        HttpStatus.CONFLICT,
        'Email already registered',
      );

    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, rounds),
      role: this.roleFor(input.email),
      language: input.language ?? DEFAULT_LOCALE,
    });
    return { user, token: this.sign(user) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    // Same message for "not found" and "wrong password": do not reveal which emails exist.
    if (!user?.passwordHash)
      throw new AppException(
        'auth.invalid_credentials',
        HttpStatus.UNAUTHORIZED,
        'Invalid credentials',
      );

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok)
      throw new AppException(
        'auth.invalid_credentials',
        HttpStatus.UNAUTHORIZED,
        'Invalid credentials',
      );
    return { user, token: this.sign(user) };
  }

  async loginWithGoogle(profile: GoogleProfileData): Promise<AuthResult> {
    const user = await this.users.upsertFromGoogle(profile);
    const expected = this.roleFor(user.email);
    if (expected === UserRole.ADMIN && user.role !== UserRole.ADMIN) {
      user.role = UserRole.ADMIN;
      await this.users.save(user);
    }
    return { user, token: this.sign(user) };
  }
}
