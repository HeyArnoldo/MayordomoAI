import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageLog } from './ai-usage-log.entity';
import { AiUsageService } from './ai-usage.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiUsageLog])],
  providers: [AiUsageService],
  exports: [AiUsageService],
})
export class AiUsageModule {}
