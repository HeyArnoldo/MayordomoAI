import { api } from '@/lib/api';
import type { PhoneInput, VerifyCodeInput } from '@app/contracts';

export interface PhoneDto {
  id: string;
  e164: string;
  verified: boolean;
}

export const usersApi = {
  phones: async (): Promise<PhoneDto[]> => (await api.get<PhoneDto[]>('/me/phones')).data,
  /** Registra el número y dispara el código por WhatsApp. */
  linkPhone: async (input: PhoneInput): Promise<PhoneDto> =>
    (await api.post<PhoneDto>('/me/phone', input)).data,
  verifyPhone: async (input: VerifyCodeInput): Promise<PhoneDto> =>
    (await api.post<PhoneDto>('/me/phone/verify', input)).data,
  resendCode: async (): Promise<PhoneDto> => (await api.post<PhoneDto>('/me/phone/resend')).data,
  /** Botón "Saltar": cierra el onboarding sin verificar número. */
  completeOnboarding: async (): Promise<void> => {
    await api.post('/me/onboarding/complete');
  },
  /** Borrado definitivo de la cuenta (libera el número vinculado). */
  deleteAccount: async (): Promise<void> => {
    await api.delete('/me');
  },
};
