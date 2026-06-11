import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhoneInput, phoneSchema, VerifyCodeInput, verifyCodeSchema } from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveAccountGuard } from '../common/guards/active-account.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from './user.entity';
import { PhoneNumber } from './phone-number.entity';
import { PhoneVerificationService } from './phone-verification.service';

interface PhoneDto {
  id: string;
  e164: string;
  verified: boolean;
}

const toPhoneDto = (p: PhoneNumber): PhoneDto => ({ id: p.id, e164: p.e164, verified: p.verified });

@Controller('me')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class UsersController {
  constructor(
    @InjectRepository(PhoneNumber) private readonly phones: Repository<PhoneNumber>,
    private readonly verification: PhoneVerificationService,
  ) {}

  @Get('phones')
  async list(@CurrentUser() user: User): Promise<PhoneDto[]> {
    const rows = await this.phones.find({ where: { userId: user.id } });
    return rows.map(toPhoneDto);
  }

  /**
   * Registra (o cambia) el número del bot y envía el código de 6 dígitos
   * por WhatsApp. El número queda sin verificar hasta POST /me/phone/verify.
   */
  @Post('phone')
  async link(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(phoneSchema)) input: PhoneInput,
  ): Promise<PhoneDto> {
    return toPhoneDto(await this.verification.requestCode(user, input.e164));
  }

  @Post('phone/verify')
  @HttpCode(200)
  async verify(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(verifyCodeSchema)) input: VerifyCodeInput,
  ): Promise<PhoneDto> {
    return toPhoneDto(await this.verification.verify(user, input.code));
  }

  @Post('phone/resend')
  @HttpCode(200)
  async resend(@CurrentUser() user: User): Promise<PhoneDto> {
    return toPhoneDto(await this.verification.resend(user));
  }

  /** Omitir verificación (botón "Saltar"): cierra el onboarding sin número. */
  @Post('onboarding/complete')
  @HttpCode(200)
  async completeOnboarding(@CurrentUser() user: User): Promise<{ ok: true }> {
    await this.verification.markOnboarded(user);
    return { ok: true };
  }
}
