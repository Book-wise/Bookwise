import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { BookingDetailDialogComponent } from './booking-detail-dialog.component';
import { BookingStore } from '@core/stores/booking.store';
import { ClientDetailStore } from '@core/stores/client-detail.store';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { BlockedSlotsApiService } from '@services/api/blocked-slots-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { SalesApiService } from '@services/api/sales-api.service';
import { AuthService } from '@services/auth.service';
import { HttpErrorService } from '@services/http-error.service';
import { MessageService } from 'primeng/api';
import { LanguageService } from '@services/language.service';
import { ReservaTabComponent } from './tabs/reserva/reserva-tab.component';
import type { Booking, Client, ClientPack } from '@models';

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() { /* test no-op */ }
    unobserve() { /* test no-op */ }
    disconnect() { /* test no-op */ }
  } as typeof ResizeObserver;
}
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    observe() { /* test no-op */ }
    unobserve() { /* test no-op */ }
    disconnect() { /* test no-op */ }
    takeRecords() { return []; }
  } as unknown as typeof IntersectionObserver;
}

const client = { id: 7, first_name: 'Ana', last_name: 'Pérez', email: 'ana@test.com', phone: '+56912345678', active: true } as Client;
const booking = { id: 12, client_id: 7, status_id: 1, start_time: '2026-08-24T10:00:00Z', end_time: '2026-08-24T11:00:00Z', price: 10000, client } as Booking;

const completeBooking = {
  ...booking,
  id: 381,
  start_time: '2026-08-21T16:00:00-04:00',
  end_time: '2026-08-21T17:00:00-04:00',
  notes: 'Llegar diez minutos antes',
  provider_id: 22,
  location_id: 3,
  service_id: 44,
  service: { id: 44, name: 'Kinesiología', price: 18000 },
  provider: { id: 22, first_name: 'Dr. Pablo', last_name: 'Soto' },
  location: { id: 3, name: 'Centro' },
  status: { id: 1, name: 'Confirmada', color: '#0a0' },
} as Booking;

describe('BookingDetailDialogComponent', () => {
  let fixture: ComponentFixture<BookingDetailDialogComponent>;
  let component: BookingDetailDialogComponent;
  let bookingStore: InstanceType<typeof BookingStore>;
  let clientsApi: { getClient: ReturnType<typeof vi.fn>; getClientPacks: ReturnType<typeof vi.fn>; updateClient: ReturnType<typeof vi.fn> };
  let messageService: { add: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    messageService = { add: vi.fn() };
    clientsApi = {
      getClient: vi.fn((id: number) => of({ ...client, id })),
      getClientPacks: vi.fn().mockReturnValue(of([])),
      updateClient: vi.fn().mockReturnValue(of({ data: { ...client } })),
    };
    TestBed.configureTestingModule({
      imports: [BookingDetailDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: BookingsApiService, useValue: { getBookings: vi.fn().mockReturnValue(of({ data: [booking] })), getBooking: vi.fn(), updateBooking: vi.fn().mockReturnValue(of({ data: booking })) } },
        { provide: BlockedSlotsApiService, useValue: { getBlockedSlots: vi.fn().mockReturnValue(of({ data: [] })) } },
        { provide: ClientsApiService, useValue: { getClients: vi.fn().mockReturnValue(of({ data: [] })), ...clientsApi } },
        { provide: ProvidersApiService, useValue: { getProviders: vi.fn().mockReturnValue(of([])) } },
        { provide: SalesApiService, useValue: { getSales: vi.fn().mockReturnValue(of({ data: [], meta: {} })) } },
        { provide: AuthService, useValue: { user: signal(null) } },
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
        { provide: MessageService, useValue: messageService },
        LanguageService,
      ],
    });
    fixture = TestBed.createComponent(BookingDetailDialogComponent);
    component = fixture.componentInstance;
    bookingStore = TestBed.inject(BookingStore);
    bookingStore.loadEvents({ dateFrom: '2026-08-24', dateTo: '2026-08-25' });
  });

  it('keeps the header tab model and opens reservation content with a patient snapshot', () => {
    component.open(booking, 'reserva');

    expect(component.visible()).toBe(true);
    expect(component.activeTab()).toBe('reserva');
    expect(component.TABS.map(tab => tab.value)).toContain('reserva');
    expect(component.detailStore.client()?.id).toBe(7);
    expect(component.detailStore.activeView()).toBe('reserva');
  });

  it.each(['planes', 'sesiones', 'prepago', 'recientes'] as const)('supports %s and returns to Reserva', (tab) => {
    component.open(booking, 'reserva');
    component.onPatientTabSelected(tab);

    expect(component.activeTab()).toBe('reserva');
    expect(component.detailStore.activeView()).toBe(tab);
    component.returnToReservation();
    expect(component.detailStore.activeView()).toBe('reserva');
  });

  it('preserves saved store values and leaves the existing status toast path unchanged', () => {
    component.open(booking, 'reserva');
    component.onStatusChange(2);

    expect(bookingStore.selectedBooking()?.status_id).toBe(1);
    expect(messageService.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success', key: 'global', life: 3000 }));
  });

  it('discards detail state on close so a later reservation cannot see it', () => {
    component.open(booking, 'reserva');
    component.detailStore.setNotification('email_new_booking', true);
    component.onPatientTabSelected('planes');
    component.close();

    expect(component.detailStore.client()).toBeNull();
    component.open({ ...booking, id: 13, client: { ...client, id: 8 } }, 'reserva');
    expect(component.detailStore.client()?.id).toBe(8);
    expect(component.detailStore.notifications().email_new_booking).toBe(false);
    expect(component.detailStore.activeView()).toBe('reserva');
  });

  // ── keep-alive: Reserva stays mounted with its form state across main tabs ───

  it('keeps Reserva mounted and preserves its form state across main-tab switches', async () => {
    component.open(completeBooking, 'reserva');
    fixture.detectChanges();
    await fixture.whenStable();

    const reservaBefore = fixture.debugElement.query(By.directive(ReservaTabComponent));
    expect(reservaBefore).not.toBeNull();
    (reservaBefore.componentInstance as ReservaTabComponent).notes.set('nota sin guardar');

    // Main-tab round trip: Reserva → Historial → Reserva.
    component.onTabChange('historial');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.debugElement.query(By.directive(ReservaTabComponent))).not.toBeNull();

    component.onTabChange('reserva');
    fixture.detectChanges();
    await fixture.whenStable();
    const reservaAfter = fixture.debugElement.query(By.directive(ReservaTabComponent));
    expect(reservaAfter).not.toBeNull();
    expect(reservaAfter).toBe(reservaBefore);
    expect((reservaAfter.componentInstance as ReservaTabComponent).notes()).toBe('nota sin guardar');
  });

  // ── patient sub-tab flow through the rendered card: detail fills content, back restores ──

  it('shows the patient detail content on sub-tab click and returns to Reserva without losing state', async () => {
    // Non-empty packs so the `planes` sub-tab is enabled (disabled matrix).
    clientsApi.getClientPacks.mockReturnValue(of([
      { id: 1, client_id: 7, service_pack_id: 2, total_sessions: 4, used_sessions: 1, remaining_sessions: 3, status: 'active' } as ClientPack,
    ]));
    component.open(completeBooking, 'reserva');
    fixture.detectChanges();
    await fixture.whenStable();

    // Sub-tab click inside the rendered patient card (dialogMode).
    const planesBtn = fixture.nativeElement.querySelector('[data-testid="tab-planes"]') as HTMLButtonElement;
    expect(planesBtn).not.toBeNull();
    expect(planesBtn.disabled).toBe(false);
    planesBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.detailStore.activeView()).toBe('planes');
    expect(fixture.nativeElement.textContent).toContain('Volver a la reserva');

    // "Volver a la reserva" restores Reserva; the tab model stays put.
    const backBtn = fixture.nativeElement.querySelector('.patient-detail-content__back') as HTMLButtonElement;
    expect(backBtn).not.toBeNull();
    backBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.detailStore.activeView()).toBe('reserva');
    expect(component.activeTab()).toBe('reserva');
    expect(fixture.nativeElement.textContent).toContain('Ana Pérez');
  });

  // ── client enrichment on open (Decision 2) ───────────────────────────────────

  it('enriches the dialog booking with the full client fetched via ClientsApiService.getClient', () => {
    const partialClient = { id: 7, first_name: 'Ana', last_name: 'Pérez' } as Client;
    component.open({ ...booking, client: partialClient }, 'reserva');

    expect(clientsApi.getClient).toHaveBeenCalledWith(7);
    // of() emits synchronously: the enriched client is already merged into the
    // dialog copy, the root store and the client-detail store.
    expect(component.dialogStore.booking()?.client?.email).toBe('ana@test.com');
    expect(component.dialogStore.booking()?.client?.phone).toBe('+56912345678');
    expect(bookingStore.selectedBooking()?.client?.email).toBe('ana@test.com');
    expect(component.detailStore.client()?.email).toBe('ana@test.com');
  });

  it('falls back to the embedded client when getClient fails', () => {
    clientsApi.getClient.mockImplementation(() => throwError(() => new Error('network')));
    const partialClient = { id: 7, first_name: 'Ana', last_name: 'Pérez' } as Client;
    component.open({ ...booking, client: partialClient }, 'reserva');

    expect(component.detailStore.client()?.id).toBe(7);
    expect(component.dialogStore.booking()?.client?.first_name).toBe('Ana');
  });
});

