import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { accountingDate } from '../common/money';
import { Box } from '../boxes/box.entity';
import { RecurringExpense } from './recurring-expense.entity';

export interface RecurringDto {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  boxName: string;
  active: boolean;
}

/** CRUD de gastos fijos. El cron de recordatorios vive en WhatsappModule. */
@Injectable()
export class RecurringService {
  constructor(
    @InjectRepository(RecurringExpense) private readonly repo: Repository<RecurringExpense>,
    @InjectRepository(Box) private readonly boxes: Repository<Box>,
  ) {}

  async list(userId: string, includeInactive = false): Promise<RecurringDto[]> {
    const rows = await this.repo.find({
      where: includeInactive ? { userId } : { userId, active: true },
      relations: { box: true },
      order: { dayOfMonth: 'ASC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    userId: string,
    data: { name: string; amount: number; dayOfMonth: number; boxId: string },
  ): Promise<RecurringDto> {
    const saved = await this.repo.save(
      this.repo.create({
        userId,
        name: data.name,
        amount: data.amount.toFixed(2),
        dayOfMonth: data.dayOfMonth,
        boxId: data.boxId,
      }),
    );
    const box = await this.boxes.findOneByOrFail({ id: data.boxId });
    return this.toDto({ ...saved, box });
  }

  async deactivate(userId: string, id: string): Promise<RecurringDto> {
    const row = await this.repo.findOne({ where: { id, userId }, relations: { box: true } });
    if (!row)
      throw new AppException(
        'recurring.not_found',
        HttpStatus.NOT_FOUND,
        'Recurring expense not found',
      );
    row.active = false;
    await this.repo.save(row);
    return this.toDto(row);
  }

  /**
   * Vencimientos de HOY (mes contable de Lima) aún sin recordar este periodo.
   * Clamp de fin de mes: "día 31" en abril vence el 30.
   */
  async dueToday(now: Date = new Date()): Promise<RecurringExpense[]> {
    const today = accountingDate(now); // YYYY-MM-DD en Lima
    const [y, m, d] = today.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const period = today.slice(0, 7);

    const rows = await this.repo.find({
      where: { active: true },
      relations: { box: true, user: true },
    });
    return rows.filter(
      (r) => Math.min(r.dayOfMonth, daysInMonth) === d && r.lastRemindedPeriod !== period,
    );
  }

  async markReminded(id: string, now: Date = new Date()): Promise<void> {
    await this.repo.update(id, { lastRemindedPeriod: accountingDate(now).slice(0, 7) });
  }

  /** Suma mensual comprometida (para que el agente aconseje sobre el reparto). */
  async monthlyTotal(userId: string): Promise<number> {
    const rows = await this.repo.find({ where: { userId, active: true } });
    return Math.round(rows.reduce((s, r) => s + parseFloat(r.amount), 0) * 100) / 100;
  }

  private toDto(r: RecurringExpense): RecurringDto {
    return {
      id: r.id,
      name: r.name,
      amount: parseFloat(r.amount),
      dayOfMonth: r.dayOfMonth,
      boxName: r.box?.name ?? '—',
      active: r.active,
    };
  }
}
