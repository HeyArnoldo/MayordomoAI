import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateMovimientoInput,
  ListMovimientosInput,
  MovEstado,
  MovOrigen,
  MovTipo,
  Movimiento as MovimientoDto,
} from '@app/contracts';
import { calcularSplit, fechaContable } from '../common/dinero';
import { CajasService } from '../cajas/cajas.service';
import { Movimiento } from './movimiento.entity';

export function toMovDto(m: Movimiento): MovimientoDto {
  return {
    id: m.id,
    tipo: m.tipo,
    cajaId: m.cajaId,
    monto: parseFloat(m.monto),
    moneda: m.moneda,
    fecha: m.fecha,
    ocurridoAt: m.ocurridoAt.toISOString(),
    nota: m.nota,
    origen: m.origen,
    estado: m.estado,
    split: m.split,
    voz: m.voz,
    createdAt: m.createdAt.toISOString(),
  };
}

@Injectable()
export class MovimientosService {
  constructor(
    @InjectRepository(Movimiento) private readonly repo: Repository<Movimiento>,
    private readonly cajas: CajasService,
  ) {}

  /**
   * Registra un movimiento. Gasto exige caja del usuario; ingreso calcula y
   * congela el split por % (snapshot); tránsito no toca cajas.
   * waMessageId hace la operación idempotente frente a webhooks repetidos.
   */
  async crear(
    userId: string,
    input: CreateMovimientoInput,
    origen: MovOrigen,
    waMessageId?: string,
  ): Promise<Movimiento> {
    if (waMessageId) {
      const previo = await this.repo.findOne({ where: { waMessageId }, withDeleted: true });
      if (previo) return previo;
    }

    const ocurridoAt = input.ocurridoAt ? new Date(input.ocurridoAt) : new Date();
    let cajaId: string | null = null;
    let split: Movimiento['split'] = null;

    if (input.tipo === MovTipo.GASTO) {
      if (!input.cajaId) throw new BadRequestException('Un gasto necesita caja');
      const caja = await this.cajas.findOne(userId, input.cajaId);
      if (!caja.activa) throw new BadRequestException('La caja está inactiva');
      cajaId = caja.id;
    } else if (input.tipo === MovTipo.INGRESO) {
      const activas = await this.cajas.activasPersonales(userId);
      if (activas.length === 0)
        throw new BadRequestException('No hay cajas para repartir el ingreso');
      split = calcularSplit(
        input.monto,
        activas.map((c) => ({ id: c.id, nombre: c.nombre, pct: parseFloat(c.pct) })),
      );
    }

    return this.repo.save(
      this.repo.create({
        userId,
        tipo: input.tipo,
        cajaId,
        monto: input.monto.toFixed(2),
        fecha: fechaContable(ocurridoAt),
        ocurridoAt,
        nota: input.nota ?? null,
        origen,
        estado: MovEstado.CONFIRMADO,
        split,
        voz: input.voz ?? false,
        waMessageId: waMessageId ?? null,
      }),
    );
  }

  async listar(userId: string, filtros: ListMovimientosInput): Promise<Movimiento[]> {
    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.userId = :userId', { userId })
      .orderBy('m.ocurridoAt', 'DESC')
      .take(filtros.limite)
      .skip(filtros.offset);

    if (filtros.incluirAnulados) qb.withDeleted();
    if (filtros.tipo) qb.andWhere('m.tipo = :tipo', { tipo: filtros.tipo });
    if (filtros.cajaId) qb.andWhere('m.cajaId = :cajaId', { cajaId: filtros.cajaId });
    if (filtros.desde) qb.andWhere('m.fecha >= :desde', { desde: filtros.desde });
    if (filtros.hasta) qb.andWhere('m.fecha <= :hasta', { hasta: filtros.hasta });
    return qb.getMany();
  }

  async detalle(userId: string, id: string): Promise<Movimiento> {
    const mov = await this.repo.findOne({ where: { id, userId }, withDeleted: true });
    if (!mov) throw new NotFoundException('Movimiento no encontrado');
    return mov;
  }

  /**
   * Anulación = soft delete (estado='anulado' + deletedAt). Jamás borrado
   * físico: es data financiera. El saldo se recalcula solo porque es un SUM
   * sobre confirmados.
   */
  async anular(userId: string, id: string): Promise<Movimiento> {
    const mov = await this.detalle(userId, id);
    if (mov.estado === MovEstado.ANULADO) return mov;
    mov.estado = MovEstado.ANULADO;
    mov.deletedAt = new Date();
    return this.repo.save(mov);
  }
}
