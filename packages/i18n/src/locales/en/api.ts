import type { api as es } from '../es/api';

export const api = {
  whatsapp: {
    voiceNotUnderstood: "I couldn't make out that voice note. Could you type it for me?",
    imageNotUnderstood: "I couldn't process that image. Could you try again?",
    imageTooLarge: 'That image exceeds the 4 MB limit. Please send a smaller image.',
    documentNotUnderstood: "I couldn't process that document. Could you try again?",
    documentTooLarge: 'That document exceeds the 8 MB limit.',
    documentNoText:
      "I couldn't read text from that document. The PDF appears to be scanned — optical recognition is not yet available.",
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
    onboardingStarter:
      "Hi, {{name}}! 🎉 Your number is now linked to MayordomoAI.\n\nLet me help you build your personalized budget in just a few minutes. Together we'll:\n\n💼 Set up your fixed expenses (rent, subscriptions...)\n🎯 Create your savings goals\n📊 Distribute the rest across your spending categories\n\nWhat's your monthly income? I'll suggest a starting point 👇",
  },
  reminders: {
    dueToday:
      '📌 Reminder: *{{name}}* is due today — {{amount}} (box {{box}}). Should I log it? Reply "yes" and I\'ll note it down.',
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
