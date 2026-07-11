// ── Fuente única de verdad para métodos de pago que el FRONTEND puede enviar ──
// 'online' NO está aquí — solo llega desde el backend vía WooCommerce webhook.
// El frontend lo recibe y lo muestra, pero nunca lo envía.

export const PAYMENT_METHODS = {
  EFECTIVO:       'efectivo',
  TRANSFERENCIA:  'transferencia',
  DEBITO:         'débito',
  CREDITO:        'crédito',
  OTRO:           'otro',
} as const;

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];

// Para usar en <p-select> — label visible + value contraíble con el enum
export const PAYMENT_METHOD_OPTIONS: { label: string; value: string }[] = [
  { label: 'Efectivo',      value: PAYMENT_METHODS.EFECTIVO },
  { label: 'Transferencia', value: PAYMENT_METHODS.TRANSFERENCIA },
  { label: 'Débito',        value: PAYMENT_METHODS.DEBITO },
  { label: 'Crédito',       value: PAYMENT_METHODS.CREDITO },
  { label: 'Otro',          value: PAYMENT_METHODS.OTRO },
];
