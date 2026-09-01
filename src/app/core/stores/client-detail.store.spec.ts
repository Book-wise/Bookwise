import { TestBed } from '@angular/core/testing';
import { createEnvironmentInjector, EnvironmentInjector, inject, provideZonelessChangeDetection, runInInjectionContext } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { ClientDetailStore } from './client-detail.store';
import { ClientsApiService } from '@services/api/clients-api.service';
import { SalesApiService } from '@services/api/sales-api.service';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { HttpErrorService } from '@services/http-error.service';
import type { Client, ClientPack, NotificationPrefs, Sale, Booking } from '@models';

const client = { id: 7, first_name: 'Ana', last_name: 'Pérez', email: 'ana@test.com', phone: '+56912345678', active: true } as Client;
const pack = { id: 1, client_id: 7, service_pack_id: 2, total_sessions: 4, used_sessions: 1, remaining_sessions: 3, status: 'active' } as ClientPack;
const sale = { id: 2, total: 10000, paid_amount: 10000, remaining_amount: 0, payment_status: 'paid', transactions: [] } as Sale;
const booking = { id: 3, status_id: 1, start_time: '2026-08-24T10:00:00Z', end_time: '2026-08-24T11:00:00Z', price: 10000 } as Booking;
const allFalsePrefs: NotificationPrefs = {
  email_new_booking: false,
  email_booking_confirmation: false,
  email_booking_cancellation: false,
  whatsapp_reminder: false,
  whatsapp_cancellation_confirmation: false,
};

describe('ClientDetailStore', () => {
  let store: InstanceType<typeof ClientDetailStore>;
  let clientsApi: { getClientPacks: ReturnType<typeof vi.fn>; updateClient: ReturnType<typeof vi.fn> };
  let salesApi: { getSales: ReturnType<typeof vi.fn> };
  let bookingsApi: { getBookings: ReturnType<typeof vi.fn> };
  let httpError: { handle: ReturnType<typeof vi.fn> };

  function createStore() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ClientDetailStore,
        { provide: ClientsApiService, useValue: clientsApi },
        { provide: SalesApiService, useValue: salesApi },
        { provide: BookingsApiService, useValue: bookingsApi },
        { provide: HttpErrorService, useValue: httpError },
      ],
    });
    store = TestBed.inject(ClientDetailStore);
  }

  beforeEach(() => {
    clientsApi = { getClientPacks: vi.fn().mockReturnValue(of([])), updateClient: vi.fn().mockReturnValue(of({ data: client })) };
    salesApi = { getSales: vi.fn().mockReturnValue(of({ data: [], meta: {} })) };
    bookingsApi = { getBookings: vi.fn().mockReturnValue(of({ data: [], meta: {} })) };
    httpError = { handle: vi.fn() };
    createStore();
  });

  it('starts empty and initializes a copied snapshot with empty caches', () => {
    expect(store.client()).toBeNull();
    expect(store.activeView()).toBe('reserva');

    store.initialize(client);

    expect(store.client()).toEqual(client);
    expect(store.client()).not.toBe(client);
    expect(store.packs().loaded).toBe(false);
    expect(store.sales().loaded).toBe(false);
    expect(store.recent().loaded).toBe(false);
    expect(store.notifications()).toEqual({
      email_new_booking: false,
      email_booking_confirmation: false,
      email_booking_cancellation: false,
      whatsapp_reminder: false,
      whatsapp_cancellation_confirmation: false,
    });
  });

  it('loads and caches planes and sesiones from the shared packs cache', () => {
    clientsApi.getClientPacks.mockReturnValue(of([pack]));
    store.initialize(client);

    store.loadPacks(7);
    store.selectTab('planes');
    expect(store.packs()).toMatchObject({ data: [pack], loaded: true, loading: false, error: null });

    store.selectTab('sesiones');
    expect(store.packs().data).toHaveLength(1);
    expect(clientsApi.getClientPacks).toHaveBeenCalledTimes(1);
  });

  it('loads the prepago and recientes caches independently', () => {
    salesApi.getSales.mockReturnValue(of({ data: [sale], meta: {} }));
    bookingsApi.getBookings.mockReturnValue(of({ data: [booking], meta: {} }));

    store.loadSales(7);
    store.loadRecent(7);

    expect(store.sales().data).toEqual([sale]);
    expect(store.recent().data).toEqual([booking]);
    expect(salesApi.getSales).toHaveBeenCalledWith({ client_id: 7 });
    expect(bookingsApi.getBookings).toHaveBeenCalledWith({ client_id: 7, per_page: 10 });
  });

  it('retains the patient snapshot while showing loading, empty, and error states', () => {
    const pending = new Subject<ClientPack[]>();
    clientsApi.getClientPacks.mockReturnValue(pending.asObservable());
    store.initialize(client);
    store.loadPacks(client.id);
    expect(store.client()).toEqual(client);
    expect(store.packs().loading).toBe(true);

    pending.next([]);
    expect(store.packs()).toMatchObject({ data: [], loaded: true, loading: false, error: null });

    clientsApi.getClientPacks.mockReturnValue(throwError(() => new Error('network')));
    store.loadPacks(client.id);
    expect(store.packs()).toMatchObject({ data: [], loaded: true, loading: false, error: 'load_failed' });
    expect(store.client()).toEqual(client);
  });

  it('retains notification values through internal navigation and return', () => {
    store.initialize(client);
    store.setNotification('email_new_booking', true);
    store.setNotification('whatsapp_reminder', true);
    store.selectTab('recientes');
    store.returnToReservation();

    expect(store.notifications()).toEqual({
      email_new_booking: true,
      email_booking_confirmation: false,
      email_booking_cancellation: false,
      whatsapp_reminder: true,
      whatsapp_cancellation_confirmation: false,
    });
    expect(store.client()).toEqual(client);
  });

  it('resets navigation, notifications, and all caches on close or new reservation', () => {
    store.initialize(client);
    store.selectTab('planes');
    store.setNotification('whatsapp_reminder', true);
    store.loadPacks(client.id);
    store.reset();
    expect(store.client()).toBeNull();
    expect(store.activeView()).toBe('reserva');
    expect(store.packs().loaded).toBe(false);
    expect(store.notifications().whatsapp_reminder).toBe(false);

    store.initialize(client);
    store.setNotification('email_new_booking', true);
    store.initialize({ ...client, id: 8 });
    expect(store.client()?.id).toBe(8);
    expect(store.notifications().email_new_booking).toBe(false);
    expect(store.activeView()).toBe('reserva');
  });

  it('keeps two injected dialog stores isolated', () => {
    const first = store;
    first.initialize(client);
    first.setNotification('email_new_booking', true);

    const child = createEnvironmentInjector([ClientDetailStore], TestBed.inject(EnvironmentInjector));
    const second = runInInjectionContext(child, () => inject(ClientDetailStore));
    second.initialize({ ...client, id: 8 });

    expect(first.client()?.id).toBe(7);
    expect(first.notifications().email_new_booking).toBe(true);
    expect(second.client()?.id).toBe(8);
    expect(second.notifications().email_new_booking).toBe(false);
    child.destroy();
  });

  it('initializes the five toggles from client.notification_prefs on open', () => {
    store.initialize({
      ...client,
      notification_prefs: {
        ...allFalsePrefs,
        email_new_booking: true,
        whatsapp_reminder: true,
      },
    });

    expect(store.notifications()).toEqual({
      ...allFalsePrefs,
      email_new_booking: true,
      whatsapp_reminder: true,
    });
  });

  it('repopulates prefs from GET when the same client reopens — no stale state', () => {
    store.initialize({ ...client, notification_prefs: { ...allFalsePrefs, email_new_booking: true } });
    // User flips the toggle during the session — must not survive the reopen.
    store.setNotification('email_new_booking', false);

    store.initialize({ ...client, notification_prefs: { ...allFalsePrefs, email_new_booking: true } });

    expect(store.notifications().email_new_booking).toBe(true);
    expect(store.notifications().whatsapp_reminder).toBe(false);
  });

  it('sends a partial PATCH containing only the changed flag on toggle', () => {
    store.initialize(client);
    clientsApi.updateClient.mockClear();

    store.setNotification('whatsapp_reminder', false);

    expect(clientsApi.updateClient).toHaveBeenCalledTimes(1);
    expect(clientsApi.updateClient).toHaveBeenCalledWith(7, {
      notification_prefs: { whatsapp_reminder: false },
    });
  });

  it('reverts the toggle and shows a toast when the PATCH fails', () => {
    const err = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
    clientsApi.updateClient.mockReturnValue(throwError(() => err));
    store.initialize(client);
    clientsApi.updateClient.mockClear();
    httpError.handle.mockClear();

    store.setNotification('email_new_booking', true);

    expect(store.notifications().email_new_booking).toBe(false);
    expect(httpError.handle).toHaveBeenCalledTimes(1);
    expect(httpError.handle).toHaveBeenCalledWith(err, 'actualizar notificaciones');
  });
});
