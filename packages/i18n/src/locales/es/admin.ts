// Panel de administración de usuarios.
export const admin = {
  statuses: {
    pending: 'Pendiente',
    active: 'Activa',
    suspended: 'Suspendida',
  },
  roles: {
    user: 'Usuario',
    admin: 'Admin',
  },
  tabs: {
    pending: 'Pendientes',
    allUsers: 'Todos los usuarios',
    usage: 'Uso',
  },
  toasts: {
    statusChanged: '{{name}}: cuenta {{status}}',
    statusError: 'No se pudo cambiar el status',
    roleChangedAdmin: '{{name}} ahora es admin',
    roleChangedUser: '{{name}} ahora es usuario',
    roleError: 'No se pudo cambiar el rol',
  },
  pending: {
    emptyTitle: 'Sin solicitudes pendientes',
    emptyBody: 'Cuando alguien entre con Google aparecerá aquí.',
    since: 'desde el {{date}}',
    reject: 'Rechazar',
    approve: 'Aprobar',
  },
  table: {
    user: 'Usuario',
    whatsapp: 'WhatsApp',
    status: 'Status',
    role: 'Rol',
    joined: 'Alta',
    adminYou: 'Admin (tú)',
    note: 'No puedes cambiar tu propio rol ni status, y el último admin no puede ser degradado — asigna otro admin primero.',
  },
  usage: {
    kinds: {
      agent: 'Agente',
      title: 'Títulos',
      transcription: 'Voz',
    },
    last7: 'Últimos 7 días',
    last30: 'Últimos 30 días',
    last90: 'Últimos 90 días',
    calls_one: 'llamada',
    calls_other: 'llamadas',
    estimatedCost: 'costo estimado',
    emptyTitle: 'Sin uso de IA en el período',
    emptyBody: 'Cada mensaje al agente, título y nota de voz aparecerá aquí con su costo.',
    table: {
      calls: 'Llamadas',
      tokensIn: 'Tokens in',
      tokensOut: 'Tokens out',
      breakdown: 'Desglose',
      estCost: 'Costo est.',
    },
    note: 'Costos ESTIMADOS con precios locales por modelo (no es la factura del provider). Modelos sin precio conocido registran tokens pero costo $0.',
  },
};
