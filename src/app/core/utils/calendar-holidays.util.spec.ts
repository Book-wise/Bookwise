import { isDayClosed, dayClosedKind, toYmd, isoWeekday, holidayNameFor } from './calendar-holidays.util';

describe('calendar-holidays util', () => {
  const localDate = (y: number, m: number, d: number) => new Date(y, m - 1, d);

  it('toYmd zero-pads and isoWeekday maps Sunday to 7', () => {
    expect(toYmd(localDate(2026, 1, 5))).toBe('2026-01-05');
    expect(isoWeekday(localDate(2026, 1, 4))).toBe(7); // domingo
    expect(isoWeekday(localDate(2026, 1, 5))).toBe(1); // lunes
  });

  it('closes a weekday that is not in working_days', () => {
    const sunday = localDate(2026, 1, 4);
    expect(isDayClosed(sunday, [1, 2, 3, 4, 5, 6], new Map(), true)).toBe(true);
    expect(isDayClosed(sunday, [1, 2, 3, 4, 5, 6, 7], new Map(), true)).toBe(false);
  });

  it('does not close by weekday when working_days is missing or empty', () => {
    const sunday = localDate(2026, 1, 4);
    expect(isDayClosed(sunday, undefined, new Map(), true)).toBe(false);
    expect(isDayClosed(sunday, [], new Map(), true)).toBe(false);
  });

  it('closes a holiday only when the global blocking is on', () => {
    const holiday = new Map([['2026-01-01', 'Año Nuevo']]);
    const jan1 = localDate(2026, 1, 1); // jueves, dentro de lun-sáb
    expect(isDayClosed(jan1, [1, 2, 3, 4, 5, 6], holiday, true)).toBe(true);
    expect(isDayClosed(jan1, [1, 2, 3, 4, 5, 6], holiday, false)).toBe(false);
  });

  it('holidayNameFor returns the name or null', () => {
    const holiday = new Map([['2026-01-01', 'Año Nuevo']]);
    expect(holidayNameFor(localDate(2026, 1, 1), holiday)).toBe('Año Nuevo');
    expect(holidayNameFor(localDate(2026, 1, 2), holiday)).toBeNull();
  });

  it('dayClosedKind prefers "holiday" over "closed" and returns null when open', () => {
    const holiday = new Map([['2026-01-04', 'Feriado domingo']]); // domingo
    const sunday = localDate(2026, 1, 4);
    const monday = localDate(2026, 1, 5);
    const monToSat = [1, 2, 3, 4, 5, 6];

    // Feriado con bloqueo tiene prioridad sobre el weekday no laborable.
    expect(dayClosedKind(sunday, monToSat, holiday, true)).toBe('holiday');
    // Sin bloqueo, cae a "closed" porque el domingo no está en working_days.
    expect(dayClosedKind(sunday, monToSat, holiday, false)).toBe('closed');
    // Lunes normal, sin feriado → abierto.
    expect(dayClosedKind(monday, monToSat, holiday, true)).toBeNull();
  });
});
