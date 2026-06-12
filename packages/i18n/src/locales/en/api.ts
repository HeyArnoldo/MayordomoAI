import type { api as es } from '../es/api';

export const api = {
  whatsapp: {
    voiceNotUnderstood: "I couldn't make out that voice note. Could you type it for me?",
    textOnly: 'For now I only understand text and voice notes. 📝',
    expenseLogged: '✓ Logged {{amount}} in {{box}}. You have {{balance}} left.',
    incomeLogged: '✓ {{amount}} split: {{parts}}',
    aiDisabled:
      'I understand phrases like "spent 8 on transport", "got 500" or "summary". For open questions, the agent is not set up yet.',
    summary: {
      header: '*Your boxes today:*',
      fundLine: '🟢 {{name}}: {{amount}} accumulated',
      boxLine: '{{flag}} {{name}}: {{balance}} of {{allocated}}',
      available: 'Available: {{amount}}',
    },
    unknownNumber:
      "Hi 👋 I can't find an account linked to this number. Sign up at https://mayordomoai.xyz and link your number from Settings.",
    verificationCode: 'Your MayordomoAI verification code is *{{code}}*. It expires in 10 minutes.',
  },
  reminders: {
    dueToday:
      '📌 Reminder: *{{name}}* is due today — {{amount}} (box {{box}}). Should I log it? Reply "yes" and I\'ll note it down.',
  },
  errors: {
    boxNotFound: 'Box not found',
    boxNotInAllocation: 'Box {{id}} does not exist or is not part of the split',
    allocationMustSum100: 'Percentages must add up to 100 (they add up to {{total}})',
  },
  defaultBoxes: {
    savings: 'Savings',
    misc: 'Misc',
    transport: 'Transport',
    leisure: 'Leisure',
    tithe: 'Tithe',
    snacks: 'Snacks',
    offering: 'Offering',
  },
} satisfies typeof es;
