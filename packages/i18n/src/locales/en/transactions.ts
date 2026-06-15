import type { transactions as es } from '../es/transactions';

export const transactions = {
  filters: {
    all: 'All',
    expenses: 'Expenses',
    income: 'Income',
  },
  dates: {
    today: 'Today',
    yesterday: 'Yesterday',
  },
  list: {
    removeBoxFilter: 'Remove box filter',
    emptyBox: 'No transactions in {{box}} yet.',
    emptyFilter: 'No transactions match that filter.',
  },
  void: {
    title: 'Void this transaction?',
    fallbackNote: 'Transaction',
    description: 'It stays visible as voided and balances are recalculated. Nothing is deleted.',
    confirm: 'Void',
    success: 'Transaction voided',
  },
  registro: {
    title: 'Log a transaction',
    typeExpense: 'Expense',
    typeIncome: 'Income',
    incomeHint: 'It gets split automatically across your boxes by %.',
    notePlaceholder: 'Note (optional)',
    submit: 'Log it',
    success: '✓ Logged {{amount}}',
    error: 'Could not log it: {{message}}',
  },
  types: {
    expense: 'Expense',
    income: 'Income',
  },
  row: {
    voided: 'voided',
    splitAcross_one: 'split across {{count}} box',
    splitAcross_other: 'split across {{count}} boxes',
  },
  detail: {
    title: 'Transaction details',
    voiceNote: 'voice note',
    splitTitle: 'Split of this income',
    rows: {
      type: 'Type',
      box: 'Box',
      date: 'Date',
      source: 'Source',
      status: 'Status',
    },
    source: {
      whatsapp: 'WhatsApp',
      pwa: 'Web PWA',
      import: 'Imported',
    },
    status: {
      confirmed: 'Confirmed',
      voided: 'Voided',
    },
    voidAction: 'Void transaction',
    voidHint:
      'Transactions are never deleted: they are marked as voided and balances are recalculated.',
  },
} satisfies typeof es;
