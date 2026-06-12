export const settings = {
  languageCurrency: {
    title: 'Idioma y moneda',
    description: 'El mayordomo te responde en este idioma, también por WhatsApp.',
    languageLabel: 'Idioma',
    currencyLabel: 'Moneda',
    currencyWarning:
      'Cambiar la moneda no convierte tus montos existentes: solo cambia el símbolo y el formato.',
    updated: 'Preferencias guardadas',
    updateError: 'No se pudieron guardar las preferencias',
  },
  languages: {
    es: 'Español',
    en: 'English',
  },
  profile: {
    title: 'Perfil',
    description: 'El mayordomo te llama por este nombre.',
    saveName: 'Guardar nombre',
    editName: 'Cambiar nombre',
    adminBadge: 'admin',
    memberSince: 'Miembro desde el {{date}}',
  },
  appearance: {
    title: 'Apariencia',
    description: 'El acento cambia el color principal de toda la app.',
    accents: {
      verde: 'Verde',
      teal: 'Teal',
      indigo: 'Indigo',
    },
  },
  whatsapp: {
    title: 'WhatsApp',
    description: 'El número desde el que le escribes al mayordomo para anotar gastos.',
    verified: 'verificado',
    unverified: 'sin verificar',
    noPhone: 'Sin número vinculado todavía.',
    changeNumber: 'Cambiar número',
    link: 'Vincular WhatsApp',
  },
  trail: {
    title: 'Historial de razonamiento',
    description: 'Cada paso del agente auditado: herramienta, argumentos y resultado.',
  },
  account: {
    title: 'Cuenta',
    description: 'Eliminar tu cuenta borra todos tus datos y libera tu número de WhatsApp.',
    delete: 'Eliminar mi cuenta',
    deleteDialog: {
      title: '¿Eliminar tu cuenta definitivamente?',
      description:
        'Se borran tus cajas, movimientos, conversaciones y gastos fijos. Tu número de WhatsApp queda liberado para otra cuenta. Esto NO se puede deshacer.',
      confirmWord: 'ELIMINAR',
      typeToConfirm: 'Escribe <word>{{word}}</word> para confirmar:',
      confirm: 'Eliminar mi cuenta',
      deleting: 'Eliminando…',
      success: 'Cuenta eliminada. Tu número quedó liberado.',
      error: 'No se pudo eliminar la cuenta',
    },
  },
};
