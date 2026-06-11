import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Box } from '../boxes/box.entity';
import { RecurringExpense } from './recurring-expense.entity';
import { RecurringService } from './recurring.service';

@Module({
  imports: [TypeOrmModule.forFeature([RecurringExpense, Box])],
  providers: [RecurringService],
  exports: [RecurringService],
})
export class RecurringModule {}
