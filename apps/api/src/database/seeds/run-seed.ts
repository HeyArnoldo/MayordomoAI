import '../../config/load-env';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import {
  CajaAmbito,
  CajaTipo,
  MovEstado,
  MovOrigen,
  MovTipo,
  UserEstado,
  UserRole,
} from '@app/contracts';
import dataSource from '../../config/typeorm.config';
import { User } from '../../users/user.entity';
import { Caja } from '../../cajas/caja.entity';
import { Movimiento } from '../../movimientos/movimiento.entity';
import { calcularSplit, fechaContable } from '../../common/dinero';

/**
 * Seed idempotente — seguro de correr en cada arranque:
 * 1. Admin inicial (ADMIN_EMAIL/PASSWORD), con cuenta ACTIVA (allowlist).
 * 2. Set de cajas del design + movimientos demo, solo si la cuenta no tiene
 *    cajas todavía. Doble uso: datos de desarrollo y modo demo para jueces.
 */

async function ensureAdmin(ds: DataSource): Promise<User | null> {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    console.log('[seed] ADMIN_EMAIL no definido — no se crea admin.');
    return null;
  }
  const repo = ds.getRepository(User);
  let user = await repo.findOne({ where: { email } });

  if (user) {
    if (user.role !== UserRole.ADMIN || user.estado !== UserEstado.ACTIVA) {
      user.role = UserRole.ADMIN;
      user.estado = UserEstado.ACTIVA;
      user = await repo.save(user);
      console.log(`[seed] admin activo asegurado: ${email}`);
    } else {
      console.log(`[seed] admin ya existe: ${email}`);
    }
    return user;
  }

  if (process.env.ADMIN_PASSWORD) {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
    user = await repo.save(
      repo.create({
        email,
        name: process.env.ADMIN_NAME ?? 'Admin',
        passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, rounds),
        role: UserRole.ADMIN,
        estado: UserEstado.ACTIVA,
      }),
    );
    console.log(`[seed] admin local creado: ${email}`);
    return user;
  }

  console.log(`[seed] sin ADMIN_PASSWORD — ${email} será admin al entrar con Google.`);
  return null;
}

const CAJAS_DEMO = [
  { nombre: 'Ahorro', pct: 25, tipo: CajaTipo.FONDO, ambito: CajaAmbito.PERSONAL },
  { nombre: 'Varios', pct: 20, tipo: CajaTipo.GASTO, ambito: CajaAmbito.PERSONAL },
  { nombre: 'Pasajes', pct: 15, tipo: CajaTipo.GASTO, ambito: CajaAmbito.PERSONAL },
  { nombre: 'Ocio', pct: 15, tipo: CajaTipo.GASTO, ambito: CajaAmbito.PERSONAL },
  { nombre: 'Diezmo', pct: 10, tipo: CajaTipo.GASTO, ambito: CajaAmbito.PERSONAL },
  { nombre: 'Snacks', pct: 10, tipo: CajaTipo.GASTO, ambito: CajaAmbito.PERSONAL },
  { nombre: 'Ofrenda', pct: 5, tipo: CajaTipo.GASTO, ambito: CajaAmbito.PERSONAL },
  { nombre: 'Empresa', pct: 0, tipo: CajaTipo.GASTO, ambito: CajaAmbito.EMPRESA },
];

function hace(dias: number, hora: number, min = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora, min, 0, 0);
  return d;
}

async function seedFinanzasDemo(ds: DataSource, user: User): Promise<void> {
  const cajasRepo = ds.getRepository(Caja);
  const movsRepo = ds.getRepository(Movimiento);

  const existentes = await cajasRepo.count({ where: { userId: user.id } });
  if (existentes > 0) {
    console.log('[seed] la cuenta ya tiene cajas — no se siembran datos demo.');
    return;
  }

  const cajas = await cajasRepo.save(
    CAJAS_DEMO.map((c, i) =>
      cajasRepo.create({
        userId: user.id,
        nombre: c.nombre,
        pct: c.pct.toFixed(2),
        tipo: c.tipo,
        ambito: c.ambito,
        orden: i,
      }),
    ),
  );
  const id = (nombre: string) => cajas.find((c) => c.nombre === nombre)!.id;
  const personales = cajas
    .filter((c) => c.ambito === CajaAmbito.PERSONAL)
    .map((c) => ({ id: c.id, nombre: c.nombre, pct: parseFloat(c.pct) }));

  const mov = (data: {
    tipo: MovTipo;
    caja?: string;
    monto: number;
    nota: string;
    origen: MovOrigen;
    cuando: Date;
    voz?: boolean;
    anulado?: boolean;
  }) =>
    movsRepo.create({
      userId: user.id,
      tipo: data.tipo,
      cajaId: data.caja ? id(data.caja) : null,
      monto: data.monto.toFixed(2),
      fecha: fechaContable(data.cuando),
      ocurridoAt: data.cuando,
      nota: data.nota,
      origen: data.origen,
      estado: data.anulado ? MovEstado.ANULADO : MovEstado.CONFIRMADO,
      split: data.tipo === MovTipo.INGRESO ? calcularSplit(data.monto, personales) : null,
      voz: data.voz ?? false,
      deletedAt: data.anulado ? data.cuando : null,
    });

  // Mismos datos del design: 3,200 de ingresos del mes (2,700 + 500).
  await movsRepo.save([
    mov({
      tipo: MovTipo.INGRESO,
      monto: 2700,
      nota: 'Sueldo',
      origen: MovOrigen.PWA,
      cuando: hace(9, 9, 0),
    }),
    mov({
      tipo: MovTipo.INGRESO,
      monto: 500,
      nota: 'Pago de cliente',
      origen: MovOrigen.PWA,
      cuando: hace(1, 18, 30),
    }),
    mov({
      tipo: MovTipo.GASTO,
      caja: 'Ocio',
      monto: 30,
      nota: 'Almuerzo con los chicos',
      origen: MovOrigen.WHATSAPP,
      cuando: hace(0, 13, 15),
      voz: true,
    }),
    mov({
      tipo: MovTipo.GASTO,
      caja: 'Pasajes',
      monto: 8,
      nota: 'Pasajes',
      origen: MovOrigen.WHATSAPP,
      cuando: hace(0, 8, 42),
    }),
    mov({
      tipo: MovTipo.GASTO,
      caja: 'Snacks',
      monto: 1.7,
      nota: 'Vendomática',
      origen: MovOrigen.WHATSAPP,
      cuando: hace(1, 16, 2),
    }),
    mov({
      tipo: MovTipo.TRANSITO,
      monto: 30,
      nota: 'Yape Marco — reenvío',
      origen: MovOrigen.WHATSAPP,
      cuando: hace(1, 11, 20),
    }),
    mov({
      tipo: MovTipo.GASTO,
      caja: 'Empresa',
      monto: 372.71,
      nota: 'Claude Max',
      origen: MovOrigen.PWA,
      cuando: hace(3, 9, 14),
    }),
    mov({
      tipo: MovTipo.GASTO,
      caja: 'Varios',
      monto: 45,
      nota: 'Farmacia',
      origen: MovOrigen.WHATSAPP,
      cuando: hace(3, 19, 48),
    }),
    mov({
      tipo: MovTipo.GASTO,
      caja: 'Varios',
      monto: 242.9,
      nota: 'Compras del mes',
      origen: MovOrigen.PWA,
      cuando: hace(5, 17, 10),
    }),
    mov({
      tipo: MovTipo.GASTO,
      caja: 'Ocio',
      monto: 415.66,
      nota: 'Salidas y suscripciones',
      origen: MovOrigen.PWA,
      cuando: hace(6, 20, 0),
    }),
    mov({
      tipo: MovTipo.GASTO,
      caja: 'Pasajes',
      monto: 368.5,
      nota: 'Recargas de transporte',
      origen: MovOrigen.PWA,
      cuando: hace(7, 8, 0),
    }),
    mov({
      tipo: MovTipo.GASTO,
      caja: 'Diezmo',
      monto: 320,
      nota: 'Diezmo de junio',
      origen: MovOrigen.PWA,
      cuando: hace(8, 10, 0),
    }),
    mov({
      tipo: MovTipo.GASTO,
      caja: 'Snacks',
      monto: 212.6,
      nota: 'Snacks varios',
      origen: MovOrigen.PWA,
      cuando: hace(8, 15, 0),
    }),
    mov({
      tipo: MovTipo.GASTO,
      caja: 'Ofrenda',
      monto: 100,
      nota: 'Ofrenda',
      origen: MovOrigen.PWA,
      cuando: hace(8, 10, 5),
    }),
    mov({
      tipo: MovTipo.GASTO,
      caja: 'Ocio',
      monto: 24.9,
      nota: 'Cine',
      origen: MovOrigen.PWA,
      cuando: hace(4, 20, 5),
      anulado: true,
    }),
  ]);
  console.log(`[seed] datos demo: ${cajas.length} cajas + 15 movimientos para ${user.email}`);
}

async function run(): Promise<void> {
  await dataSource.initialize();
  const admin = await ensureAdmin(dataSource);
  if (admin) await seedFinanzasDemo(dataSource, admin);
  await dataSource.destroy();
}

run().catch((err) => {
  console.error('[seed] error:', err);
  process.exit(1);
});
