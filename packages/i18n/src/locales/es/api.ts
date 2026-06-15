// Mensajes server-side: errores de servicios, WhatsApp y recordatorios.
// Los montos llegan ya formateados (formatMoney) — las keys solo interpolan.
export const api = {
  whatsapp: {
    voiceNotUnderstood: 'No pude escuchar esa nota de voz. ¿Me lo escribes?',
    imageNotUnderstood: 'No pude procesar esa imagen. ¿Puedes intentarlo de nuevo?',
    imageTooLarge: 'Esa imagen supera el límite de 4 MB. Envía una imagen más pequeña.',
    documentNotUnderstood: 'No pude procesar ese documento. ¿Puedes intentarlo de nuevo?',
    documentTooLarge: 'Ese documento supera el límite de 8 MB.',
    documentNoText:
      'No pude leer texto en ese documento. El PDF parece ser escaneado — el reconocimiento óptico aún no está disponible.',
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
    onboardingStarter:
      '¡Hola, {{name}}! 🎉 Tu número ya está vinculado a MayordomoAI.\n\nAhora te ayudo a construir tu presupuesto personalizado en unos minutos. Juntos vamos a:\n\n💼 Registrar tus gastos fijos (alquiler, suscripciones...)\n🎯 Crear tus metas de ahorro\n📊 Distribuir el resto entre tus categorías de gasto\n\n¿Cuánto es tu ingreso mensual? Te propongo un punto de partida 👇',
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
