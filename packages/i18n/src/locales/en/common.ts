import type { common as es } from '../es/common';

// `satisfies typeof es`: si falta o sobra una key respecto de es/, tsc falla.
export const common = {
  save: 'Save',
  cancel: 'Cancel',
  error: 'Something went wrong. Please try again.',
  close: 'Close',
  nav: {
    home: 'Home',
    transactions: 'Transactions',
    chat: 'Conversations',
    boxes: 'Boxes & split',
    settings: 'Settings',
    admin: 'Admin',
    short: {
      home: 'Home',
      transactions: 'Txns',
      chat: 'Chat',
      boxes: 'Boxes',
    },
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
    logout: 'Sign out',
  },
} satisfies typeof es;
