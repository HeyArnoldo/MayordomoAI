// Vinculación y verificación del número de WhatsApp.
export const phone = {
  link: {
    linkTitle: 'Vincular WhatsApp',
    changeTitle: 'Cambiar número de WhatsApp',
    phoneStepDescription: 'El número desde el que le escribes al mayordomo para anotar gastos.',
    codeStepDescription: 'Te enviamos un código de 6 dígitos por WhatsApp al {{phone}}.',
    verified: 'verificado',
    unverified: 'sin verificar',
    digitsHint:
      'Solo dígitos — el código del país se elige a la izquierda. Un número solo puede pertenecer a una cuenta.',
    changeWarning:
      'Al cambiar, tu número actual deja de funcionar con el bot HASTA que verifiques el nuevo.',
    sendCode: 'Enviar código por WhatsApp',
    sendingCode: 'Enviando código…',
    notReceived: '¿No te llegó?',
    resendCooldown: 'Reenviar código (0:{{seconds}})',
    resend: 'Reenviar código',
    resending: 'Reenviando…',
    verifyAndLink: 'Verificar y vincular',
    verifying: 'Verificando…',
    changeNumber: 'Cambiar el número',
    alreadyVerified: 'Ese número ya está verificado',
    verifiedLinked: 'Número verificado y vinculado',
    resent: 'Código reenviado por WhatsApp',
    linkError: 'No se pudo registrar el número',
    codeError: 'Código incorrecto',
    resendError: 'No se pudo reenviar',
  },
  input: {
    countryLabel: 'País',
    searchPlaceholder: 'Busca por país o código (51, perú, PE)…',
    noMatch: 'Ningún país coincide.',
    frequent: 'Frecuentes',
    allCountries: 'Todos los países',
    phoneLabel: 'Número de teléfono',
  },
};
