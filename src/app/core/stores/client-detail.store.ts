import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { ClientsApiService } from '@services/api/clients-api.service';
import { SalesApiService } from '@services/api/sales-api.service';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { Client, ClientPack, Sale, Booking, NotificationPrefs } from '@models';

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

/** Alias of the backend notification prefs contract — 5 flags, 1:1, no mapping. */
export type NotificationValues = NotificationPrefs;

export interface ClientDetailState {
  client: Client | null;
  activeView: PatientView;
  notifications: NotificationValues;
  packs: DomainState<ClientPack>;
  sales: DomainState<Sale>;
  recent: DomainState<Booking>;
}

const emptyNotifications = (): NotificationValues => ({
  email_new_booking: false,
  email_booking_confirmation: false,
  email_booking_cancellation: false,
  whatsapp_reminder: false,
  whatsapp_cancellation_confirmation: false,
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

  withMethods((store, clientsApi = inject(ClientsApiService), salesApi = inject(SalesApiService), bookingsApi = inject(BookingsApiService), httpError = inject(HttpErrorService)) => {
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
                sales: { data: Array.isArray(res) ? res : res.data ?? [], loading: false, loaded: true, error: null },
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
                recent: { data: Array.isArray(res) ? res : res.data ?? [], loading: false, loaded: true, error: null },
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
          // Always repopulate prefs from GET /clients/{id}, same-client included,
          // so stale in-memory values never survive a reopen. Absent prefs → all false.
          notifications: { ...emptyNotifications(), ...client.notification_prefs },
          ...(sameClient ? {} : {
            activeView: 'reserva' as PatientView,
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
        const clientId = store.client()?.id;
        if (!clientId) return;
        const prev = store.notifications()[key];
        // Optimistic update: flip the toggle first, revert on failure.
        patchState(store, {
          notifications: { ...store.notifications(), [key]: value },
        });
        // Partial PATCH — the backend accepts a single flag under notification_prefs.
        const patch = { notification_prefs: { [key]: value } } as unknown as Partial<Client>;
        clientsApi.updateClient(clientId, patch).subscribe({
          error: (err: HttpErrorResponse) => {
            patchState(store, {
              notifications: { ...store.notifications(), [key]: prev },
            });
            httpError.handle(err, 'actualizar notificaciones');
          },
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
