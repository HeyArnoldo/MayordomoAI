import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Caja as CajaDto,
  CajaAmbito,
  CajaSaldo,
  CajaTipo,
  CreateCajaInput,
  RepartoInput,
  UpdateCajaInput,
} from '@app/contracts';
import { fromCents, mesContable, sumaPctValida, toCents } from '../common/dinero';
import { Caja } from './caja.entity';

/** Set por defecto para una cuenta nueva — el mismo del design. */
const CAJAS_DEFAULT: Array<Pick<CajaDto, 'nombre' | 'pct' | 'tipo'>> = [
  { nombre: 'Ahorro', pct: 25, tipo: CajaTipo.FONDO },
  { nombre: 'Varios', pct: 20, tipo: CajaTipo.GASTO },
  { nombre: 'Pasajes', pct: 15, tipo: CajaTipo.GASTO },
  { nombre: 'Ocio', pct: 15, tipo: CajaTipo.GASTO },
  { nombre: 'Diezmo', pct: 10, tipo: CajaTipo.GASTO },
  { nombre: 'Snacks', pct: 10, tipo: CajaTipo.GASTO },
  { nombre: 'Ofrenda', pct: 5, tipo: CajaTipo.GASTO },
];

export function toCajaDto(c: Caja): CajaDto {
  return {
    id: c.id,
    nombre: c.nombre,
    pct: parseFloat(c.pct),
    tipo: c.tipo,
    ambito: c.ambito,
    orden: c.orden,
    activa: c.activa,
    createdAt: c.createdAt.toISOString(),
  };
}

@Injectable()
export class CajasService {
  constructor(@InjectRepository(Caja) private readonly repo: Repository<Caja>) {}

  findAll(userId: string): Promise<Caja[]> {
    return this.repo.find({ where: { userId }, order: { orden: 'ASC', createdAt: 'ASC' } });
  }

  async findOne(userId: string, id: string): Promise<Caja> {
    const caja = await this.repo.findOne({ where: { id, userId } });
    if (!caja) throw new NotFoundException('Caja no encontrada');
    return caja;
  }

  /** Cajas activas de ámbito personal — las que participan del reparto por %. */
  activasPersonales(userId: string): Promise<Caja[]> {
    return this.repo.find({
      where: { userId, activa: true, ambito: CajaAmbito.PERSONAL },
      order: { orden: 'ASC' },
    });
  }

  async create(userId: string, input: CreateCajaInput): Promise<Caja> {
    const max = await this.repo.maximum('orden', { userId });
    return this.repo.save(
      this.repo.create({
        userId,
        nombre: input.nombre,
        pct: input.pct.toFixed(2),
        tipo: input.tipo,
        ambito: input.ambito,
        orden: input.orden ?? (max ?? 0) + 1,
      }),
    );
  }

  async update(userId: string, id: string, input: UpdateCajaInput): Promise<Caja> {
    const caja = await this.findOne(userId, id);
    if (input.nombre !== undefined) caja.nombre = input.nombre;
    if (input.pct !== undefined) caja.pct = input.pct.toFixed(2);
    if (input.tipo !== undefined) caja.tipo = input.tipo;
    if (input.ambito !== undefined) caja.ambito = input.ambito;
    if (input.orden !== undefined) caja.orden = input.orden;
    if (input.activa !== undefined) caja.activa = input.activa;
    return this.repo.save(caja);
  }

  /**
   * Actualización masiva del reparto. Valida que el set personal activo
   * resultante sume EXACTAMENTE 100. Aplica solo a ingresos futuros (el
   * historial conserva su split snapshot).
   */
  async reparto(userId: string, input: RepartoInput): Promise<Caja[]> {
    const cajas = await this.activasPersonales(userId);
    const porId = new Map(cajas.map((c) => [c.id, c]));
    for (const item of input.items) {
      const caja = porId.get(item.id);
      if (!caja)
        throw new BadRequestException(`Caja ${item.id} no existe o no participa del reparto`);
      caja.pct = item.pct.toFixed(2);
    }
    const pcts = cajas.map((c) => parseFloat(c.pct));
    if (!sumaPctValida(pcts)) {
      const total = pcts.reduce((s, p) => s + p, 0);
      throw new BadRequestException(`Los porcentajes deben sumar 100 (suman ${total.toFixed(2)})`);
    }
    return this.repo.save(cajas);
  }

  /** Crea el set por defecto si la cuenta no tiene cajas. Idempotente. */
  async seedDefaults(userId: string): Promise<Caja[]> {
    const existentes = await this.findAll(userId);
    if (existentes.length > 0) return existentes;
    const cajas = CAJAS_DEFAULT.map((c, i) =>
      this.repo.create({
        userId,
        nombre: c.nombre,
        pct: c.pct.toFixed(2),
        tipo: c.tipo,
        ambito: CajaAmbito.PERSONAL,
        orden: i,
      }),
    );
    return this.repo.save(cajas);
  }

  /**
   * Estado del periodo (mes contable de Lima) por caja, calculado al leer:
   *   asignado = SUM(split del periodo) · gastado = SUM(gastos confirmados)
   *   saldo = asignado − gastado · fondo además acumula histórico.
   * La verdad SIEMPRE es el SUM — el saldo no se almacena nunca.
   */
  async conSaldo(userId: string, ahora: Date = new Date()): Promise<CajaSaldo[]> {
    const { desde, hasta } = mesContable(ahora);
    const cajas = await this.findAll(userId);

    type Fila = { cajaId: string; total: string };
    const [asignados, gastados, asignadosHist, gastadosHist] = (await Promise.all([
      this.repo.manager.query(
        `SELECT s->>'cajaId' AS "cajaId", COALESCE(SUM((s->>'monto')::numeric), 0) AS total
         FROM movimientos m, jsonb_array_elements(m.split) s
         WHERE m."userId" = $1 AND m.tipo = 'ingreso' AND m.estado = 'confirmado'
           AND m."deletedAt" IS NULL AND m.fecha BETWEEN $2 AND $3
         GROUP BY 1`,
        [userId, desde, hasta],
      ),
      this.repo.manager.query(
        `SELECT m."cajaId" AS "cajaId", COALESCE(SUM(m.monto), 0) AS total
         FROM movimientos m
         WHERE m."userId" = $1 AND m.tipo = 'gasto' AND m.estado = 'confirmado'
           AND m."deletedAt" IS NULL AND m."cajaId" IS NOT NULL AND m.fecha BETWEEN $2 AND $3
         GROUP BY 1`,
        [userId, desde, hasta],
      ),
      this.repo.manager.query(
        `SELECT s->>'cajaId' AS "cajaId", COALESCE(SUM((s->>'monto')::numeric), 0) AS total
         FROM movimientos m, jsonb_array_elements(m.split) s
         WHERE m."userId" = $1 AND m.tipo = 'ingreso' AND m.estado = 'confirmado'
           AND m."deletedAt" IS NULL
         GROUP BY 1`,
        [userId],
      ),
      this.repo.manager.query(
        `SELECT m."cajaId" AS "cajaId", COALESCE(SUM(m.monto), 0) AS total
         FROM movimientos m
         WHERE m."userId" = $1 AND m.tipo = 'gasto' AND m.estado = 'confirmado'
           AND m."deletedAt" IS NULL AND m."cajaId" IS NOT NULL
         GROUP BY 1`,
        [userId],
      ),
    ])) as [Fila[], Fila[], Fila[], Fila[]];

    const mapa = (filas: Fila[]) => new Map(filas.map((f) => [f.cajaId, parseFloat(f.total)]));
    const asigMes = mapa(asignados);
    const gastMes = mapa(gastados);
    const asigHist = mapa(asignadosHist);
    const gastHist = mapa(gastadosHist);

    // Resta en centavos: jamás aritmética de flotantes sobre montos.
    return cajas.map((c) => {
      const asignado = toCents(asigMes.get(c.id) ?? 0);
      const gastado = toCents(gastMes.get(c.id) ?? 0);
      const esFondo = c.tipo === CajaTipo.FONDO;
      const acumulado = toCents(asigHist.get(c.id) ?? 0) - toCents(gastHist.get(c.id) ?? 0);
      return {
        ...toCajaDto(c),
        asignado: fromCents(asignado),
        gastado: fromCents(gastado),
        saldo: fromCents(asignado - gastado),
        acumulado: esFondo ? fromCents(acumulado) : null,
      };
    });
  }
}
