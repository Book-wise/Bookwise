import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  pipe, switchMap, tap, catchError, of, debounceTime, Subject, forkJoin,
} from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { BlockedSlotsApiService } from '@services/api/blocked-slots-api.service';
import { AuthService } from '@services/auth.service';
import {
  Booking, BlockedSlot, CreateBooking, UpdateBooking, CreateBlockedSlot, User,
} from '@models';
import { STATUS_COLOR_MAP } from '@features/admin/bookings/constants/booking-statuses';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoadingState {
  bookings: boolean;
  blockedSlots: boolean;
  mutation: boolean;
}

interface ErrorState {
  bookings: string | null;
  blockedSlots: string | null;
  mutation: string | null;
  mutationError: HttpErrorResponse | null;
}

interface FilterState {
  selectedLocationId: number | null;
  selectedProviderId: number | null;
  selectedStatusIds: number[];
  scopeProviderId: number | null;   // set once at init — non-null = provider role
}

interface BookingStoreState {
  bookings: Booking[];
  blockedSlots: BlockedSlot[];
  loading: LoadingState;
  error: ErrorState;
  filters: FilterState;
  dateFrom: string;
  dateTo: string;
  selectedBookingId: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  classNames?: string[];
  extendedProps?: Record<string, unknown>;
}

/**
 * Optimistic update helper.
 * Mutates an array immediately, returns the previous snapshot for rollback.
 */
function optimisticUpdate<T>(
  current: T[],
  mutateFn: (items: T[]) => T[],
): { previous: T[]; next: T[] } {
  const previous = [...current];
  const next = mutateFn(previous);
  return { previous, next };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialLoading: LoadingState = {
  bookings: false,
  blockedSlots: false,
  mutation: false,
};

const initialError: ErrorState = {
  bookings: null,
  blockedSlots: null,
  mutation: null,
  mutationError: null,
};

const initialFilters: FilterState = {
  selectedLocationId: null,
  selectedProviderId: null,
  selectedStatusIds: [],
  scopeProviderId: null,
};

const initialState: BookingStoreState = {
  bookings: [],
  blockedSlots: [],
  loading: initialLoading,
  error: initialError,
  filters: initialFilters,
  dateFrom: '',
  dateTo: '',
  selectedBookingId: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const BookingStore = signalStore(
  { providedIn: 'root' },

  // ── State ──────────────────────────────────────────────────────
  withState(initialState),

  // ── Computed signals ───────────────────────────────────────────
  withComputed((store) => ({
    filteredBookings: computed(() => {
      const ids = store.filters().selectedStatusIds;
      if (ids.length === 0) return store.bookings();
      return store.bookings().filter((b) => ids.includes(b.status_id));
    }),

    eventsForCalendar: computed<CalendarEvent[]>(() => {
      const events: CalendarEvent[] = [];
      const statusIds = store.filters().selectedStatusIds;
      const visibleBookings = statusIds.length > 0
        ? store.bookings().filter((b) => statusIds.includes(b.status_id))
        : store.bookings();

      for (const b of visibleBookings) {
        events.push({
          id: String(b.id),
          title: `${b.client?.first_name ?? ''} ${b.client?.last_name ?? ''} · ${b.service?.name ?? ''}`.trim(),
          start: b.start_time,
          end: b.end_time,
          backgroundColor: b.status?.color ?? STATUS_COLOR_MAP[b.status_id] ?? '#ccc',
          borderColor: b.status?.color ?? STATUS_COLOR_MAP[b.status_id] ?? '#ccc',
          textColor: '#000',
          extendedProps: { booking: b },
        });
      }

      for (const s of store.blockedSlots()) {
        events.push({
          id: `blocked-${s.id}`,
          title: s.reason || 'Bloqueado',
          start: s.start_time,
          end: s.end_time,
          classNames: ['fc-blocked-slot'],
          extendedProps: { isBlocked: true, blockedSlot: s },
        });
      }

      return events;
    }),

    anyLoading: computed(() =>
      store.loading().bookings || store.loading().blockedSlots || store.loading().mutation,
    ),

    isProviderRole: computed(() => store.filters().scopeProviderId !== null),

    selectedBooking: computed(() => {
      const id = store.selectedBookingId();
      if (id === null) return null;
      return store.bookings().find(b => b.id === id) ?? null;
    }),
  })),

  // ── Methods ────────────────────────────────────────────────────
  withMethods((store, bookingsApi = inject(BookingsApiService), blockedSlotsApi = inject(BlockedSlotsApiService), destroyRef = inject(DestroyRef)) => {
    // ── Internal subject for debounced re-fetch after filter change ─
    const refetchTrigger$ = new Subject<void>();

    // ── Build API params from current state ─────────────────────
    function buildBookingParams(dateFrom: string, dateTo: string) {
      const filters = store.filters();
      const params: {
        date_from: string; date_to: string; per_page: number;
        provider_id?: number; location_id?: number;
      } = { date_from: dateFrom, date_to: dateTo, per_page: 500 };

      // Role scope overrides user selection
      const providerId = filters.scopeProviderId ?? filters.selectedProviderId;
      if (providerId != null) params.provider_id = providerId;
      if (filters.selectedLocationId != null) params.location_id = filters.selectedLocationId;

      return params;
    }

    // ── loadEvents: fetch bookings + blockedSlots ───────────────
    const loadEvents = rxMethod<{ dateFrom: string; dateTo: string }>(
      pipe(
        tap(({ dateFrom, dateTo }) =>
          patchState(store, {
            dateFrom,
            dateTo,
            loading: { ...store.loading(), bookings: true, blockedSlots: true },
            error: { ...store.error(), bookings: null, blockedSlots: null },
          }),
        ),
        switchMap(({ dateFrom, dateTo }) =>
          forkJoin({
            bookingsRes: bookingsApi.getBookings(buildBookingParams(dateFrom, dateTo)),
            blockedSlotsRes: blockedSlotsApi.getBlockedSlots({
              date_from: dateFrom,
              date_to: dateTo,
              ...(store.filters().scopeProviderId ?? store.filters().selectedProviderId
                ? { provider_id: store.filters().scopeProviderId ?? store.filters().selectedProviderId! }
                : {}),
              ...(store.filters().selectedLocationId
                ? { location_id: store.filters().selectedLocationId! }
                : {}),
            }),
          }).pipe(
            tap({
              next: ({ bookingsRes, blockedSlotsRes }) => {
                const raw = bookingsRes as unknown as Booking[] | { data: Booking[] };
                const bookings: Booking[] = Array.isArray(raw) ? raw : (raw.data ?? []);
                const blockedSlots: BlockedSlot[] = blockedSlotsRes?.data ?? [];

                patchState(store, {
                  bookings,
                  blockedSlots,
                  loading: { ...store.loading(), bookings: false, blockedSlots: false },
                });
              },
              error: (err: Error) =>
                patchState(store, {
                  loading: { ...store.loading(), bookings: false, blockedSlots: false },
                  error: {
                    ...store.error(),
                    bookings: err.message ?? 'Error al cargar reservas',
                    blockedSlots: err.message ?? 'Error al cargar slots bloqueados',
                  },
                }),
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    // ── Debounced re-fetch after filter changes ────────────────
    const debouncedRefetch = rxMethod<void>(
      pipe(
        debounceTime(300),
        switchMap(() => {
          const df = store.dateFrom();
          const dt = store.dateTo();
          if (df && dt) return of({ dateFrom: df, dateTo: dt });
          return of(null);
        }),
        tap((range) => {
          if (range) loadEvents(range);
        }),
      ),
    );

    refetchTrigger$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => debouncedRefetch());

    // ── Optimistic mutations ───────────────────────────────────

    const createBooking = rxMethod<CreateBooking>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: { ...store.loading(), mutation: true },
            error: { ...store.error(), mutationError: null, mutation: null },
          }),
        ),
        switchMap((data) =>
          bookingsApi.createBooking(data).pipe(
            tap({
              next: (booking) =>
                patchState(store, {
                  bookings: [...store.bookings(), booking],
                  loading: { ...store.loading(), mutation: false },
                }),
              error: (err: Error) =>
                patchState(store, {
                  loading: { ...store.loading(), mutation: false },
                  error: { ...store.error(), mutationError: null, mutation: err.message ?? 'Error al crear reserva' },
                }),
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    const updateBooking = rxMethod<{ id: number; data: UpdateBooking }>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: { ...store.loading(), mutation: true },
            error: { ...store.error(), mutationError: null, mutation: null },
          }),
        ),
        switchMap(({ id, data }) => {
          // Optimistic: patch immediately
          const { previous, next } = optimisticUpdate(
            store.bookings(),
            (items) =>
              items.map((b) =>
                b.id === id ? { ...b, ...data } as Booking : b,
              ),
          );
          patchState(store, { bookings: next });

          return bookingsApi.updateBooking(id, data).pipe(
            tap({
              next: (updated) =>
                patchState(store, {
                  // Merge canonical data from API
                  bookings: store.bookings().map((b) =>
                    b.id === id ? { ...b, ...updated } : b,
                  ),
                  loading: { ...store.loading(), mutation: false },
                }),
              error: (err) => {
                // Revert on failure; capture API error message
                const apiMsg = (err.error as { detail?: string; error?: string } | null)
                  ?.detail ?? (err.error as { message?: string } | null)?.message
                  ?? err.message
                  ?? 'Error al actualizar reserva';
                patchState(store, {
                  bookings: previous,
                  loading: { ...store.loading(), mutation: false },
                  error: { ...store.error(), mutationError: err, mutation: apiMsg },
                });
              },
            }),
            catchError(() => of(undefined)),
          );
        }),
      ),
    );

    const deleteBooking = rxMethod<number>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: { ...store.loading(), mutation: true },
            error: { ...store.error(), mutationError: null, mutation: null },
          }),
        ),
        switchMap((id) => {
          // Optimistic: remove immediately
          const { previous, next } = optimisticUpdate(
            store.bookings(),
            (items) => items.filter((b) => b.id !== id),
          );
          patchState(store, { bookings: next });

          // Note: there's no bookingsApi.deleteBooking() — use cancelBooking instead.
          // We treat cancel as the delete operation since the backend doesn't hard-delete.
          return bookingsApi.cancelBooking(id).pipe(
            tap({
              next: () =>
                patchState(store, {
                  loading: { ...store.loading(), mutation: false },
                }),
              error: () => {
                patchState(store, {
                  bookings: previous,
                  loading: { ...store.loading(), mutation: false },
                  error: { ...store.error(), mutationError: null, mutation: 'Error al cancelar reserva' },
                });
              },
            }),
            catchError(() => of(undefined)),
          );
        }),
      ),
    );

    const blockSlot = rxMethod<CreateBlockedSlot>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: { ...store.loading(), mutation: true },
            error: { ...store.error(), mutationError: null, mutation: null },
          }),
        ),
        switchMap((data) =>
          blockedSlotsApi.createBlockedSlot(data).pipe(
            switchMap(() => {
              // Blocked slot created — re-fetch blockedSlots to get canonical list
              const df = store.dateFrom();
              const dt = store.dateTo();
              if (!df || !dt) {
                patchState(store, { loading: { ...store.loading(), mutation: false } });
                return of(undefined);
              }
              return blockedSlotsApi.getBlockedSlots({
                date_from: df, date_to: dt,
                ...(store.filters().scopeProviderId ?? store.filters().selectedProviderId
                  ? { provider_id: store.filters().scopeProviderId ?? store.filters().selectedProviderId! }
                  : {}),
                ...(store.filters().selectedLocationId
                  ? { location_id: store.filters().selectedLocationId! }
                  : {}),
              }).pipe(
                tap({
                  next: (res) =>
                    patchState(store, {
                      blockedSlots: res.data,
                      loading: { ...store.loading(), mutation: false },
                    }),
                  error: () =>
                    patchState(store, {
                      loading: { ...store.loading(), mutation: false },
                    }),
                }),
                catchError(() => of(undefined)),
              );
            }),
            tap({
              error: (err: Error) =>
                patchState(store, {
                  loading: { ...store.loading(), mutation: false },
                  error: { ...store.error(), mutationError: null, mutation: err.message ?? 'Error al bloquear slot' },
                }),
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    const unblockSlot = rxMethod<number>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: { ...store.loading(), mutation: true },
            error: { ...store.error(), mutationError: null, mutation: null },
          }),
        ),
        switchMap((id) => {
          // Optimistic: remove immediately
          const { previous, next } = optimisticUpdate(
            store.blockedSlots(),
            (items) => items.filter((s) => s.id !== id),
          );
          patchState(store, { blockedSlots: next });

          return blockedSlotsApi.deleteBlockedSlot(id).pipe(
            tap({
              next: () =>
                patchState(store, {
                  loading: { ...store.loading(), mutation: false },
                }),
              error: () => {
                patchState(store, {
                  blockedSlots: previous,
                  loading: { ...store.loading(), mutation: false },
                  error: { ...store.error(), mutationError: null, mutation: 'Error al eliminar bloqueo' },
                });
              },
            }),
            catchError(() => of(undefined)),
          );
        }),
      ),
    );

    // ── Refresh a single booking by re-fetching from API ──────────
    const refreshBooking = rxMethod<number>(
      pipe(
        switchMap((id) =>
          bookingsApi.getBooking(id).pipe(
            tap({
              next: (booking) => {
                patchState(store, {
                  bookings: store.bookings().map(b => b.id === booking.id ? booking : b),
                });
              },
              error: (err: Error) => {
                patchState(store, {
                  error: { ...store.error(), mutation: err.message ?? 'Error al refrescar reserva' },
                });
              },
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    return {
      // Loaders
      loadEvents,

      // Filters — apply synchronously, trigger debounced re-fetch
      setFilters(partial: Partial<FilterState>) {
        const { scopeProviderId: _, ...safe } = partial;
        patchState(store, { filters: { ...store.filters(), ...safe } });
        refetchTrigger$.next();
      },

      // Selection
      selectBooking(booking: Booking): void {
        patchState(store, { selectedBookingId: booking.id });
      },
      setSelectedBookingId(id: number | null): void {
        patchState(store, { selectedBookingId: id });
      },
      mergeBooking(updated: Booking): void {
        patchState(store, {
          bookings: store.bookings().map(b => b.id === updated.id ? updated : b),
        });
      },

      // Mutations
      createBooking,
      updateBooking,
      deleteBooking,
      blockSlot,
      unblockSlot,

      // Refresh
      refreshBooking,
    };
  }),

  // ── Lifecycle hooks ────────────────────────────────────────────
  withHooks({
    onInit(store, auth = inject(AuthService)) {
      const user = auth.user();
      const scopeProviderId = user?.role === 'provider' ? (user.provider_id ?? null) : null;
      patchState(store, { filters: { ...store.filters(), scopeProviderId } });
    },
  }),
);
