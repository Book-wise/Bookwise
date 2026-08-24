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
import { Booking, Sale, ClientPaginatedResponse } from '@models';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { SalesApiService } from '@services/api/sales-api.service';
import { HttpErrorService } from '@services/http-error.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaginationState {
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
  hasMore: boolean;
}

interface HistorialState {
  /** Legacy flat arrays — kept for backward-compat consumers. */
  bookings: Booking[];
  sales: Sale[];

  /** Paginated state — used by infinite-scroll consumers. */
  paginatedBookings: Booking[];
  paginatedSales: Sale[];
  bookingsPagination: PaginationState;
  salesPagination: PaginationState;
  loadingBookingsPage: boolean;
  loadingSalesPage: boolean;

  loading: boolean;
  activeClientId: number | null;
  /** Tracks which clients have been fully loaded so we skip re-fetches. */
  loadedClients: Record<number, boolean>;
}

const initialPagination: PaginationState = {
  currentPage: 0,
  lastPage: 1,
  total: 0,
  perPage: 20,
  hasMore: false,
};

const initialState: HistorialState = {
  bookings: [],
  sales: [],
  paginatedBookings: [],
  paginatedSales: [],
  bookingsPagination: { ...initialPagination },
  salesPagination: { ...initialPagination },
  loadingBookingsPage: false,
  loadingSalesPage: false,
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
 * Supports both legacy single-fetch and paginated (infinite scroll) modes.
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

    /** Total items shown across paginated bookings (for "Mostrando X de Y"). */
    bookingsShowingCount: computed(() => store.paginatedBookings().length),
    salesShowingCount: computed(() => store.paginatedSales().length),
  })),

  withMethods((store, bookingsApi = inject(BookingsApiService), salesApi = inject(SalesApiService), httpError = inject(HttpErrorService)) => ({
    /**
     * Load historial data for a given client (legacy single-fetch).
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

    // ── Paginated methods ────────────────────────────────────────────────────

    /** Reset paginated state for a new client. */
    resetPagination(clientId: number): void {
      patchState(store, {
        activeClientId: clientId,
        paginatedBookings: [],
        paginatedSales: [],
        bookingsPagination: { ...initialPagination },
        salesPagination: { ...initialPagination },
        loadingBookingsPage: false,
        loadingSalesPage: false,
      });
    },

    /** Fetch the first page of bookings for a client. */
    loadBookingsPage1(clientId: number): void {
      const PAGE = 1;
      const PER_PAGE = store.bookingsPagination().perPage;

      patchState(store, {
        activeClientId: clientId,
        loadingBookingsPage: true,
      });

      bookingsApi.getBookings({ client_id: clientId, page: PAGE, per_page: PER_PAGE }).pipe(
        map((res: any) => {
          const response = res as ClientPaginatedResponse<Booking>;
          return {
            data: response.data ?? [],
            pagination: {
              currentPage: response.current_page,
              lastPage: response.last_page,
              total: response.total,
              perPage: response.per_page,
              hasMore: response.current_page < response.last_page,
            },
          };
        }),
        catchError((err) => {
          httpError.handle(err, 'cargar historial de reservas');
          return of({
            data: [] as Booking[],
            pagination: { ...initialPagination },
          });
        }),
      ).subscribe(({ data, pagination }) => {
        patchState(store, {
          paginatedBookings: data,
          bookingsPagination: pagination,
          loadingBookingsPage: false,
          loadedClients: { ...store.loadedClients(), [clientId]: true },
        });
      });
    },

    /** Fetch the next page of bookings (appends to list). */
    loadNextBookingsPage(clientId: number): void {
      const current = store.bookingsPagination();
      if (!current.hasMore || store.loadingBookingsPage()) return;

      const nextPage = current.currentPage + 1;

      patchState(store, { loadingBookingsPage: true });

      bookingsApi.getBookings({ client_id: clientId, page: nextPage, per_page: current.perPage }).pipe(
        map((res: any) => {
          const response = res as ClientPaginatedResponse<Booking>;
          return {
            data: response.data ?? [],
            pagination: {
              currentPage: response.current_page,
              lastPage: response.last_page,
              total: response.total,
              perPage: response.per_page,
              hasMore: response.current_page < response.last_page,
            },
          };
        }),
        catchError((err) => {
          httpError.handle(err, 'cargar más reservas');
          return of({
            data: [] as Booking[],
            pagination: current,
          });
        }),
      ).subscribe(({ data, pagination }) => {
        patchState(store, {
          paginatedBookings: [...store.paginatedBookings(), ...data],
          bookingsPagination: pagination,
          loadingBookingsPage: false,
        });
      });
    },

    /** Fetch the first page of sales for a client. */
    loadSalesPage1(clientId: number): void {
      const PAGE = 1;
      const PER_PAGE = store.salesPagination().perPage;

      patchState(store, {
        activeClientId: clientId,
        loadingSalesPage: true,
      });

      salesApi.getSales({ client_id: clientId, page: PAGE, per_page: PER_PAGE }).pipe(
        map((res: any) => {
          const response = res as ClientPaginatedResponse<Sale>;
          return {
            data: response.data ?? [],
            pagination: {
              currentPage: response.current_page,
              lastPage: response.last_page,
              total: response.total,
              perPage: response.per_page,
              hasMore: response.current_page < response.last_page,
            },
          };
        }),
        catchError((err) => {
          httpError.handle(err, 'cargar historial de pagos');
          return of({
            data: [] as Sale[],
            pagination: { ...initialPagination },
          });
        }),
      ).subscribe(({ data, pagination }) => {
        patchState(store, {
          paginatedSales: data,
          salesPagination: pagination,
          loadingSalesPage: false,
          loadedClients: { ...store.loadedClients(), [clientId]: true },
        });
      });
    },

    /** Fetch the next page of sales (appends to list). */
    loadNextSalesPage(clientId: number): void {
      const current = store.salesPagination();
      if (!current.hasMore || store.loadingSalesPage()) return;

      const nextPage = current.currentPage + 1;

      patchState(store, { loadingSalesPage: true });

      salesApi.getSales({ client_id: clientId, page: nextPage, per_page: current.perPage }).pipe(
        map((res: any) => {
          const response = res as ClientPaginatedResponse<Sale>;
          return {
            data: response.data ?? [],
            pagination: {
              currentPage: response.current_page,
              lastPage: response.last_page,
              total: response.total,
              perPage: response.per_page,
              hasMore: response.current_page < response.last_page,
            },
          };
        }),
        catchError((err) => {
          httpError.handle(err, 'cargar más pagos');
          return of({
            data: [] as Sale[],
            pagination: current,
          });
        }),
      ).subscribe(({ data, pagination }) => {
        patchState(store, {
          paginatedSales: [...store.paginatedSales(), ...data],
          salesPagination: pagination,
          loadingSalesPage: false,
        });
      });
    },
  })),
);
