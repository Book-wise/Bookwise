import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, map, catchError, of, forkJoin } from 'rxjs';
import { Booking, Sale } from '@models';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { SalesApiService } from '@services/api/sales-api.service';
import { HttpErrorService } from '@services/http-error.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HistorialState {
  bookings: Booking[];
  sales: Sale[];
  loading: boolean;
  activeClientId: number | null;
  /** Tracks which clients have been fully loaded so we skip re-fetches. */
  loadedClients: Record<number, boolean>;
}

const initialState: HistorialState = {
  bookings: [],
  sales: [],
  loading: false,
  activeClientId: null,
  loadedClients: {},
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Root-scoped Signal Store for historial data (bookings + sales) keyed by
 * client ID.  Fetches ONCE per client per session — subsequent requests for
 * the same client hit the cache and return instantly.
 *
 * Inject this in any component that needs client historial data.
 */
export const HistorialStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => ({
    /** True when the active client's data has been loaded at least once. */
    isLoaded: computed(() => {
      const id = store.activeClientId();
      return id !== null && !!store.loadedClients()[id];
    }),
  })),

  withMethods((store, bookingsApi = inject(BookingsApiService), salesApi = inject(SalesApiService), httpError = inject(HttpErrorService)) => ({
    /**
     * Load historial data for a given client.
     * - Cache hit  → no-op (instant return)
     * - Cache miss → fires forkJoin of bookings + sales
     */
    loadForClient: rxMethod<number>(
      pipe(
        switchMap((clientId) => {
          // ── Cache hit ───────────────────────────────────────────────
          if (clientId === store.activeClientId() && store.loadedClients()[clientId]) {
            return of(null);
          }

          patchState(store, { loading: true, activeClientId: clientId });

          return forkJoin({
            bookings: bookingsApi.getBookings({ client_id: clientId, per_page: 50 }).pipe(
              map((res: any) => (Array.isArray(res) ? res : res.data ?? []) as Booking[]),
              catchError((err) => {
                httpError.handle(err, 'cargar historial de reservas');
                return of([] as Booking[]);
              }),
            ),
            sales: salesApi.getSales({ client_id: clientId, per_page: 50 }).pipe(
              map((res: any) => (Array.isArray(res) ? res : res.data ?? []) as Sale[]),
              catchError((err) => {
                httpError.handle(err, 'cargar historial de pagos');
                return of([] as Sale[]);
              }),
            ),
          }).pipe(
            tap(({ bookings, sales }) => {
              patchState(store, {
                bookings,
                sales,
                loading: false,
                loadedClients: { ...store.loadedClients(), [clientId]: true },
              });
            }),
          );
        }),
      ),
    ),

    /** Force-refetch for a specific client (bypasses cache, no activeClientId guard). */
    refreshForClient(clientId: number): void {
      if (!clientId) return;

      patchState(store, {
        activeClientId: clientId,
        loadedClients: { ...store.loadedClients(), [clientId]: false },
        loading: true,
      });

      forkJoin({
        bookings: bookingsApi.getBookings({ client_id: clientId, per_page: 50 }).pipe(
          map((res: any) => (Array.isArray(res) ? res : res.data ?? []) as Booking[]),
          catchError(() => of([] as Booking[])),
        ),
        sales: salesApi.getSales({ client_id: clientId, per_page: 50 }).pipe(
          map((res: any) => (Array.isArray(res) ? res : res.data ?? []) as Sale[]),
          catchError(() => of([] as Sale[])),
        ),
      }).subscribe({
        next: ({ bookings, sales }) => {
          patchState(store, {
            bookings,
            sales,
            loading: false,
            loadedClients: { ...store.loadedClients(), [clientId]: true },
          });
        },
      });
    },

    /** Force-refetch for the active client (bypasses cache). */
    refresh(): void {
      const id = store.activeClientId();
      if (id === null) return;

      patchState(store, {
        loadedClients: { ...store.loadedClients(), [id]: false },
        loading: true,
      });

      forkJoin({
        bookings: bookingsApi.getBookings({ client_id: id, per_page: 50 }).pipe(
          map((res: any) => (Array.isArray(res) ? res : res.data ?? []) as Booking[]),
          catchError(() => of([] as Booking[])),
        ),
        sales: salesApi.getSales({ client_id: id, per_page: 50 }).pipe(
          map((res: any) => (Array.isArray(res) ? res : res.data ?? []) as Sale[]),
          catchError(() => of([] as Sale[])),
        ),
      }).subscribe({
        next: ({ bookings, sales }) => {
          patchState(store, {
            bookings,
            sales,
            loading: false,
            loadedClients: { ...store.loadedClients(), [id]: true },
          });
        },
      });
    },
  })),
);
