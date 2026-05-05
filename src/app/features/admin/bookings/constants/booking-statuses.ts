export const PAYMENT_STATUSES = [
  { label: 'No pagado',      value: 'unpaid',   color: '#fca5a5', severity: 'danger'  as const },
  { label: 'Pago parcial',   value: 'partial',  color: '#fcd34d', severity: 'warn'    as const },
  { label: 'Pagado',         value: 'paid',     color: '#86efac', severity: 'success' as const },
];

export const BOOKING_STATUSES = [
  { label: 'Reservado',  value: 1, color: '#93c5fd', severity: 'info'      as const },
  { label: 'Confirmado', value: 2, color: '#fb923c', severity: 'warn'      as const },
  { label: 'Asiste',     value: 3, color: '#ec4899', severity: 'help'      as const },
  { label: 'No asistio', value: 4, color: '#f9a8d4', severity: 'secondary' as const },
  { label: 'Pendiente',  value: 5, color: '#fca5a5', severity: 'danger'    as const },
  { label: 'En espera',  value: 6, color: '#86efac', severity: 'success'   as const },
  { label: 'Cancelado',  value: 7, color: '#ef4444', severity: 'danger'    as const },
];

export const STATUS_COLOR_MAP: Record<number, string> = {
  1: '#93c5fd', // Reservado
  2: '#fb923c', // Confirmado
  3: '#ec4899', // Asiste
  4: '#f9a8d4', // No asistio
  5: '#fca5a5', // Pendiente
  6: '#86efac', // En espera
  7: '#ef4444', // Cancelado
};
