import { Body, ConflictException, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhoneInput, phoneSchema } from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveAccountGuard } from '../common/guards/active-account.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from './user.entity';
import { PhoneNumber } from './phone-number.entity';

interface PhoneDto {
  id: string;
  e164: string;
  verified: boolean;
}

@Controller('me')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class UsersController {
  constructor(@InjectRepository(PhoneNumber) private readonly phones: Repository<PhoneNumber>) {}

  @Get('phones')
  async list(@CurrentUser() user: User): Promise<PhoneDto[]> {
    const rows = await this.phones.find({ where: { userId: user.id } });
    return rows.map((p) => ({ id: p.id, e164: p.e164, verified: p.verified }));
  }

  /**
   * Vincula el número desde el que se escribe al bot. La verificación por
   * código queda post-hackathon: aquí se marca verificado directo (un número
   * solo puede pertenecer a UNA cuenta — constraint único en BD).
   */
  @Post('phone')
  async link(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(phoneSchema)) input: PhoneInput,
  ): Promise<PhoneDto> {
    const existing = await this.phones.findOne({ where: { e164: input.e164 } });
    if (existing && existing.userId !== user.id) {
      throw new ConflictException('Ese número ya pertenece a otra cuenta');
    }
    const phone =
      existing ?? this.phones.create({ userId: user.id, e164: input.e164, verified: true });
    phone.verified = true;
    const saved = await this.phones.save(phone);
    return { id: saved.id, e164: saved.e164, verified: saved.verified };
  }
}
