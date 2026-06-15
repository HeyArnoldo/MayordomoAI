import {
  accountingDate,
  accountingMonth,
  computeSplit,
  computeAllocation,
  isValidPctSum,
  remainingToFill,
  sumFixedCents,
  FundingBox,
} from './money';

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

// ─── S1-T3: Funding-math unit tests (TDD) ────────────────────────────────────
//
// Income source (S1-D1 resolution):
//   income = Σ income transaction split amounts for the accounting month,
//   per-box, already computed as allocM in withBalances. The TOTAL income
//   for funding math purposes = Σ allocM.values() (sum across all personal
//   boxes). This is the accounting-month income SUM — the same source that
//   withBalances has always used.

describe('sumFixedCents', () => {
  const makeFixed = (id: string, fixedAmount: number): FundingBox => ({
    id,
    name: 'Fixed',
    mode: 'fixed',
    pct: 0,
    fixedAmount,
  });

  it('returns 0 when no fixed boxes', () => {
    const pctBox: FundingBox = { id: 'a', name: 'A', mode: 'percent', pct: 100, fixedAmount: null };
    expect(sumFixedCents([pctBox])).toBe(0);
  });

  it('sums fixedAmount in cents for fixed boxes only', () => {
    const boxes = [
      makeFixed('f1', 500),
      makeFixed('f2', 300.5),
      { id: 'p', name: 'Pct', mode: 'percent' as const, pct: 100, fixedAmount: null },
    ];
    // 500 + 300.50 = 800.50 → in cents = 80050
    expect(sumFixedCents(boxes)).toBe(80050);
  });

  it('handles single fixed box', () => {
    expect(sumFixedCents([makeFixed('f', 1000)])).toBe(100000);
  });
});

describe('remainingToFill', () => {
  it('returns max(fixedAmount - funded, 0)', () => {
    expect(remainingToFill(500, 200)).toBe(300);
  });

  it('returns 0 when fully funded', () => {
    expect(remainingToFill(500, 500)).toBe(0);
  });

  it('clamps to 0 when overfunded', () => {
    // Edge case: over-funded box (manual income split happened to exceed target)
    expect(remainingToFill(500, 600)).toBe(0);
  });

  it('handles decimal amounts correctly', () => {
    expect(remainingToFill(100.5, 50.25)).toBeCloseTo(50.25, 5);
  });
});

describe('computeAllocation — funding math', () => {
  // Helper to build FundingBox test fixtures
  const pct = (id: string, pctVal: number): FundingBox => ({
    id,
    name: id,
    mode: 'percent',
    pct: pctVal,
    fixedAmount: null,
  });
  const fixed = (id: string, amount: number): FundingBox => ({
    id,
    name: id,
    mode: 'fixed',
    pct: 0,
    fixedAmount: amount,
  });

  describe('all-percent backward-compat', () => {
    it('splits full income among percent boxes when no fixed boxes', () => {
      const boxes = [pct('a', 60), pct('b', 40)];
      const result = computeAllocation(2000, boxes);
      const a = result.find((r) => r.id === 'a')!;
      const b = result.find((r) => r.id === 'b')!;
      expect(a.allocated).toBe(1200);
      expect(b.allocated).toBe(800);
      expect(a.remainingToFill).toBeNull();
    });

    it('percent-box allocations sum exactly to income', () => {
      const boxes = [pct('a', 33.33), pct('b', 33.33), pct('c', 33.34)];
      const result = computeAllocation(100, boxes);
      const total = result.reduce((s, r) => s + r.allocated, 0);
      expect(Math.round(total * 100)).toBe(10000);
    });
  });

  describe('fixed + percent mix', () => {
    it('fixed box gets full fixedAmount; percent boxes split remainder', () => {
      // income=3000, fixed=800, remainder=2200, pct=[60,40]
      const boxes = [fixed('f', 800), pct('p60', 60), pct('p40', 40)];
      const result = computeAllocation(3000, boxes);
      const f = result.find((r) => r.id === 'f')!;
      const p60 = result.find((r) => r.id === 'p60')!;
      const p40 = result.find((r) => r.id === 'p40')!;
      expect(f.allocated).toBe(800);
      expect(p60.allocated).toBe(1320); // 0.6 * 2200
      expect(p40.allocated).toBe(880); // 0.4 * 2200
    });

    it('zero fixed boxes → remainder equals full income', () => {
      const boxes = [pct('a', 100)];
      const result = computeAllocation(2000, boxes);
      expect(result[0].allocated).toBe(2000);
    });

    it('remainingToFill is returned for fixed boxes', () => {
      const boxes = [fixed('f', 500)];
      const result = computeAllocation(1000, boxes);
      const f = result.find((r) => r.id === 'f')!;
      expect(f.allocated).toBe(500);
      // amountFunded not passed here — returns allocated as both target; service computes fill
      expect(f.remainingToFill).not.toBeNull();
    });

    it('fixed exactly equals income — remainder is 0, percent boxes get 0', () => {
      // income=1000, fixed=1000 → remainder=0, but this is a guard case:
      // fixed_exceeds_income fires when fixedTotal >= income.
      // Here we test the math clamps to 0 remainder (guard is enforced in service).
      const boxes = [fixed('f', 1000), pct('p', 100)];
      const result = computeAllocation(1000, boxes);
      const f = result.find((r) => r.id === 'f')!;
      const p = result.find((r) => r.id === 'p')!;
      expect(f.allocated).toBe(1000);
      expect(p.allocated).toBe(0); // remainder clamped to 0
    });

    it('fixed exceeds income — remainder clamps to 0, percent boxes get 0', () => {
      // Guard throws in service; math clamps here
      const boxes = [fixed('f', 1500), pct('p', 100)];
      const result = computeAllocation(1000, boxes);
      const p = result.find((r) => r.id === 'p')!;
      expect(p.allocated).toBe(0);
    });
  });

  describe('isValidPctSum with mode filtering', () => {
    it('validates only percent boxes — fixed boxes excluded', () => {
      // percent boxes sum to 100, fixed box excluded → valid
      const pcts = [60, 40]; // only from percent boxes
      expect(isValidPctSum(pcts)).toBe(true);
    });

    it('rejects when percent boxes do not sum to 100', () => {
      const pcts = [60, 30]; // sum=90
      expect(isValidPctSum(pcts)).toBe(false);
    });

    it('empty array of percent boxes is invalid (sum=0, not 100)', () => {
      expect(isValidPctSum([])).toBe(false);
    });
  });
});
