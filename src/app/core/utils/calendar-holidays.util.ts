/** Mapa `YYYY-MM-DD` → nombre del feriado. */
export type HolidayMap = ReadonlyMap<string, string>;

/** `YYYY-MM-DD` en hora local (la grilla trabaja en la zona activa). */
export function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Día ISO 1–7 (1 = lunes … 7 = domingo). */
export function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * ¿El día está "cerrado" en la agenda?
 *
 * - Cierra si la sucursal tiene `working_days` configurado y el weekday del día
 *   no está incluido (día no laborable por semana).
 * - Cierra si es feriado nacional **y** el bloqueo global del tenant
 *   (`block_bookings_on_holidays`) está activo.
 */
export function isDayClosed(
  date: Date,
  workingDays: readonly number[] | undefined,
  holidays: HolidayMap,
  blockOnHolidays: boolean,
): boolean {
  const iso = isoWeekday(date);
  if (workingDays && workingDays.length > 0 && !workingDays.includes(iso)) return true;
  const holidayName = holidays.get(toYmd(date));
  return !!holidayName && blockOnHolidays;
}

/** Nombre del feriado para la fecha, o `null` si no es feriado. */
export function holidayNameFor(date: Date, holidays: HolidayMap): string | null {
  return holidays.get(toYmd(date)) ?? null;
}
