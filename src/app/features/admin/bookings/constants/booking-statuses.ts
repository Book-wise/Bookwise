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
