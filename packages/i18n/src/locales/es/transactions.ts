// Movimientos: listado, detalle, registro manual de gastos/ingresos.
export const transactions = {
  filters: {
    all: 'Todos',
    expenses: 'Gastos',
    income: 'Ingresos',
    transit: 'Tránsito',
  },
  dates: {
    today: 'Hoy',
    yesterday: 'Ayer',
  },
  list: {
    removeBoxFilter: 'Quitar filtro de caja',
    emptyBox: 'Sin movimientos en {{box}} todavía.',
    emptyFilter: 'No hay movimientos con ese filtro.',
  },
  void: {
    title: '¿Anular este movimiento?',
    fallbackNote: 'Movimiento',
    description: 'Queda visible como anulado y los saldos se recalculan. No se borra nada.',
    confirm: 'Anular',
    success: 'Movimiento anulado',
  },
  registro: {
    title: 'Registrar movimiento',
    typeExpense: 'Gasto',
    typeIncome: 'Ingreso',
    typeTransit: 'Tránsito',
    incomeHint: 'Se reparte automáticamente entre tus cajas según %.',
    notePlaceholder: 'Nota (opcional)',
    submit: 'Registrar',
    success: '✓ Registrado {{amount}}',
    error: 'No se pudo registrar: {{message}}',
  },
  // Etiquetas de tipo compartidas entre fila y detalle de movimiento.
  types: {
    expense: 'Gasto',
    income: 'Ingreso',
    transit: 'Tránsito',
  },
  row: {
    voided: 'anulado',
    splitAcross_one: 'repartido en {{count}} caja',
    splitAcross_other: 'repartido en {{count}} cajas',
  },
  detail: {
    title: 'Detalle del movimiento',
    voiceNote: 'nota de voz',
    splitTitle: 'Reparto de este ingreso',
    rows: {
      type: 'Tipo',
      box: 'Caja',
      date: 'Fecha',
      source: 'Origen',
      status: 'Estado',
    },
    source: {
      whatsapp: 'WhatsApp',
      pwa: 'PWA web',
      import: 'Importado',
    },
    status: {
      confirmed: 'Confirmado',
      voided: 'Anulado',
    },
    voidAction: 'Anular movimiento',
    voidHint: 'Los movimientos no se borran: se marcan como anulados y el saldo se recalcula.',
  },
};
