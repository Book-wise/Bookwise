export const BOOKING_STATUSES = [
  { labelKey: 'status.1', label: 'Reservado',  value: 1, color: '#77D0FA', cssVar: 'var(--bw-status-reservado)',   severity: 'info' as const },
  { labelKey: 'status.2', label: 'Confirmado', value: 2, color: '#ECBE51', cssVar: 'var(--bw-status-confirmado)',  severity: 'warn' as const },
  { labelKey: 'status.3', label: 'Asiste',     value: 3, color: '#FAB5FB', cssVar: 'var(--bw-status-asiste)',      severity: 'success' as const },
  { labelKey: 'status.4', label: 'No asistio', value: 4, color: '#FCCAC2', cssVar: 'var(--bw-status-no-asistio)',  severity: 'secondary' as const },
  { labelKey: 'status.5', label: 'Pendiente',  value: 5, color: '#FD8991', cssVar: 'var(--bw-status-pendiente)',   severity: 'danger' as const },
  { labelKey: 'status.6', label: 'En espera',  value: 6, color: '#B6ED80', cssVar: 'var(--bw-status-en-espera)',   severity: 'success' as const },
  { labelKey: 'status.7', label: 'Cancelado',  value: 7, color: '#E3E7ED', cssVar: 'var(--bw-status-cancelado)',   severity: 'secondary' as const },
];

// Single source of truth — derived from BOOKING_STATUSES
export const STATUS_COLOR_MAP: Record<number, string> = Object.fromEntries(
  BOOKING_STATUSES.map((s) => [s.value, s.color]),
);

/**
 * Map a booking status to a chip CSS variable (single source of truth in _tokens.scss).
 * Resolves by `statusId` first (most reliable), then falls back to a
 * case-insensitive label match, then to a neutral gray.
 */
export function bookingStatusChipClass(statusName?: string, statusId?: number): string {
  if (statusId) {
    const status = BOOKING_STATUSES.find((s) => s.value === statusId);
    if (status) return status.cssVar;
  }
  const status = BOOKING_STATUSES.find(
    (s) => s.label.toLowerCase() === statusName?.toLowerCase(),
  );
  if (status) return status.cssVar;
  return 'var(--bw-status-cancelado)';
}

/**
 * Text colour (WCAG AA) that pairs with `bookingStatusChipClass`.
 *
 * The accent returned above (`--bw-status-*`) is unreadable as text on its own
 * 18% tint — pastel statuses like `#FCCAC2` would be invisible. Every chip that
 * renders a label next to the dot must set both variables, so the label keeps
 * the AA value while the tint and the dot keep the status accent.
 */
export function bookingStatusChipTextClass(statusName?: string, statusId?: number): string {
  const status =
    (statusId && BOOKING_STATUSES.find((s) => s.value === statusId)) ||
    BOOKING_STATUSES.find((s) => s.label.toLowerCase() === statusName?.toLowerCase());

  switch (status?.severity) {
    case 'info':
      return 'var(--bw-chip-text-online)';
    case 'warn':
      return 'var(--bw-chip-text-warning)';
    case 'success':
      return 'var(--bw-chip-text-success)';
    case 'danger':
      return 'var(--bw-chip-text-danger)';
    default:
      return 'var(--bw-chip-text-secondary)';
  }
}

/**
 * Map a sale payment status to a chip CSS variable (single source of truth in _tokens.scss).
 * Missing status is treated as unpaid.
 */
export function salePaymentChipClass(status: string | undefined): string {
  switch (status) {
    case 'paid':    return 'var(--bw-payment-paid)';
    case 'partial': return 'var(--bw-payment-partial)';
    default:        return 'var(--bw-payment-unpaid)';
  }
}
