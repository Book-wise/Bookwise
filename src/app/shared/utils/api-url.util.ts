import { environment } from '@env/environment';

/**
 * Resuelve una ruta pública de storage devuelta por la API a una URL absoluta.
 *
 * El backend guarda y devuelve rutas RELATIVAS a la raíz pública
 * (p. ej. `/storage/user-avatars/x.webp`), a propósito, para que el valor no
 * quede acoplado al origen que lo generó (APP_URL). Así el mismo dato sirve en
 * dev, prod, tras un proxy o un cambio de dominio con una única configuración
 * en el cliente (`environment.apiUrl`).
 *
 * - Si el valor es una URL absoluta (`http(s)://…` o `//…`), se devuelve tal
 *   cual (permite datos ya persistidos con URL completa).
 * - Si es una ruta relativa que empieza por `/`, se antepone el origen de la
 *   API configurada (sin el path `/api/v1`, que solo aplica al endpoint).
 * - Si es null/undefined/vacío, se devuelve null.
 */
export function resolveApiUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) {
    return raw;
  }

  if (raw.startsWith('/')) {
    try {
      const { origin } = new URL(environment.apiUrl);
      return `${origin}${raw}`;
    } catch {
      return raw;
    }
  }

  return raw;
}
