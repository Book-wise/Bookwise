import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject } from '@angular/core';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { ClientsApiService } from '@services/api/clients-api.service';
import { SalesApiService } from '@services/api/sales-api.service';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { Client, ClientPack, Sale, Booking } from '@models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DomainState<T> {
  data: T[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

function emptyDomain<T>(): DomainState<T> {
  return { data: [], loading: false, loaded: false, error: null };
}

export type PatientTab = 'planes' | 'sesiones' | 'prepago' | 'recientes';
export type PatientView = 'reserva' | PatientTab;

export interface NotificationValues {
  citaEmail: boolean;
  citaWa: boolean;
  reminderEmail: boolean;
  reminderWa: boolean;
}

export interface ClientDetailState {
  client: Client | null;
  activeView: PatientView;
  notifications: NotificationValues;
  packs: DomainState<ClientPack>;
  sales: DomainState<Sale>;
  recent: DomainState<Booking>;
}

const emptyNotifications = (): NotificationValues => ({
  citaEmail: false,
  citaWa: false,
  reminderEmail: false,
  reminderWa: false,
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: ClientDetailState = {
  client: null,
  activeView: 'reserva',
  notifications: emptyNotifications(),
  packs: emptyDomain(),
  sales: emptyDomain(),
  recent: emptyDomain(),
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const ClientDetailStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withMethods((store, clientsApi = inject(ClientsApiService), salesApi = inject(SalesApiService), bookingsApi = inject(BookingsApiService)) => {
    const loadPacks = rxMethod<number>(
      pipe(
        tap(() => patchState(store, {
          packs: { ...store.packs(), loading: true },
        })),
        switchMap((clientId) =>
          clientsApi.getClientPacks(clientId).pipe(
            tap({
              next: (data) => patchState(store, {
                packs: { data, loading: false, loaded: true, error: null },
              }),
              error: () => patchState(store, {
                packs: { data: [], loading: false, loaded: true, error: 'load_failed' },
              }),
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    const loadSales = rxMethod<number>(
      pipe(
        tap(() => patchState(store, {
          sales: { ...store.sales(), loading: true },
        })),
        switchMap((clientId) =>
          salesApi.getSales({ client_id: clientId }).pipe(
            tap({
              next: (res) => patchState(store, {
                sales: { data: res.data, loading: false, loaded: true, error: null },
              }),
              error: () => patchState(store, {
                sales: { data: [], loading: false, loaded: true, error: 'load_failed' },
              }),
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    const loadRecent = rxMethod<number>(
      pipe(
        tap(() => patchState(store, {
          recent: { ...store.recent(), loading: true },
        })),
        switchMap((clientId) =>
          bookingsApi.getBookings({ client_id: clientId, per_page: 10 }).pipe(
            tap({
              next: (res) => patchState(store, {
                recent: { data: res.data, loading: false, loaded: true, error: null },
              }),
              error: () => patchState(store, {
                recent: { data: [], loading: false, loaded: true, error: 'load_failed' },
              }),
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    return {
      loadPacks,
      loadSales,
      loadRecent,

      initialize(client: Client): void {
        const sameClient = store.client()?.id === client.id;
        patchState(store, {
          client: { ...client },
          ...(sameClient ? {} : {
            activeView: 'reserva' as PatientView,
            notifications: emptyNotifications(),
            packs: emptyDomain<ClientPack>(),
            sales: emptyDomain<Sale>(),
            recent: emptyDomain<Booking>(),
          }),
        });
      },

      selectTab(tab: PatientTab): void {
        patchState(store, { activeView: tab });
      },

      returnToReservation(): void {
        patchState(store, { activeView: 'reserva' });
      },

      setNotification(key: keyof NotificationValues, value: boolean): void {
        patchState(store, {
          notifications: { ...store.notifications(), [key]: value },
        });
      },

      reset(): void {
        patchState(store, {
          client: null,
          activeView: 'reserva',
          notifications: emptyNotifications(),
          packs: emptyDomain(),
          sales: emptyDomain(),
          recent: emptyDomain(),
        });
      },

      /** @deprecated Use reset() to clear the dialog-scoped state. */
      resetData(): void {
        patchState(store, {
          client: null,
          activeView: 'reserva',
          notifications: emptyNotifications(),
          packs: emptyDomain(),
          sales: emptyDomain(),
          recent: emptyDomain(),
        });
      },
    };
  }),
);
