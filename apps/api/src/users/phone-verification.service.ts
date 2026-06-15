import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { deriveCurrencyFromE164, type Locale } from '@app/contracts';
import { AppException } from '../common/errors/app.exception';
import { EvolutionClient } from '../whatsapp/evolution.client';
import { I18nService } from '../i18n/i18n.service';
import { User } from './user.entity';
import { PhoneNumber } from './phone-number.entity';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Verificación del número por código de 6 dígitos enviado por WhatsApp.
 * El código se guarda hasheado (mismo tratamiento que un password) y vence
 * a los 10 minutos. Reenvío con cooldown para no spamear Evolution.
 */
@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);

  constructor(
    @InjectRepository(PhoneNumber) private readonly phones: Repository<PhoneNumber>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly evolution: EvolutionClient,
    private readonly i18n: I18nService,
  ) {}

  /** Registra (o cambia) el número del usuario y le envía un código. */
  async requestCode(user: User, e164: string): Promise<PhoneNumber> {
    const taken = await this.phones.findOne({ where: { e164 } });
    if (taken && taken.userId !== user.id) {
      throw new AppException(
        'phone.number_already_taken',
        HttpStatus.CONFLICT,
        'Phone number already belongs to another account',
      );
    }

    // Un número por cuenta en este flujo: si ya tiene uno, se reutiliza la fila.
    let phone = await this.phones.findOne({ where: { userId: user.id } });
    if (!phone) {
      phone = this.phones.create({ userId: user.id, e164, verified: false });
    } else if (phone.e164 !== e164) {
      phone.e164 = e164;
      phone.verified = false;
    }

    if (phone.verified) return phone; // ya verificado, nada que enviar

    return this.sendCode(phone, user.language);
  }

  /** Reenvía el código vigente (regenerado) respetando el cooldown. */
  async resend(user: User): Promise<PhoneNumber> {
    const phone = await this.phones.findOne({ where: { userId: user.id } });
    if (!phone)
      throw new AppException(
        'phone.not_registered',
        HttpStatus.NOT_FOUND,
        'Register a phone number first',
      );
    if (phone.verified)
      throw new AppException(
        'phone.already_verified',
        HttpStatus.BAD_REQUEST,
        'Phone number already verified',
      );

    const since = phone.codeSentAt ? Date.now() - phone.codeSentAt.getTime() : Infinity;
    if (since < RESEND_COOLDOWN_MS) {
      const seconds = Math.ceil((RESEND_COOLDOWN_MS - since) / 1000);
      throw new AppException(
        'phone.resend_too_soon',
        HttpStatus.BAD_REQUEST,
        'Wait before resending the code',
        { seconds },
      );
    }
    return this.sendCode(phone, user.language);
  }

  /** Valida el código; si coincide, marca verificado y completa el onboarding. */
  async verify(user: User, code: string): Promise<PhoneNumber> {
    const phone = await this.phones.findOne({ where: { userId: user.id } });
    if (!phone)
      throw new AppException(
        'phone.not_registered',
        HttpStatus.NOT_FOUND,
        'Register a phone number first',
      );
    if (phone.verified) return phone;

    if (!phone.verificationCodeHash || !phone.codeExpiresAt) {
      throw new AppException(
        'phone.no_active_code',
        HttpStatus.BAD_REQUEST,
        'No active code — request a new one',
      );
    }
    if (phone.codeExpiresAt.getTime() < Date.now()) {
      throw new AppException(
        'phone.code_expired',
        HttpStatus.BAD_REQUEST,
        'Code expired — request a new one',
      );
    }
    const ok = await bcrypt.compare(code, phone.verificationCodeHash);
    if (!ok)
      throw new AppException(
        'phone.code_incorrect',
        HttpStatus.BAD_REQUEST,
        'Incorrect verification code',
      );

    phone.verified = true;
    phone.verificationCodeHash = null;
    phone.codeExpiresAt = null;
    const saved = await this.phones.save(phone);

    await this.markOnboarded(user);
    await this.deriveCurrencyIfUnset(user, saved.e164);

    // If the user has not yet completed AI onboarding, send a proactive WhatsApp
    // starter message to kick off the guided box-setup conversation. This is
    // idempotent: onboardingCompleted is checked before sending.
    await this.sendOnboardingStarterIfNeeded(user, saved.e164);

    return saved;
  }

  /**
   * Moneda derivada del país del número, SOLO si el usuario nunca eligió una
   * (currency NULL). Una elección explícita jamás se pisa. Prefijo no mapeado:
   * queda NULL y se resuelve como USD.
   */
  private async deriveCurrencyIfUnset(user: User, e164: string): Promise<void> {
    if (user.currency !== null) return;
    const currency = deriveCurrencyFromE164(e164);
    if (!currency) return;
    await this.users.update(user.id, { currency });
    user.currency = currency;
  }

  /** Omitir verificación: el onboarding se completa sin número confirmado. */
  async markOnboarded(user: User): Promise<void> {
    if (user.onboardedAt) return;
    await this.users.update(user.id, { onboardedAt: new Date() });
  }

  /**
   * Sends a proactive onboarding starter message via WhatsApp when:
   * - The user has just verified their phone number
   * - onboardingCompleted is still false (has not run the AI onboarding flow)
   *
   * Idempotent: re-fetches onboardingCompleted from DB before sending to
   * avoid duplicate messages on retry scenarios.
   */
  private async sendOnboardingStarterIfNeeded(user: User, e164: string): Promise<void> {
    // Re-read from DB to get the latest onboardingCompleted value.
    const fresh = await this.users.findOne({ where: { id: user.id } });
    if (!fresh || fresh.onboardingCompleted) return;

    const message = this.i18n.t(user.language, 'whatsapp.onboardingStarter', {
      name: user.name,
    });
    await this.evolution.sendText(e164, message);
  }

  private async sendCode(phone: PhoneNumber, language: Locale): Promise<PhoneNumber> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    phone.verificationCodeHash = await bcrypt.hash(code, 10);
    phone.codeExpiresAt = new Date(Date.now() + CODE_TTL_MS);
    phone.codeSentAt = new Date();
    const saved = await this.phones.save(phone);

    await this.evolution.sendText(
      phone.e164,
      this.i18n.t(language, 'whatsapp.verificationCode', { code }),
    );
    if (!this.evolution.enabled()) {
      // Dev mode without Evolution: code lives only in the log.
      this.logger.warn(`[dev] código para ${phone.e164}: ${code}`);
    }
    return saved;
  }
}
