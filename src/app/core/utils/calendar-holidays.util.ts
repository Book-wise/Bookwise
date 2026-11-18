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
 * Clasifica el día: `'holiday'` (feriado nacional con el bloqueo activo) o
 * `'closed'` (weekday fuera de `working_days`). El feriado tiene prioridad
 * porque se marca con otro color en la agenda.
 */
export type DayClosedKind = 'holiday' | 'closed' | null;

export function dayClosedKind(
  date: Date,
  workingDays: readonly number[] | undefined,
  holidays: HolidayMap,
  blockOnHolidays: boolean,
): DayClosedKind {
  const holidayName = holidays.get(toYmd(date));
  if (holidayName && blockOnHolidays) return 'holiday';
  const iso = isoWeekday(date);
  if (workingDays && workingDays.length > 0 && !workingDays.includes(iso)) return 'closed';
  return null;
}

/**
 * ¿El día está "cerrado" en la agenda? (feriado bloqueado **o** weekday no laborable).
 */
export function isDayClosed(
  date: Date,
  workingDays: readonly number[] | undefined,
  holidays: HolidayMap,
  blockOnHolidays: boolean,
): boolean {
  return dayClosedKind(date, workingDays, holidays, blockOnHolidays) !== null;
}

/** Nombre del feriado para la fecha, o `null` si no es feriado. */
export function holidayNameFor(date: Date, holidays: HolidayMap): string | null {
  return holidays.get(toYmd(date)) ?? null;
}
