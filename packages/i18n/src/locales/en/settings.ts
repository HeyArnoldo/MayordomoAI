import type { settings as es } from '../es/settings';

export const settings = {
  languageCurrency: {
    title: 'Language & currency',
    description: 'Your butler replies in this language, including on WhatsApp.',
    languageLabel: 'Language',
    currencyLabel: 'Currency',
    currencyWarning:
      'Changing your currency does not convert existing amounts: only the symbol and format change.',
    updated: 'Preferences saved',
    updateError: 'Could not save your preferences',
  },
  // Los nombres de idioma se muestran siempre en su propio idioma.
  languages: {
    es: 'Español',
    en: 'English',
  },
  profile: {
    title: 'Profile',
    description: 'Your butler calls you by this name.',
    saveName: 'Save name',
    editName: 'Change name',
    adminBadge: 'admin',
    memberSince: 'Member since {{date}}',
  },
  appearance: {
    title: 'Appearance',
    description: 'The accent changes the main color across the whole app.',
    accents: {
      verde: 'Green',
      teal: 'Teal',
      indigo: 'Indigo',
    },
  },
  whatsapp: {
    title: 'WhatsApp',
    description: 'The number you text your butler from to log expenses.',
    verified: 'verified',
    unverified: 'unverified',
    noPhone: 'No number linked yet.',
    changeNumber: 'Change number',
    link: 'Link WhatsApp',
  },
  trail: {
    title: 'Reasoning history',
    description: 'Every audited agent step: tool, arguments and result.',
  },
  account: {
    title: 'Account',
    description: 'Deleting your account erases all your data and frees up your WhatsApp number.',
    delete: 'Delete my account',
    deleteDialog: {
      title: 'Permanently delete your account?',
      description:
        'Your boxes, transactions, conversations and fixed expenses get erased. Your WhatsApp number is freed up for another account. This CANNOT be undone.',
      confirmWord: 'DELETE',
      typeToConfirm: 'Type <word>{{word}}</word> to confirm:',
      confirm: 'Delete my account',
      deleting: 'Deleting…',
      success: 'Account deleted. Your number has been freed up.',
      error: 'Could not delete your account',
    },
  },
} satisfies typeof es;
