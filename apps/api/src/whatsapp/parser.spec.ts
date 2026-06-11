import { parseFastPath } from './parser';

const BOXES = ['Ahorro', 'Varios', 'Pasajes', 'Ocio', 'Diezmo', 'Snacks', 'Ofrenda', 'Empresa'];

describe('parseFastPath', () => {
  it('gasto clásico: "gasté 8 en pasajes"', () => {
    expect(parseFastPath('gasté 8 en pasajes', BOXES)).toEqual({
      kind: 'expense',
      amount: 8,
      boxName: 'Pasajes',
      note: 'Pasajes',
    });
  });

  it('variantes de verbo y mayúsculas', () => {
    expect(parseFastPath('Pague 12.50 en snacks', BOXES)).toMatchObject({
      kind: 'expense',
      amount: 12.5,
      boxName: 'Snacks',
    });
    expect(parseFastPath('anota 30 en Ocio', BOXES)).toMatchObject({
      kind: 'expense',
      amount: 30,
    });
  });

  it('acepta coma decimal y prefijo S/', () => {
    expect(parseFastPath('gasté s/ 1,70 en snacks', BOXES)).toMatchObject({
      amount: 1.7,
      boxName: 'Snacks',
    });
  });

  it('caja desconocida → null (decide el agente)', () => {
    expect(parseFastPath('gasté 20 en farmacia', BOXES)).toBeNull();
  });

  it('ingreso: "me entró 500"', () => {
    expect(parseFastPath('me entró 500', BOXES)).toEqual({
      kind: 'income',
      amount: 500,
      note: 'Ingreso',
    });
    expect(parseFastPath('ingreso 500 pago de cliente', BOXES)).toMatchObject({
      kind: 'income',
      amount: 500,
      note: 'pago de cliente',
    });
  });

  it('resumen/saldo', () => {
    expect(parseFastPath('resumen', BOXES)).toEqual({ kind: 'summary' });
    expect(parseFastPath('¿cómo voy?', BOXES)).toBeNull(); // con ¿ inicial no matchea
    expect(parseFastPath('cómo voy?', BOXES)).toEqual({ kind: 'summary' });
    expect(parseFastPath('saldo', BOXES)).toEqual({ kind: 'summary' });
  });

  it('lenguaje libre → null (agente)', () => {
    expect(parseFastPath('me tomé un café con los chicos, 12 lucas', BOXES)).toBeNull();
    expect(parseFastPath('¿cuál fue mi gasto más fuerte ayer?', BOXES)).toBeNull();
  });
});
