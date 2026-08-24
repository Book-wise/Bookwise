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
