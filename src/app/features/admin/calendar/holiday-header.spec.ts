import { FullCalendarComponent } from './full-calendar.component';
import { ProviderCalendarComponent } from '@features/provider/calendar/provider-calendar.component';

/**
 * Pruebas de las callbacks privadas `holidayHeader` / `dayCellClassNames` de
 * ambas agendas sin montar FullCalendar: se usa un objeto con el prototype del
 * componente y se stubean los signals que leen las callbacks.
 */

type HeaderArg = { date: Date; text: string; view: { type: string } };

const harness = (Ctor: unknown, holidays: Map<string, string>, mobile: boolean): any => {
  const c: any = Object.create((Ctor as { prototype: object }).prototype);
  c.holidaysByDate = () => holidays;
  c.blockHolidays = () => true;
  c.isMobile = () => mobile;
  c.locations = () => [{ id: 1, working_days: [1, 2, 3, 4, 5] }];
  c.selectedLocationId = 1;
  c.providerWorkingDays = () => [1, 2, 3, 4, 5];
  return c;
};

const HOLIDAYS = new Map([['2026-03-04', 'Día "raro" \'x\' <img src=x onerror=alert(1)>']]);
const WED = new Date(2026, 2, 4); // 2026-03-04 (miércoles)
const SAT = new Date(2026, 2, 7); // 2026-03-07 (sábado, fuera de lun-vie)
const THU = new Date(2026, 2, 5); // 2026-03-05 (jueves, normal)

describe.each([
  ['admin', FullCalendarComponent],
  ['provider', ProviderCalendarComponent],
])('holidayHeader / dayCellClassNames (%s)', (_name, Ctor) => {
  it('month view does not append the holiday name (header is weekday names)', () => {
    const html = harness(Ctor, HOLIDAYS, false).holidayHeader({
      date: WED,
      text: '4',
      view: { type: 'dayGridMonth' },
    } as HeaderArg);
    expect(html).toEqual({ html: '4' });
  });

  it('timeGrid desktop renders the escaped holiday name', () => {
    const html: string = harness(Ctor, HOLIDAYS, false).holidayHeader({
      date: WED,
      text: '4',
      view: { type: 'timeGridWeek' },
    } as HeaderArg).html;
    expect(html).toContain('fc-holiday-label');
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
    expect(html.split('<').length - 1).toBe(2); // sólo los dos <span>
  });

  it('timeGrid mobile renders a compact badge with escaped title/aria-label', () => {
    const html: string = harness(Ctor, HOLIDAYS, true).holidayHeader({
      date: WED,
      text: '4',
      view: { type: 'timeGridDay' },
    } as HeaderArg).html;
    expect(html).toContain('fc-holiday-badge');
    expect(html).toContain('title="');
    expect(html).toContain('aria-label="');
    expect(html).toContain('●');
    expect(html).not.toContain('<img');
  });

  it('non-holiday day leaves the header text intact', () => {
    const html = harness(Ctor, new Map(), true).holidayHeader({
      date: THU,
      text: '5',
      view: { type: 'timeGridWeek' },
    } as HeaderArg);
    expect(html).toEqual({ html: '5' });
  });

  it('dayCellClassNames maps the closed kind to its class', () => {
    const c = harness(Ctor, HOLIDAYS, false);
    expect(c.dayCellClassNames({ date: WED })).toEqual(['fc-day-holiday']); // feriado bloqueado
    expect(c.dayCellClassNames({ date: SAT })).toEqual(['fc-day-closed']); // sábado fuera de working_days
    expect(c.dayCellClassNames({ date: THU })).toEqual([]); // jueves normal abierto
  });

  it('decorateHolidayHeader sets the title and, on mobile, a tap toast with the name', () => {
    const c = harness(Ctor, HOLIDAYS, true);
    const added: { detail?: string }[] = [];
    c.messageService = { add: (m: { detail?: string }) => added.push(m) };
    c.ngZone = { run: (fn: () => void) => fn() };
    c.lang = { t: (k: string) => k };

    const el = document.createElement('div');
    c.decorateHolidayHeader({ date: WED, el, view: { type: 'timeGridWeek' } });

    expect(el.title).toContain('Día');
    expect(el.classList.contains('fc-holiday-header')).toBe(true);
    el.dispatchEvent(new MouseEvent('click'));
    expect(added).toHaveLength(1);
    expect(added[0].detail).toContain('Día');
  });

  it('decorateHolidayHeader does nothing outside timeGrid views', () => {
    const c = harness(Ctor, HOLIDAYS, true);
    c.messageService = { add: () => {} };
    const el = document.createElement('div');
    el.title = 'keep';

    c.decorateHolidayHeader({ date: WED, el, view: { type: 'dayGridMonth' } });

    expect(el.title).toBe(''); // title retirado, sin toast
  });
});
