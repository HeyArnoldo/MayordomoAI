import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateTransactionInput,
  ListTransactionsInput,
  Transaction as TransactionDto,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '@app/contracts';
import { accountingDate, computeSplit } from '../common/money';
import { BoxesService } from '../boxes/boxes.service';
import { Transaction } from './transaction.entity';

export function toTransactionDto(t: Transaction): TransactionDto {
  return {
    id: t.id,
    type: t.type,
    boxId: t.boxId,
    amount: parseFloat(t.amount),
    currency: t.currency,
    date: t.date,
    occurredAt: t.occurredAt.toISOString(),
    note: t.note,
    source: t.source,
    status: t.status,
    split: t.split,
    voice: t.voice,
    createdAt: t.createdAt.toISOString(),
  };
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction) private readonly repo: Repository<Transaction>,
    private readonly boxes: BoxesService,
  ) {}

  /**
   * Registra una transacción. Gasto exige caja del usuario; ingreso calcula y
   * congela el split por % (snapshot); tránsito no toca cajas.
   * waMessageId hace la operación idempotente frente a webhooks repetidos.
   */
  async create(
    userId: string,
    input: CreateTransactionInput,
    source: TransactionSource,
    waMessageId?: string,
  ): Promise<Transaction> {
    if (waMessageId) {
      const previous = await this.repo.findOne({ where: { waMessageId }, withDeleted: true });
      if (previous) return previous;
    }

    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    let boxId: string | null = null;
    let split: Transaction['split'] = null;

    if (input.type === TransactionType.EXPENSE) {
      if (!input.boxId) throw new BadRequestException('Un gasto necesita caja');
      const box = await this.boxes.findOne(userId, input.boxId);
      if (!box.active) throw new BadRequestException('La caja está inactiva');
      boxId = box.id;
    } else if (input.type === TransactionType.INCOME) {
      const active = await this.boxes.activePersonal(userId);
      if (active.length === 0)
        throw new BadRequestException('No hay cajas para repartir el ingreso');
      split = computeSplit(
        input.amount,
        active.map((b) => ({ id: b.id, name: b.name, pct: parseFloat(b.pct) })),
      );
    }

    return this.repo.save(
      this.repo.create({
        userId,
        type: input.type,
        boxId,
        amount: input.amount.toFixed(2),
        date: accountingDate(occurredAt),
        occurredAt,
        note: input.note ?? null,
        source,
        status: TransactionStatus.CONFIRMED,
        split,
        voice: input.voice ?? false,
        waMessageId: waMessageId ?? null,
      }),
    );
  }

  async list(userId: string, filters: ListTransactionsInput): Promise<Transaction[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .orderBy('t.occurredAt', 'DESC')
      .take(filters.limit)
      .skip(filters.offset);

    if (filters.includeVoided) qb.withDeleted();
    if (filters.type) qb.andWhere('t.type = :type', { type: filters.type });
    if (filters.boxId) qb.andWhere('t.boxId = :boxId', { boxId: filters.boxId });
    if (filters.from) qb.andWhere('t.date >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('t.date <= :to', { to: filters.to });
    return qb.getMany();
  }

  async findOne(userId: string, id: string): Promise<Transaction> {
    const tx = await this.repo.findOne({ where: { id, userId }, withDeleted: true });
    if (!tx) throw new NotFoundException('Movimiento no encontrado');
    return tx;
  }

  /**
   * Anulación = soft delete (status='voided' + deletedAt). Jamás borrado
   * físico: es data financiera. El saldo se recalcula solo porque es un SUM
   * sobre confirmados.
   */
  async void(userId: string, id: string): Promise<Transaction> {
    const tx = await this.findOne(userId, id);
    if (tx.status === TransactionStatus.VOIDED) return tx;
    tx.status = TransactionStatus.VOIDED;
    tx.deletedAt = new Date();
    return this.repo.save(tx);
  }
}
