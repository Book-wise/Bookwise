import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, type WritableSignal } from '@angular/core';
import { HistorialReservaComponent } from './historial-reserva.component';
import { HistorialStore } from '@core/stores/historial.store';
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
    loading: WritableSignal<boolean>;
    bookings: WritableSignal<Booking[]>;
  };
  const mockTimezone = { formatCardDate: vi.fn((iso: string) => iso) };

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
    mockHistorialStore = { loading: signal(false), bookings: signal([]) };

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
  });

  describe('status chip rendering', () => {
    it('renders the bw-chip--warning variant for a "Confirmado" booking (status_id 2)', () => {
      mockHistorialStore.bookings.set([makeBooking()]);
      fixture.detectChanges();

      const nativeEl = fixture.nativeElement as HTMLElement;
      const chip = nativeEl.querySelector('.bw-chip');
      expect(chip).toBeTruthy();
      expect(chip!.classList.contains('bw-chip--warning')).toBe(true);
      expect(chip!.textContent?.trim()).toBe('Confirmado');
    });

    it('renders the bw-chip--danger variant for a booking resolved by status_id alone (status_id 5)', () => {
      mockHistorialStore.bookings.set([makeBooking({ status: undefined, status_id: 5 })]);
      fixture.detectChanges();

      const nativeEl = fixture.nativeElement as HTMLElement;
      const chip = nativeEl.querySelector('.bw-chip');
      expect(chip).toBeTruthy();
      expect(chip!.classList.contains('bw-chip--danger')).toBe(true);
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
