import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// EvolutionClient es stateless (solo env + fetch): se provee aquí directo
// en vez de exportarlo desde WhatsappModule y arrastrar sus dependencias.
import { EvolutionClient } from '../whatsapp/evolution.client';
import { User } from './user.entity';
import { PhoneNumber } from './phone-number.entity';
import { UsersController } from './users.controller';
import { AccountController } from './account.controller';
import { UsersService } from './users.service';
import { PhoneVerificationService } from './phone-verification.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, PhoneNumber])],
  controllers: [UsersController, AccountController],
  providers: [UsersService, PhoneVerificationService, EvolutionClient],
  exports: [UsersService],
})
export class UsersModule {}
