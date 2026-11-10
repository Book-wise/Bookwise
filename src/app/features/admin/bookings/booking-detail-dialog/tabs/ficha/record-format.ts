/**
 * Formateo de fechas compartido por la pestaña Ficha (tarjetas de la lista y
 * detalle inline). Sin dependencias: se usan formatos fijos es-CL.
 */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Fecha de calendario `dd/mm/aaaa`.
 *
 * Si el valor ya viene como `YYYY-MM-DD` (un `input type="date"`), se recorta la
 * parte de fecha en vez de pasarla a `new Date()`: así no se corre un día por la
 * zona horaria. Cualquier otro ISO cae a `new Date()`.
 */
export function formatDate(value: string): string {
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Fecha y hora locales `dd/mm/aaaa - h:mm am/pm`. Cadena vacía si no es fecha. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  let hours = date.getHours();
  const suffix = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} - ${hours}:${pad(date.getMinutes())} ${suffix}`;
}
