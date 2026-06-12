import type { phone as es } from '../es/phone';

export const phone = {
  link: {
    linkTitle: 'Link WhatsApp',
    changeTitle: 'Change WhatsApp number',
    phoneStepDescription: 'The number you text your butler from to log expenses.',
    codeStepDescription: 'We sent a 6-digit code over WhatsApp to {{phone}}.',
    verified: 'verified',
    unverified: 'unverified',
    digitsHint:
      'Digits only — pick the country code on the left. A number can only belong to one account.',
    changeWarning:
      'When you change it, your current number stops working with the bot UNTIL you verify the new one.',
    sendCode: 'Send code over WhatsApp',
    sendingCode: 'Sending code…',
    notReceived: "Didn't get it?",
    resendCooldown: 'Resend code (0:{{seconds}})',
    resend: 'Resend code',
    resending: 'Resending…',
    verifyAndLink: 'Verify and link',
    verifying: 'Verifying…',
    changeNumber: 'Change the number',
    alreadyVerified: 'That number is already verified',
    verifiedLinked: 'Number verified and linked',
    resent: 'Code resent over WhatsApp',
    linkError: 'Could not register the number',
    codeError: 'Incorrect code',
    resendError: 'Could not resend it',
  },
  input: {
    countryLabel: 'Country',
    searchPlaceholder: 'Search by country or code (51, peru, PE)…',
    noMatch: 'No country matches.',
    frequent: 'Frequent',
    allCountries: 'All countries',
    phoneLabel: 'Phone number',
  },
} satisfies typeof es;
