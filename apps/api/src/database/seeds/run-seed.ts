import '../../config/load-env';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import {
  BoxScope,
  BoxType,
  TransactionSource,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
} from '@app/contracts';
import dataSource from '../../config/typeorm.config';
import { User } from '../../users/user.entity';
import { Box } from '../../boxes/box.entity';
import { Transaction } from '../../transactions/transaction.entity';
import { accountingDate, computeSplit } from '../../common/money';

/**
 * Seed idempotente — seguro de correr en cada arranque:
 * 1. Admin inicial (ADMIN_EMAIL/PASSWORD), con cuenta ACTIVE (allowlist).
 * 2. Set de cajas del design + transacciones demo, solo si la cuenta no tiene
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
    if (user.role !== UserRole.ADMIN || user.status !== UserStatus.ACTIVE) {
      user.role = UserRole.ADMIN;
      user.status = UserStatus.ACTIVE;
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
        status: UserStatus.ACTIVE,
      }),
    );
    console.log(`[seed] admin local creado: ${email}`);
    return user;
  }

  console.log(`[seed] sin ADMIN_PASSWORD — ${email} será admin al entrar con Google.`);
  return null;
}

// Los nombres de cajas son DATOS del usuario (idioma del producto: español).
const DEMO_BOXES = [
  { name: 'Ahorro', pct: 25, type: BoxType.FUND, scope: BoxScope.PERSONAL },
  { name: 'Varios', pct: 20, type: BoxType.EXPENSE, scope: BoxScope.PERSONAL },
  { name: 'Pasajes', pct: 15, type: BoxType.EXPENSE, scope: BoxScope.PERSONAL },
  { name: 'Ocio', pct: 15, type: BoxType.EXPENSE, scope: BoxScope.PERSONAL },
  { name: 'Diezmo', pct: 10, type: BoxType.EXPENSE, scope: BoxScope.PERSONAL },
  { name: 'Snacks', pct: 10, type: BoxType.EXPENSE, scope: BoxScope.PERSONAL },
  { name: 'Ofrenda', pct: 5, type: BoxType.EXPENSE, scope: BoxScope.PERSONAL },
  { name: 'Empresa', pct: 0, type: BoxType.EXPENSE, scope: BoxScope.BUSINESS },
];

function daysAgo(days: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function seedDemoFinances(ds: DataSource, user: User): Promise<void> {
  const boxesRepo = ds.getRepository(Box);
  const txRepo = ds.getRepository(Transaction);

  const existing = await boxesRepo.count({ where: { userId: user.id } });
  if (existing > 0) {
    console.log('[seed] la cuenta ya tiene cajas — no se siembran datos demo.');
    return;
  }

  const boxes = await boxesRepo.save(
    DEMO_BOXES.map((b, i) =>
      boxesRepo.create({
        userId: user.id,
        name: b.name,
        pct: b.pct.toFixed(2),
        type: b.type,
        scope: b.scope,
        sortOrder: i,
      }),
    ),
  );
  const boxId = (name: string) => boxes.find((b) => b.name === name)!.id;
  const personal = boxes
    .filter((b) => b.scope === BoxScope.PERSONAL)
    .map((b) => ({ id: b.id, name: b.name, pct: parseFloat(b.pct) }));

  const tx = (data: {
    type: TransactionType;
    box?: string;
    amount: number;
    note: string;
    source: TransactionSource;
    when: Date;
    voice?: boolean;
    voided?: boolean;
  }) =>
    txRepo.create({
      userId: user.id,
      type: data.type,
      boxId: data.box ? boxId(data.box) : null,
      amount: data.amount.toFixed(2),
      date: accountingDate(data.when),
      occurredAt: data.when,
      note: data.note,
      source: data.source,
      status: data.voided ? TransactionStatus.VOIDED : TransactionStatus.CONFIRMED,
      split: data.type === TransactionType.INCOME ? computeSplit(data.amount, personal) : null,
      voice: data.voice ?? false,
      deletedAt: data.voided ? data.when : null,
    });

  // Mismos datos del design: 3,200 de ingresos del mes (2,700 + 500).
  const W = TransactionSource.WHATSAPP;
  const P = TransactionSource.PWA;
  const E = TransactionType.EXPENSE;
  await txRepo.save([
    tx({
      type: TransactionType.INCOME,
      amount: 2700,
      note: 'Sueldo',
      source: P,
      when: daysAgo(9, 9),
    }),
    tx({
      type: TransactionType.INCOME,
      amount: 500,
      note: 'Pago de cliente',
      source: P,
      when: daysAgo(1, 18, 30),
    }),
    tx({
      type: E,
      box: 'Ocio',
      amount: 30,
      note: 'Almuerzo con los chicos',
      source: W,
      when: daysAgo(0, 13, 15),
      voice: true,
    }),
    tx({ type: E, box: 'Pasajes', amount: 8, note: 'Pasajes', source: W, when: daysAgo(0, 8, 42) }),
    tx({
      type: E,
      box: 'Snacks',
      amount: 1.7,
      note: 'Vendomática',
      source: W,
      when: daysAgo(1, 16, 2),
    }),
    tx({
      type: E,
      box: 'Empresa',
      amount: 372.71,
      note: 'Claude Max',
      source: P,
      when: daysAgo(3, 9, 14),
    }),
    tx({
      type: E,
      box: 'Varios',
      amount: 45,
      note: 'Farmacia',
      source: W,
      when: daysAgo(3, 19, 48),
    }),
    tx({
      type: E,
      box: 'Varios',
      amount: 242.9,
      note: 'Compras del mes',
      source: P,
      when: daysAgo(5, 17, 10),
    }),
    tx({
      type: E,
      box: 'Ocio',
      amount: 415.66,
      note: 'Salidas y suscripciones',
      source: P,
      when: daysAgo(6, 20),
    }),
    tx({
      type: E,
      box: 'Pasajes',
      amount: 368.5,
      note: 'Recargas de transporte',
      source: P,
      when: daysAgo(7, 8),
    }),
    tx({
      type: E,
      box: 'Diezmo',
      amount: 320,
      note: 'Diezmo de junio',
      source: P,
      when: daysAgo(8, 10),
    }),
    tx({
      type: E,
      box: 'Snacks',
      amount: 212.6,
      note: 'Snacks varios',
      source: P,
      when: daysAgo(8, 15),
    }),
    tx({
      type: E,
      box: 'Ofrenda',
      amount: 100,
      note: 'Ofrenda',
      source: P,
      when: daysAgo(8, 10, 5),
    }),
    tx({
      type: E,
      box: 'Ocio',
      amount: 24.9,
      note: 'Cine',
      source: P,
      when: daysAgo(4, 20, 5),
      voided: true,
    }),
  ]);
  console.log(`[seed] datos demo: ${boxes.length} cajas + 14 transacciones para ${user.email}`);
}

async function run(): Promise<void> {
  await dataSource.initialize();
  const admin = await ensureAdmin(dataSource);
  if (admin) await seedDemoFinances(dataSource, admin);
  await dataSource.destroy();
}

run().catch((err) => {
  console.error('[seed] error:', err);
  process.exit(1);
});
