/**
 * Helpers de presentación para la ficha de una cita («Detalles de la Cita»).
 *
 * El proyecto no registra un locale de DatePipe, así que los nombres largos de
 * día y mes se formatean acá en español — igual que el resto de las etiquetas
 * del diálogo, que están escritas a mano. Los formatos numéricos (`dd/MM/yyyy`,
 * `HH:mm`) siguen usando DatePipe.
 */

const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * «viernes 14 de noviembre» a partir de un ISO string o un Date.
 * Devuelve '' cuando no hay fecha o es inválida (nunca "Invalid Date").
 */
export function formatSpanishLongDate(value?: string | Date | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

/**
 * Iniciales para el avatar de la cabecera: «Camila Rojas Fuentes» → «CR».
 * Sólo se toma la primera letra de cada campo (nunca la segunda palabra del
 * apellido). Sin datos devuelve '?' para no dejar el avatar vacío.
 */
export function personInitials(first?: string | null, last?: string | null): string {
  const initials =
    `${(first ?? '').trim().charAt(0)}${(last ?? '').trim().charAt(0)}`.toUpperCase();
  return initials || '?';
}

/**
 * Enlace de WhatsApp a partir del teléfono tal como viene del backend
 * («+56 9 8123 4567»). Se queda sólo con los dígitos: `wa.me` no acepta
 * espacios, guiones ni paréntesis. Sin dígitos devuelve null para que el
 * llamador pueda ocultar el botón en vez de pintar un enlace roto.
 */
export function whatsappHref(phone?: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}
