import axios from 'axios';
import { queryClient } from './query-client';

/**
 * Cliente HTTP centralizado. withCredentials: true → manda/recibe la cookie
 * httpOnly de sesión. En dev VITE_API_URL va vacía: pega a /api (mismo origen)
 * y el proxy de Vite lo reenvía a la API. En producción: URL absoluta.
 */
export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api`,
  withCredentials: true,
});

/**
 * Guarda anti-HTML: si VITE_API_URL falta o el backend no responde, la request
 * puede caer en el dev server y volver index.html (status 200). Sin esto, ese
 * string HTML se cuela como "datos" y rompe los componentes. Lo convertimos
 * en error de query visible.
 */
api.interceptors.response.use((response) => {
  const contentType = String(response.headers?.['content-type'] ?? '');
  const looksLikeHtml =
    contentType.includes('text/html') ||
    (typeof response.data === 'string' && /^\s*<(?:!doctype|html)/i.test(response.data));

  if (looksLikeHtml) {
    throw new Error(
      'API devolvió HTML en vez de JSON. Falta VITE_API_URL o el backend no responde.',
    );
  }
  return response;
});

/**
 * Frescura de sesión: el backend autoriza con datos frescos de BD en cada
 * request, pero la UI cachea "quién soy". Ante un rechazo, se sincroniza:
 * 401 → sesión muerta (ProtectedRoute redirige a login); 403 → el rol o
 * status cambió en BD (se refetchea y los guards de ruta re-evalúan).
 */
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status === 401) {
      queryClient.setQueryData(['auth', 'me'], null);
    } else if (status === 403) {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    }
    return Promise.reject(error);
  },
);
