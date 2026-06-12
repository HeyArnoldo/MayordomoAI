// Mensajes server-side: errores de servicios, WhatsApp y recordatorios.
// Los montos llegan ya formateados (formatMoney) — las keys solo interpolan.
export const api = {
  whatsapp: {
    voiceNotUnderstood: 'No pude escuchar esa nota de voz. ¿Me lo escribes?',
    textOnly: 'Por ahora solo entiendo texto y notas de voz. 📝',
    expenseLogged: '✓ Anotado {{amount}} en {{box}}. Te quedan {{balance}}.',
    incomeLogged: '✓ {{amount}} repartidos: {{parts}}',
    aiDisabled:
      'Entiendo frases como "gasté 8 en pasajes", "me entró 500" o "resumen". Para preguntas libres, el agente aún no está configurado.',
    summary: {
      header: '*Tus cajas hoy:*',
      fundLine: '🟢 {{name}}: {{amount}} acumulado',
      boxLine: '{{flag}} {{name}}: {{balance}} de {{allocated}}',
      available: 'Disponible: {{amount}}',
    },
    unknownNumber:
      'Hola 👋 No encuentro una cuenta vinculada a este número. Regístrate en https://mayordomoai.xyz y vincula tu número desde Ajustes.',
    verificationCode:
      'Tu código de verificación de MayordomoAI es *{{code}}*. Vence en 10 minutos.',
  },
  reminders: {
    dueToday:
      '📌 Recordatorio: hoy vence *{{name}}* — {{amount}} (caja {{box}}). ¿Lo registro? Responde "sí" y lo anoto.',
  },
  errors: {
    boxNotFound: 'Caja no encontrada',
    boxNotInAllocation: 'Caja {{id}} no existe o no participa del reparto',
    allocationMustSum100: 'Los porcentajes deben sumar 100 (suman {{total}})',
  },
  // Nombres de las cajas que se crean al activar una cuenta. Solo aplican al
  // crearlas: después son data del usuario y jamás se tocan.
  defaultBoxes: {
    savings: 'Ahorro',
    misc: 'Varios',
    transport: 'Pasajes',
    leisure: 'Ocio',
    tithe: 'Diezmo',
    snacks: 'Snacks',
    offering: 'Ofrenda',
  },
};
