import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { PhoneNumber } from '../users/phone-number.entity';
import { Box } from '../boxes/box.entity';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, PhoneNumber, Box]), AiUsageModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
