import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, type WritableSignal } from '@angular/core';
import { HistorialPacienteComponent } from './historial-paciente.component';
import { HistorialStore } from '@core/stores/historial.store';
import { TimezoneService } from '@services/timezone.service';
import type { Booking } from '@models';

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  } as unknown as typeof IntersectionObserver;
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
}

/**
 * Render-level tests for the patient history table: the renamed creation
 * sub-tab, the two date columns (atención / creación) and the em-dash
 * fallback when created_at is absent.
 */
describe('HistorialPacienteComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HistorialPacienteComponent>>;
  let store: {
    paginatedBookings: WritableSignal<Booking[]>;
    loadingBookingsPage: WritableSignal<boolean>;
    bookingsPagination: WritableSignal<{ hasMore: boolean }>;
    bookingsShowingCount: WritableSignal<number>;
  };
  const mockTimezone = { formatCardDate: vi.fn((iso: string) => iso) };

  const makeBooking = (overrides: Partial<Booking> = {}): Booking => ({
    id: 1,
    start_time: '2026-07-31T10:00:00',
    end_time: '2026-07-31T11:00:00',
    price: 15000,
    status_id: 3,
    status: { id: 3, name: 'Asiste', color: '#16a34a', is_cancellation: false },
    service: { id: 1, name: 'Kinesiología', duration_minutes: 60, price: 15000, active: true },
    ...overrides,
  });

  beforeEach(async () => {
    store = {
      paginatedBookings: signal([]),
      loadingBookingsPage: signal(false),
      bookingsPagination: signal({ hasMore: false }),
      bookingsShowingCount: signal(0),
    };

    await TestBed.configureTestingModule({
      imports: [HistorialPacienteComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: HistorialStore, useValue: store },
        { provide: TimezoneService, useValue: mockTimezone },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HistorialPacienteComponent);
    fixture.componentRef.setInput('clientId', 1);
  });

  it('renames the creation sub-tab to "Últimas creaciones de reserva"', () => {
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    expect(nativeEl.textContent).toContain('Últimas creaciones de reserva');
  });

  it('shows "Fecha de atención" and "Fecha de creación" columns with both dates per row', () => {
    store.paginatedBookings.set([makeBooking({ created_at: '2026-07-20T09:00:00' })]);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const headers = Array.from(nativeEl.querySelectorAll('th')).map(th => th.textContent?.trim());
    expect(headers).toContain('Fecha de atención');
    expect(headers).toContain('Fecha de creación');

    const cells = Array.from(nativeEl.querySelectorAll('td.hp-cell--date')).map(td => td.textContent?.trim());
    expect(cells).toEqual(['2026-07-31T10:00:00', '2026-07-20T09:00:00']);
  });

  it('renders an em dash in the creation column when created_at is absent', () => {
    store.paginatedBookings.set([makeBooking()]);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const cells = Array.from(nativeEl.querySelectorAll('td.hp-cell--date')).map(td => td.textContent?.trim());
    expect(cells).toEqual(['2026-07-31T10:00:00', '—']);
  });
});
