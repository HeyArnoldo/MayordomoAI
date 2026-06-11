import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { EvolutionClient } from '../whatsapp/evolution.client';
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
  ) {}

  /** Registra (o cambia) el número del usuario y le envía un código. */
  async requestCode(user: User, e164: string): Promise<PhoneNumber> {
    const taken = await this.phones.findOne({ where: { e164 } });
    if (taken && taken.userId !== user.id) {
      throw new ConflictException('Ese número ya pertenece a otra cuenta');
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

    return this.sendCode(phone);
  }

  /** Reenvía el código vigente (regenerado) respetando el cooldown. */
  async resend(user: User): Promise<PhoneNumber> {
    const phone = await this.phones.findOne({ where: { userId: user.id } });
    if (!phone) throw new NotFoundException('Primero registra un número');
    if (phone.verified) throw new BadRequestException('El número ya está verificado');

    const since = phone.codeSentAt ? Date.now() - phone.codeSentAt.getTime() : Infinity;
    if (since < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - since) / 1000);
      throw new BadRequestException(`Espera ${wait}s para reenviar el código`);
    }
    return this.sendCode(phone);
  }

  /** Valida el código; si coincide, marca verificado y completa el onboarding. */
  async verify(user: User, code: string): Promise<PhoneNumber> {
    const phone = await this.phones.findOne({ where: { userId: user.id } });
    if (!phone) throw new NotFoundException('Primero registra un número');
    if (phone.verified) return phone;

    if (!phone.verificationCodeHash || !phone.codeExpiresAt) {
      throw new BadRequestException('No hay un código vigente — solicita uno nuevo');
    }
    if (phone.codeExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('El código venció — solicita uno nuevo');
    }
    const ok = await bcrypt.compare(code, phone.verificationCodeHash);
    if (!ok) throw new BadRequestException('Código incorrecto');

    phone.verified = true;
    phone.verificationCodeHash = null;
    phone.codeExpiresAt = null;
    const saved = await this.phones.save(phone);

    await this.markOnboarded(user);
    return saved;
  }

  /** Omitir verificación: el onboarding se completa sin número confirmado. */
  async markOnboarded(user: User): Promise<void> {
    if (user.onboardedAt) return;
    await this.users.update(user.id, { onboardedAt: new Date() });
  }

  private async sendCode(phone: PhoneNumber): Promise<PhoneNumber> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    phone.verificationCodeHash = await bcrypt.hash(code, 10);
    phone.codeExpiresAt = new Date(Date.now() + CODE_TTL_MS);
    phone.codeSentAt = new Date();
    const saved = await this.phones.save(phone);

    await this.evolution.sendText(
      phone.e164,
      `Tu código de verificación de MayordomoAI es *${code}*. Vence en 10 minutos.`,
    );
    if (!this.evolution.enabled()) {
      // Modo dev sin Evolution: el código solo vive en el log.
      this.logger.warn(`[dev] código para ${phone.e164}: ${code}`);
    }
    return saved;
  }
}
