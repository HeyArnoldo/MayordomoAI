import { calcularSplit, fechaContable, mesContable, sumaPctValida } from './dinero';

describe('fechaContable (America/Lima, UTC-5)', () => {
  it('un gasto 11:58pm Lima cuenta para ese día, no para el día UTC', () => {
    // 2026-06-12T04:58:00Z == 2026-06-11 23:58 en Lima
    expect(fechaContable(new Date('2026-06-12T04:58:00Z'))).toBe('2026-06-11');
  });

  it('medianoche Lima cae en el día nuevo', () => {
    // 2026-06-12T05:00:00Z == 2026-06-12 00:00 en Lima
    expect(fechaContable(new Date('2026-06-12T05:00:00Z'))).toBe('2026-06-12');
  });

  it('mediodía es estable', () => {
    expect(fechaContable(new Date('2026-06-10T17:00:00Z'))).toBe('2026-06-10');
  });
});

describe('mesContable', () => {
  it('da el rango completo del mes de Lima', () => {
    expect(mesContable(new Date('2026-06-10T17:00:00Z'))).toEqual({
      desde: '2026-06-01',
      hasta: '2026-06-30',
    });
  });

  it('respeta el cambio de mes en el borde de Lima', () => {
    // 2026-07-01T04:30:00Z == 2026-06-30 23:30 Lima → sigue siendo junio
    expect(mesContable(new Date('2026-07-01T04:30:00Z'))).toEqual({
      desde: '2026-06-01',
      hasta: '2026-06-30',
    });
  });

  it('febrero bisiesto', () => {
    expect(mesContable(new Date('2028-02-15T12:00:00Z'))).toEqual({
      desde: '2028-02-01',
      hasta: '2028-02-29',
    });
  });
});

const CAJAS = [
  { id: 'a', nombre: 'Ahorro', pct: 25 },
  { id: 'v', nombre: 'Varios', pct: 20 },
  { id: 'p', nombre: 'Pasajes', pct: 15 },
  { id: 'o', nombre: 'Ocio', pct: 15 },
  { id: 'd', nombre: 'Diezmo', pct: 10 },
  { id: 's', nombre: 'Snacks', pct: 10 },
  { id: 'f', nombre: 'Ofrenda', pct: 5 },
];

describe('calcularSplit', () => {
  it('reparte S/500 según el set del design', () => {
    const split = calcularSplit(500, CAJAS);
    expect(split.find((s) => s.cajaId === 'a')!.monto).toBe(125);
    expect(split.find((s) => s.cajaId === 'f')!.monto).toBe(25);
  });

  it('la suma de las partes es EXACTAMENTE el monto (sin perder centavos)', () => {
    for (const monto of [500, 0.01, 0.07, 33.33, 1234.56, 99.99, 3200]) {
      const split = calcularSplit(monto, CAJAS);
      const suma = split.reduce((s, i) => s + Math.round(i.monto * 100), 0);
      expect(suma).toBe(Math.round(monto * 100));
    }
  });

  it('no produce montos negativos ni flotantes raros', () => {
    const split = calcularSplit(0.05, CAJAS);
    for (const item of split) {
      expect(item.monto).toBeGreaterThanOrEqual(0);
      expect(Math.round(item.monto * 100)).toBeCloseTo(item.monto * 100);
    }
  });

  it('respeta porcentajes con decimales', () => {
    const split = calcularSplit(100, [
      { id: 'x', nombre: 'X', pct: 33.33 },
      { id: 'y', nombre: 'Y', pct: 33.33 },
      { id: 'z', nombre: 'Z', pct: 33.34 },
    ]);
    const suma = split.reduce((s, i) => s + Math.round(i.monto * 100), 0);
    expect(suma).toBe(10000);
  });
});

describe('sumaPctValida', () => {
  it('acepta exactamente 100', () => {
    expect(sumaPctValida([25, 20, 15, 15, 10, 10, 5])).toBe(true);
    expect(sumaPctValida([33.33, 33.33, 33.34])).toBe(true);
  });

  it('rechaza 99.99 y 100.01', () => {
    expect(sumaPctValida([33.33, 33.33, 33.33])).toBe(false);
    expect(sumaPctValida([50, 50.01])).toBe(false);
  });
});
