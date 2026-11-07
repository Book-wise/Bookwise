/**
 * Generadores puros del contenido HTML de las cards del calendario (admin).
 *
 * La card la dibuja FullCalendar vía `eventContent` → `{ html: string }` y se
 * estiliza con CSS global en `src/styles/_calendar.scss`. No es un componente
 * Angular: sin bindings, sin PrimeNG, y todo texto interpolado se escapa a mano
 * antes de insertarse en el string.
 */

/**
 * Escapa los caracteres reservados de HTML para evitar romper el markup y
 * mitigar inyección al interpolar texto libre (nombres, servicios, motivos).
 */
export function escapeHtml(v: string): string {
  return v.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

// TODO: el artboard muestra un "✓" de confirmada en una de las cards. No se
// implementa porque no hay en el código una fuente clara de esa regla (el color
// del estado ya comunica la confirmación) y no queremos inventar semántica.

export interface EventCardInput {
  /** booking.status.color — se aplica inline como `--ev-c` (relleno de la card). */
  statusColor: string;
  clientName: string;
  /** "Kinesiología general" o "Pack · sesión 3/6". */
  serviceLabel: string;
  /** "3/6" cuando hay pack; `null` si no hay. */
  sessionPill?: string | null;
  payment: 'paid' | 'partial' | null;
  /** Hora de inicio ya formateada, p. ej. "09:00". */
  startLabel: string;
  /** Eventos de menos de 30 min (o vista mes) → variante de una sola línea. */
  isShort: boolean;
}

export function eventCardHtml(input: EventCardInput): string {
  const payClass =
    input.payment === 'paid'
      ? 'ev__pay--paid'
      : input.payment === 'partial'
        ? 'ev__pay--partial'
        : 'ev__pay--none';
  const payGlyph = input.payment === 'paid' ? '$' : input.payment === 'partial' ? 'A' : '';
  const payAria =
    input.payment === 'paid'
      ? 'aria-label="pagado"'
      : input.payment === 'partial'
        ? 'aria-label="pago parcial"'
        : 'aria-hidden="true"';

  // Cada span se emite solo si tiene contenido: la card nunca muestra
  // placeholders («Cliente», «Servicio») que parezcan datos reales.
  const hasSession = !!input.sessionPill;
  const hasRow2 = !input.isShort && (!!input.serviceLabel || hasSession);
  const row2 = hasRow2
    ? `<span class="ev__row2">${
        input.serviceLabel ? `<span class="ev__ctx">${escapeHtml(input.serviceLabel)}</span>` : ''
      }${
        hasSession
          ? `<span class="ev__marks"><span class="ev__sessions">${escapeHtml(input.sessionPill!)}</span></span>`
          : ''
      }</span>`
    : '';
  const name = input.clientName ? `<span class="ev__name">${escapeHtml(input.clientName)}</span>` : '';

  return (
    `<div class="ev" style="--ev-c:${escapeHtml(input.statusColor)}">` +
    `<span class="ev__pay ${payClass}" ${payAria}>${payGlyph}</span>` +
    `<span class="ev__main">` +
    `<span class="ev__row1">${name}<span class="ev__time">${escapeHtml(input.startLabel)}</span></span>` +
    row2 +
    `</span></div>`
  );
}

export interface BlockedCardInput {
  startLabel: string;
  endLabel: string;
  reason: string;
}

export function blockedCardHtml(input: BlockedCardInput): string {
  const range = `${input.startLabel}–${input.endLabel}`;
  return (
    `<div class="ev ev--blocked"><span class="ev__main"><span class="ev__row1">` +
    `<span class="ev__name">${escapeHtml(input.reason)}</span><span class="ev__time">${escapeHtml(range)}</span>` +
    `</span></span></div>`
  );
}
