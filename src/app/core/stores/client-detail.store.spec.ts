import { TestBed } from '@angular/core/testing';
import { createEnvironmentInjector, EnvironmentInjector, inject, provideZonelessChangeDetection, runInInjectionContext } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { ClientDetailStore } from './client-detail.store';
import { ClientsApiService } from '@services/api/clients-api.service';
import { SalesApiService } from '@services/api/sales-api.service';
import { BookingsApiService } from '@services/api/bookings-api.service';
import type { Client, ClientPack, Sale, Booking } from '@models';

const client = { id: 7, first_name: 'Ana', last_name: 'Pérez', email: 'ana@test.com', phone: '+56912345678', active: true } as Client;
const pack = { id: 1, client_id: 7, service_pack_id: 2, total_sessions: 4, used_sessions: 1, remaining_sessions: 3, status: 'active' } as ClientPack;
const sale = { id: 2, total: 10000, paid_amount: 10000, remaining_amount: 0, payment_status: 'paid', transactions: [] } as Sale;
const booking = { id: 3, status_id: 1, start_time: '2026-08-24T10:00:00Z', end_time: '2026-08-24T11:00:00Z', price: 10000 } as Booking;

describe('ClientDetailStore', () => {
  let store: InstanceType<typeof ClientDetailStore>;
  let clientsApi: { getClientPacks: ReturnType<typeof vi.fn> };
  let salesApi: { getSales: ReturnType<typeof vi.fn> };
  let bookingsApi: { getBookings: ReturnType<typeof vi.fn> };

  function createStore() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ClientDetailStore,
        { provide: ClientsApiService, useValue: clientsApi },
        { provide: SalesApiService, useValue: salesApi },
        { provide: BookingsApiService, useValue: bookingsApi },
      ],
    });
    store = TestBed.inject(ClientDetailStore);
  }

  beforeEach(() => {
    clientsApi = { getClientPacks: vi.fn().mockReturnValue(of([])) };
    salesApi = { getSales: vi.fn().mockReturnValue(of({ data: [], meta: {} })) };
    bookingsApi = { getBookings: vi.fn().mockReturnValue(of({ data: [], meta: {} })) };
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
    expect(store.notifications()).toEqual({ citaEmail: false, citaWa: false, reminderEmail: false, reminderWa: false });
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
    store.setNotification('citaEmail', true);
    store.setNotification('reminderWa', true);
    store.selectTab('recientes');
    store.returnToReservation();

    expect(store.notifications()).toEqual({ citaEmail: true, citaWa: false, reminderEmail: false, reminderWa: true });
    expect(store.client()).toEqual(client);
  });

  it('resets navigation, notifications, and all caches on close or new reservation', () => {
    store.initialize(client);
    store.selectTab('planes');
    store.setNotification('citaWa', true);
    store.loadPacks(client.id);
    store.reset();
    expect(store.client()).toBeNull();
    expect(store.activeView()).toBe('reserva');
    expect(store.packs().loaded).toBe(false);
    expect(store.notifications().citaWa).toBe(false);

    store.initialize(client);
    store.setNotification('citaEmail', true);
    store.initialize({ ...client, id: 8 });
    expect(store.client()?.id).toBe(8);
    expect(store.notifications().citaEmail).toBe(false);
    expect(store.activeView()).toBe('reserva');
  });

  it('keeps two injected dialog stores isolated', () => {
    const first = store;
    first.initialize(client);
    first.setNotification('citaEmail', true);

    const child = createEnvironmentInjector([ClientDetailStore], TestBed.inject(EnvironmentInjector));
    const second = runInInjectionContext(child, () => inject(ClientDetailStore));
    second.initialize({ ...client, id: 8 });

    expect(first.client()?.id).toBe(7);
    expect(first.notifications().citaEmail).toBe(true);
    expect(second.client()?.id).toBe(8);
    expect(second.notifications().citaEmail).toBe(false);
    child.destroy();
  });
});
