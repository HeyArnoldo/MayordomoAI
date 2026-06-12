import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Mic, ShieldCheck } from 'lucide-react';
import { Mark, Wordmark } from '@/components/mayordomo/mark';

const CAJAS_PREVIEW = ['ahorro', 'pasajes', 'ocio', 'diezmo', 'snacks', 'varios'] as const;

/** Mini-sobre decorativo del onboarding (solapa via clip-path). */
export function EnvelopeChip({ caja, onBrand = false }: { caja?: string; onBrand?: boolean }) {
  const color = caja ? `var(--caja-${caja})` : 'rgba(255,255,255,0.6)';
  return (
    <div
      className="relative h-10 w-[54px] overflow-hidden rounded-[10px] border border-line"
      style={{
        background: onBrand
          ? 'rgba(255,255,255,0.16)'
          : `color-mix(in srgb, ${color} 9%, transparent)`,
        borderColor: onBrand ? 'transparent' : undefined,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          clipPath: 'polygon(0 0, 100% 0, 100% 20%, 50% 78%, 0 20%)',
          background: onBrand
            ? 'rgba(255,255,255,0.22)'
            : `color-mix(in srgb, ${color} 27%, transparent)`,
        }}
      />
      <div className="absolute inset-x-0 top-0 h-[2.5px]" style={{ background: color }} />
    </div>
  );
}

/**
 * Shell del onboarding/login según el design: split-screen en desktop
 * (panel de marca 44% + formulario) y página simple en mobile.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation('auth');
  return (
    <div className="flex min-h-screen bg-background">
      {/* panel de marca — solo desktop */}
      <div
        className="relative hidden w-[44%] shrink-0 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{ background: 'var(--brand)' }}
      >
        <div className="relative z-10 [&_span]:!text-on-brand">
          <Wordmark size={20} mark={30} />
        </div>
        <div className="relative z-10">
          <h1 className="text-[38px] leading-[1.1] font-bold tracking-tight text-on-brand">
            {t('shell.headline1')}
            <br />
            {t('shell.headline2')}
          </h1>
          <p className="mt-4 max-w-[380px] text-[16px] leading-relaxed text-on-brand/85">
            {t('shell.tagline')}
          </p>
          <div className="mt-8 flex gap-2.5">
            {CAJAS_PREVIEW.map((id) => (
              <EnvelopeChip key={id} onBrand />
            ))}
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-6 text-on-brand">
          {(
            [
              [MessageCircle, t('shell.features.whatsapp')],
              [Mic, t('shell.features.voice')],
              [ShieldCheck, t('shell.features.privacy')],
            ] as const
          ).map(([Icon, label]) => (
            <div key={label} className="flex items-center gap-2 opacity-90">
              <Icon className="size-4" />
              <span className="text-[12.5px] font-medium">{label}</span>
            </div>
          ))}
        </div>
        {/* textura sutil */}
        <div
          className="absolute -right-20 -bottom-24 h-[360px] w-[360px] rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />
        <div
          className="absolute top-10 right-16 h-[180px] w-[180px] rounded-full"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />
      </div>

      {/* panel del contenido */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-8">
        <div className="w-full max-w-[380px]">{children}</div>
      </div>
    </div>
  );
}

/** Cabecera de marca para la variante mobile (logo centrado + tagline). */
export function MobileBrandHeader() {
  const { t } = useTranslation('auth');
  return (
    <div className="flex flex-col items-center gap-[18px] lg:hidden">
      <Mark size={72} />
      <div className="text-center">
        <div className="text-[28px] font-bold tracking-tight text-ink">
          Mayordomo<span className="text-brand">AI</span>
        </div>
        <p className="mx-auto mt-2 max-w-[270px] text-[15px] leading-relaxed text-ink-2">
          {t('shell.mobileTagline')}
        </p>
      </div>
    </div>
  );
}

/** Botón "Continuar con Google" con el logo multicolor del design. */
export function GoogleButton({ href, label }: { href: string; label?: string }) {
  const { t } = useTranslation('auth');
  return (
    <a
      href={href}
      className="inline-flex h-[50px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-line-strong bg-surface text-[15px] font-semibold text-ink transition hover:bg-surface-alt"
    >
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path
          d="M21.6 12.2c0-.7-.06-1.4-.18-2H12v3.9h5.4a4.6 4.6 0 01-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z"
          fill="#4285F4"
        />
        <path
          d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0012 22z"
          fill="#34A853"
        />
        <path d="M6.4 14a6 6 0 010-3.9V7.5H3.1a10 10 0 000 9l3.3-2.6z" fill="#FBBC05" />
        <path
          d="M12 6c1.5 0 2.8.5 3.8 1.5L18.7 4.6A10 10 0 003.1 7.5L6.4 10c.8-2.3 3-4 5.6-4z"
          fill="#EA4335"
        />
      </svg>
      {label ?? t('shell.continueWithGoogle')}
    </a>
  );
}
