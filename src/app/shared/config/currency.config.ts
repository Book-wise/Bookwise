export const CURRENCY_CONFIG = {
  code: 'CLP',
  locale: 'es-CL',
  symbol: '$',
  digitsInfo: '1.0-0',
} as const;

export function formatCLP(value: string | number | null | undefined): string {
  const numeric = Number(value);
  return `${CURRENCY_CONFIG.symbol}${new Intl.NumberFormat(CURRENCY_CONFIG.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(isNaN(numeric) ? 0 : numeric)}`;
}
