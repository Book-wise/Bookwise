export const PAYMENT_STATUSES = [
  { label: 'No pagado', value: 'unpaid', color: '#fca5a5', severity: 'danger' as const },
  { label: 'Pago parcial', value: 'partial', color: '#fcd34d', severity: 'warn' as const },
  { label: 'Pagado', value: 'paid', color: '#86efac', severity: 'success' as const },
];

export const BOOKING_STATUSES = [
  { labelKey: 'status.1', label: 'Reservado',  value: 1, color: '#93c5fd', severity: 'info' as const },
  { labelKey: 'status.2', label: 'Confirmado', value: 2, color: '#fb923c', severity: 'warn' as const },
  { labelKey: 'status.3', label: 'Asiste',     value: 3, color: '#ec4899', severity: 'help' as const },
  { labelKey: 'status.4', label: 'No asistio', value: 4, color: '#f9a8d4', severity: 'secondary' as const },
  { labelKey: 'status.5', label: 'Pendiente',  value: 5, color: '#fca5a5', severity: 'danger' as const },
  { labelKey: 'status.6', label: 'En espera',  value: 6, color: '#86efac', severity: 'secondary' as const },
  { labelKey: 'status.7', label: 'Cancelado',  value: 7, color: '#D1D5DB', severity: 'danger' as const },
];

// Single source of truth — derived from BOOKING_STATUSES
export const STATUS_COLOR_MAP: Record<number, string> = Object.fromEntries(
  BOOKING_STATUSES.map((s) => [s.value, s.color]),
);

// ── .bw-chip variant mapping ───────────────────────────────────────────────────
// The unified badge recipe (_badges.scss) uses variant classes driven by
// `--chip-color`. These helpers replace the old per-component PrimeNG severity
// strings ('success' | 'warn' | ...) that p-tag consumed.

/** PrimeNG tag severity → `.bw-chip` variant class. */
const SEVERITY_TO_CHIP_CLASS: Record<string, string> = {
  success:   'bw-chip--success',
  danger:    'bw-chip--danger',
  warn:      'bw-chip--warning',
  help:      'bw-chip--warning',   // 'help' is not a real tag severity — mapped to warn, same as legacy
  info:      'bw-chip--online',    // blue — closest variant to the legacy blue info tag
  secondary: 'bw-chip--secondary',
  contrast:  'bw-chip--secondary',
};

/**
 * Map a booking status to a `.bw-chip` variant class.
 * Resolves by `statusId` first (most reliable), then falls back to a
 * case-insensitive label match, then to the neutral variant.
 */
export function bookingStatusChipClass(statusName?: string, statusId?: number): string {
  if (statusId) {
    const status = BOOKING_STATUSES.find((s) => s.value === statusId);
    if (status) return SEVERITY_TO_CHIP_CLASS[status.severity] ?? 'bw-chip--secondary';
  }
  const status = BOOKING_STATUSES.find(
    (s) => s.label.toLowerCase() === statusName?.toLowerCase(),
  );
  if (status) return SEVERITY_TO_CHIP_CLASS[status.severity] ?? 'bw-chip--secondary';
  return 'bw-chip--secondary';
}

/**
 * Map a sale payment status to a `.bw-chip` variant class.
 * Missing status is treated as unpaid (danger).
 */
export function salePaymentChipClass(status: string | undefined): string {
  switch (status) {
    case 'paid':    return 'bw-chip--success';
    case 'partial': return 'bw-chip--warning';
    default:        return 'bw-chip--danger';
  }
}
