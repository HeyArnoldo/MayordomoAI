import { admin as adminEs } from './locales/es/admin';
import { api as apiEs } from './locales/es/api';
import { auth as authEs } from './locales/es/auth';
import { boxes as boxesEs } from './locales/es/boxes';
import { chat as chatEs } from './locales/es/chat';
import { common as commonEs } from './locales/es/common';
import { phone as phoneEs } from './locales/es/phone';
import { settings as settingsEs } from './locales/es/settings';
import { transactions as transactionsEs } from './locales/es/transactions';
import { admin as adminEn } from './locales/en/admin';
import { api as apiEn } from './locales/en/api';
import { auth as authEn } from './locales/en/auth';
import { boxes as boxesEn } from './locales/en/boxes';
import { chat as chatEn } from './locales/en/chat';
import { common as commonEn } from './locales/en/common';
import { phone as phoneEn } from './locales/en/phone';
import { settings as settingsEn } from './locales/en/settings';
import { transactions as transactionsEn } from './locales/en/transactions';

export { formatMoney, getIntlLocale } from './format';

/** Recursos para i18next: mismo objeto en web (react-i18next) y API (i18next core). */
export const resources = {
  es: {
    admin: adminEs,
    api: apiEs,
    auth: authEs,
    boxes: boxesEs,
    chat: chatEs,
    common: commonEs,
    phone: phoneEs,
    settings: settingsEs,
    transactions: transactionsEs,
  },
  en: {
    admin: adminEn,
    api: apiEn,
    auth: authEn,
    boxes: boxesEn,
    chat: chatEn,
    common: commonEn,
    phone: phoneEn,
    settings: settingsEn,
    transactions: transactionsEn,
  },
} as const;

export const defaultNS = 'common';
