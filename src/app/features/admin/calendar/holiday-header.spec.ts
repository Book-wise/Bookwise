import { FullCalendarComponent } from './full-calendar.component';
import { ProviderCalendarComponent } from '@features/provider/calendar/provider-calendar.component';

/**
 * Pruebas de las callbacks privadas del header de feriado de ambas agendas sin
 * montar FullCalendar: objeto con el prototype del componente y signals stub.
 */

type HeaderArg = { date: Date; text: string; view: { type: string } };

const harness = (Ctor: unknown, holidays: Map<string, string>, compact: boolean): any => {
  const c: any = Object.create((Ctor as { prototype: object }).prototype);
  c.holidaysByDate = () => holidays;
  c.blockHolidays = () => true;
  c.isCompactHeader = () => compact;
  c.isMobile = () => compact;
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
])('holiday header (%s)', (_name, Ctor) => {
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
  });

  it('compact (mobile/tablet) renders a compact badge with escaped title/aria-label', () => {
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

  it('decorateHolidayHeader sets the holiday name as the header title', () => {
    const c = harness(Ctor, HOLIDAYS, true);
    const el = document.createElement('div');
    c.decorateHolidayHeader({ date: WED, el, view: { type: 'timeGridWeek' } });
    expect(el.title).toContain('Día');
  });

  it('decorateHolidayHeader clears the title outside timeGrid or on a non-holiday', () => {
    const c = harness(Ctor, HOLIDAYS, true);
    const el = document.createElement('div');
    el.title = 'keep';
    c.decorateHolidayHeader({ date: WED, el, view: { type: 'dayGridMonth' } });
    expect(el.hasAttribute('title')).toBe(false);

    const el2 = document.createElement('div');
    el2.title = 'keep';
    c.decorateHolidayHeader({ date: THU, el: el2, view: { type: 'timeGridWeek' } });
    expect(el2.hasAttribute('title')).toBe(false);
  });

  it('onHolidayHeaderTap shows the holiday toast on compact timeGrid (delegated)', () => {
    const c = harness(Ctor, HOLIDAYS, true);
    c.calendar = { view: { type: 'timeGridWeek' } };
    const added: { detail?: string; key?: string }[] = [];
    c.messageService = { add: (m: { detail?: string; key?: string }) => added.push(m) };
    c.ngZone = { run: (fn: () => void) => fn() };
    c.lang = { t: (k: string) => k };

    const th = document.createElement('th');
    th.className = 'fc-col-header-cell';
    th.setAttribute('data-date', '2026-03-04');
    const span = document.createElement('span');
    th.appendChild(span);

    c.onHolidayHeaderTap({ target: span } as unknown as Event);

    expect(added).toHaveLength(1);
    expect(added[0].detail).toContain('Día');
    expect(added[0].key).toBe('global');
  });

  it('onHolidayHeaderTap ignores desktop, month view and non-holiday days', () => {
    const added: unknown[] = [];
    const c = harness(Ctor, HOLIDAYS, false); // no compacto
    c.messageService = { add: (m: unknown) => added.push(m) };
    c.ngZone = { run: (fn: () => void) => fn() };
    const th = document.createElement('th');
    th.className = 'fc-col-header-cell';
    th.setAttribute('data-date', '2026-03-04');

    c.calendar = { view: { type: 'timeGridWeek' } };
    c.onHolidayHeaderTap({ target: th } as unknown as Event); // desktop: sin toast
    expect(added).toHaveLength(0);

    c.isCompactHeader = () => true;
    c.calendar = { view: { type: 'dayGridMonth' } };
    c.onHolidayHeaderTap({ target: th } as unknown as Event); // vista mes: sin toast
    expect(added).toHaveLength(0);

    c.calendar = { view: { type: 'timeGridWeek' } };
    const th2 = document.createElement('th');
    th2.className = 'fc-col-header-cell';
    th2.setAttribute('data-date', '2026-03-05'); // no feriado
    c.onHolidayHeaderTap({ target: th2 } as unknown as Event);
    expect(added).toHaveLength(0);
  });
});
