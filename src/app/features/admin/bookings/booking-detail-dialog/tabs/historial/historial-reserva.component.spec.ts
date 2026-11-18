import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, type WritableSignal } from '@angular/core';
import { HistorialReservaComponent } from './historial-reserva.component';
import { HistorialStore, type PaginationState } from '@core/stores/historial.store';
import { TimezoneService } from '@services/timezone.service';
import { Booking } from '@models';

/**
 * Render-level tests for the historial-reserva status chip. The chip class is
 * the visible output of the bookingStatusChipClass mapping (status → bw-chip
 * variant), so the assertion pins the rendered variant for representative
 * statuses at the template level.
 */
describe('HistorialReservaComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HistorialReservaComponent>>;
  let component: HistorialReservaComponent;
  let mockHistorialStore: {
    loadingBookingsPage: WritableSignal<boolean>;
    paginatedBookings: WritableSignal<Booking[]>;
    bookingsPagination: WritableSignal<PaginationState>;
    bookingsShowingCount: WritableSignal<number>;
    loadNextBookingsPage: ReturnType<typeof vi.fn>;
  };
  const mockTimezone = { formatCardDate: vi.fn((iso: string) => iso) };

  // jsdom no trae los observers que usa el scroll infinito del componente.
  if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;
  }
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
  }

  const makeBooking = (overrides: Partial<Booking> = {}): Booking => ({
    id: 1,
    start_time: '2026-07-31T10:00:00',
    end_time: '2026-07-31T11:00:00',
    effective_duration_minutes: 60,
    price: 15000,
    status_id: 2,
    status: { id: 2, name: 'Confirmado', color: '#fb923c', is_cancellation: false },
    client: { id: 1, first_name: 'Ana', last_name: 'González', email: 'ana@test.com', active: true },
    service: { id: 1, name: 'Corte', duration_minutes: 60, price: 15000, active: true },
    provider: { id: 1, first_name: 'Ana', last_name: 'González', email: 'ana@test.com', active: true },
    location: {
      id: 1,
      name: 'Sucursal Centro',
      address: '',
      city: '',
      timezone: 'America/Santiago',
      active: true,
    },
    payment_status: null,
    ...overrides,
  });

  beforeEach(async () => {
    mockHistorialStore = {
      loadingBookingsPage: signal(false),
      paginatedBookings: signal([]),
      bookingsPagination: signal({
        currentPage: 1,
        lastPage: 1,
        total: 0,
        perPage: 10,
        hasMore: false,
      }),
      bookingsShowingCount: signal(0),
      loadNextBookingsPage: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [HistorialReservaComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: HistorialStore, useValue: mockHistorialStore },
        { provide: TimezoneService, useValue: mockTimezone },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HistorialReservaComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('clientId', 1);
  });

  describe('status chip rendering', () => {
    // El chip no usa clases de variante: el acento del estado viaja como
    // `--chip-color` (tokens de `_tokens.scss`), así que el output visible que
    // hay que fijar es esa custom property, no un `bw-chip--*`.
    it('renders the confirmado status token for a "Confirmado" booking (status_id 2)', () => {
      mockHistorialStore.paginatedBookings.set([makeBooking()]);
      mockHistorialStore.bookingsShowingCount.set(1);
      fixture.detectChanges();

      const nativeEl = fixture.nativeElement as HTMLElement;
      const chip = nativeEl.querySelector('.bw-chip') as HTMLElement | null;
      expect(chip).toBeTruthy();
      expect(chip!.style.getPropertyValue('--chip-color')).toBe('var(--bw-status-confirmado)');
      expect(chip!.textContent?.trim()).toBe('Confirmado');
    });

    it('renders the pendiente status token for a booking resolved by status_id alone (status_id 5)', () => {
      mockHistorialStore.paginatedBookings.set([makeBooking({ status: undefined, status_id: 5 })]);
      mockHistorialStore.bookingsShowingCount.set(1);
      fixture.detectChanges();

      const nativeEl = fixture.nativeElement as HTMLElement;
      const chip = nativeEl.querySelector('.bw-chip') as HTMLElement | null;
      expect(chip).toBeTruthy();
      expect(chip!.style.getPropertyValue('--chip-color')).toBe('var(--bw-status-pendiente)');
    });

    it('renders no chip when there are no bookings', () => {
      fixture.detectChanges();

      const nativeEl = fixture.nativeElement as HTMLElement;
      const empty = nativeEl.querySelector('.hr-empty');
      expect(empty).toBeTruthy();
      expect(nativeEl.querySelector('.bw-chip')).toBeFalsy();
    });
  });
});
