import type { auth as es } from '../es/auth';

export const auth = {
  login: {
    title: 'Sign in',
    subtitle:
      'Sign in with your Google account. Access is invite-only — your account activates once approved.',
    invalidCredentials: 'Invalid credentials',
    or: 'Or',
    emailLabel: 'Email',
    emailPlaceholder: 'you@email.com',
    passwordLabel: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in…',
    showLocal: 'Sign in with email and password',
    noAccount: 'No account?',
    registerLink: 'Sign up',
    waitlistCardTitle: 'No access yet?',
    waitlistCardBody:
      'Sign in with Google and join the waitlist — we activate you as soon as a spot opens up.',
    inviteOnly: 'Invite-only access — your account activates once approved',
  },
  register: {
    title: 'Create account',
    subtitle: 'Get started in seconds',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    emailLabel: 'Email',
    emailPlaceholder: 'you@email.com',
    passwordLabel: 'Password',
    submit: 'Create account',
    submitting: 'Creating…',
    createError: 'Could not create the account. Does that email already exist?',
    haveAccount: 'Already have an account?',
    loginLink: 'Sign in',
  },
  waitlist: {
    title: "You're on the waitlist",
    body: "Hi, {{name}}. Your account is created and under review — once it's approved you go straight to onboarding.",
    suspendedTitle: 'Account suspended',
    suspendedBody:
      "Your account was suspended. If you think this is a mistake, write to us and we'll look into it.",
    checking: 'Checking for approval automatically…',
    logout: 'Sign out',
  },
  onboarding: {
    stepOf: 'Step {{step}} of {{total}}',
    phone: {
      title: 'Your WhatsApp number',
      subtitle:
        "It's the number you'll text your butler from to log expenses. We'll send you a code to confirm it's yours.",
      hint: 'Digits only — pick the country code on the left. A number can only belong to one account.',
      submit: 'Send code via WhatsApp',
      submitting: 'Sending code…',
      skipPrefix: 'Link later ·',
      skipAction: 'Skip →',
    },
    code: {
      title: 'Verify your number',
      subtitle:
        'We sent you a 6-digit code via WhatsApp. This way nobody can claim a number that is not theirs.',
      phoneCardHint: "Number you'll text the bot from",
      change: 'Change',
      notReceived: "Didn't get it?",
      resend: 'Resend code',
      resending: 'Resending…',
      verify: 'Verify and link',
      verifying: 'Verifying…',
      oneAccount: 'A number can only belong to one account.',
      skip: 'Skip →',
    },
    toasts: {
      alreadyVerified: 'Number already verified',
      linkError: 'Could not register the number',
      verified: 'Number verified and linked',
      wrongCode: 'Incorrect code',
      resent: 'Code resent via WhatsApp',
      resendError: 'Could not resend',
      skipError: 'Could not skip',
    },
  },
  shell: {
    headline1: 'Your money,',
    headline2: 'in mini-boxes.',
    tagline:
      'Split every income automatically and log expenses by chatting on WhatsApp. The butler keeps track for you.',
    features: {
      whatsapp: 'Log via WhatsApp',
      voice: 'Voice notes',
      privacy: 'Your history, yours alone',
    },
    mobileTagline: 'Your money in mini-boxes, managed by chatting on WhatsApp.',
    continueWithGoogle: 'Continue with Google',
  },
} satisfies typeof es;
