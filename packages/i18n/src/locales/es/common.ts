/**
 * Namespace base. Los textos del producto van en español neutro (sin voseo).
 * `es` es la fuente de verdad de keys: `en` se tipa con `satisfies typeof es`,
 * así una key faltante en cualquiera de los dos lados rompe el typecheck.
 */
export const common = {
  save: 'Guardar',
  cancel: 'Cancelar',
  error: 'Algo salió mal. Inténtalo de nuevo.',
  close: 'Cerrar',
  nav: {
    home: 'Inicio',
    transactions: 'Movimientos',
    chat: 'Conversaciones',
    boxes: 'Cajas y reparto',
    settings: 'Configuración',
    admin: 'Administración',
    short: {
      home: 'Inicio',
      transactions: 'Movs',
      chat: 'Chat',
      boxes: 'Cajas',
    },
    lightMode: 'Modo claro',
    darkMode: 'Modo oscuro',
    logout: 'Cerrar sesión',
  },
};
