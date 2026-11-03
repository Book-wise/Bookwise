import { ServicePack } from '@models';

/**
 * Precio por sesión de un término: `price / total_sessions`.
 * Devuelve 0 cuando el divisor es 0 (evita NaN/Infinity en la UI).
 */
export function pricePerSession(price: string | number, totalSessions: number): number {
  if (totalSessions <= 0) return 0;
  return Number(price) / totalSessions;
}

/** Copia los packs ordenados por sesiones ascendente (no muta el original). */
export function sortPacksBySessions(packs: ServicePack[]): ServicePack[] {
  return [...packs].sort((a, b) => a.total_sessions - b.total_sessions);
}

/** Packs de un servicio, ordenados por sesiones ascendente. */
export function termsForService(packs: ServicePack[], serviceId: number): ServicePack[] {
  return sortPacksBySessions(packs.filter((p) => p.service_id === serviceId));
}

/** Iniciales del servicio (máx. 2 letras, mayúsculas) para el fallback de imagen. */
export function serviceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Normaliza para búsqueda: recorta, pasa a minúsculas y quita acentos. */
export function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
