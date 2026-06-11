import { accountingDate, accountingMonth, computeSplit, isValidPctSum } from './money';

describe('accountingDate (America/Lima, UTC-5)', () => {
  it('un gasto 11:58pm Lima cuenta para ese día, no para el día UTC', () => {
    // 2026-06-12T04:58:00Z == 2026-06-11 23:58 en Lima
    expect(accountingDate(new Date('2026-06-12T04:58:00Z'))).toBe('2026-06-11');
  });

  it('medianoche Lima cae en el día nuevo', () => {
    // 2026-06-12T05:00:00Z == 2026-06-12 00:00 en Lima
    expect(accountingDate(new Date('2026-06-12T05:00:00Z'))).toBe('2026-06-12');
  });

  it('mediodía es estable', () => {
    expect(accountingDate(new Date('2026-06-10T17:00:00Z'))).toBe('2026-06-10');
  });
});

describe('accountingMonth', () => {
  it('da el rango completo del mes de Lima', () => {
    expect(accountingMonth(new Date('2026-06-10T17:00:00Z'))).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    });
  });

  it('respeta el cambio de mes en el borde de Lima', () => {
    // 2026-07-01T04:30:00Z == 2026-06-30 23:30 Lima → sigue siendo junio
    expect(accountingMonth(new Date('2026-07-01T04:30:00Z'))).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    });
  });

  it('febrero bisiesto', () => {
    expect(accountingMonth(new Date('2028-02-15T12:00:00Z'))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
  });
});

const BOXES = [
  { id: 'a', name: 'Ahorro', pct: 25 },
  { id: 'v', name: 'Varios', pct: 20 },
  { id: 'p', name: 'Pasajes', pct: 15 },
  { id: 'o', name: 'Ocio', pct: 15 },
  { id: 'd', name: 'Diezmo', pct: 10 },
  { id: 's', name: 'Snacks', pct: 10 },
  { id: 'f', name: 'Ofrenda', pct: 5 },
];

describe('computeSplit', () => {
  it('reparte S/500 según el set del design', () => {
    const split = computeSplit(500, BOXES);
    expect(split.find((s) => s.boxId === 'a')!.amount).toBe(125);
    expect(split.find((s) => s.boxId === 'f')!.amount).toBe(25);
  });

  it('la suma de las partes es EXACTAMENTE el monto (sin perder centavos)', () => {
    for (const amount of [500, 0.01, 0.07, 33.33, 1234.56, 99.99, 3200]) {
      const split = computeSplit(amount, BOXES);
      const sum = split.reduce((s, i) => s + Math.round(i.amount * 100), 0);
      expect(sum).toBe(Math.round(amount * 100));
    }
  });

  it('no produce montos negativos ni flotantes raros', () => {
    const split = computeSplit(0.05, BOXES);
    for (const item of split) {
      expect(item.amount).toBeGreaterThanOrEqual(0);
      expect(Math.round(item.amount * 100)).toBeCloseTo(item.amount * 100);
    }
  });

  it('respeta porcentajes con decimales', () => {
    const split = computeSplit(100, [
      { id: 'x', name: 'X', pct: 33.33 },
      { id: 'y', name: 'Y', pct: 33.33 },
      { id: 'z', name: 'Z', pct: 33.34 },
    ]);
    const sum = split.reduce((s, i) => s + Math.round(i.amount * 100), 0);
    expect(sum).toBe(10000);
  });
});

describe('isValidPctSum', () => {
  it('acepta exactamente 100', () => {
    expect(isValidPctSum([25, 20, 15, 15, 10, 10, 5])).toBe(true);
    expect(isValidPctSum([33.33, 33.33, 33.34])).toBe(true);
  });

  it('rechaza 99.99 y 100.01', () => {
    expect(isValidPctSum([33.33, 33.33, 33.33])).toBe(false);
    expect(isValidPctSum([50, 50.01])).toBe(false);
  });
});
