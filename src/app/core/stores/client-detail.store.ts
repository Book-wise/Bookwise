import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject } from '@angular/core';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { ApiService } from '@services/api.service';
import { ClientPack, Sale, Booking } from '@models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DomainState<T> {
  data: T[];
  loading: boolean;
  loaded: boolean;
}

function emptyDomain<T>(): DomainState<T> {
  return { data: [], loading: false, loaded: false };
}

interface ClientDetailState {
  packs: DomainState<ClientPack>;
  sales: DomainState<Sale>;
  recent: DomainState<Booking>;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: ClientDetailState = {
  packs: emptyDomain(),
  sales: emptyDomain(),
  recent: emptyDomain(),
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const ClientDetailStore = signalStore(
  withState(initialState),

  withMethods((store, api = inject(ApiService)) => {
    const loadPacks = rxMethod<number>(
      pipe(
        tap(() => patchState(store, {
          packs: { ...store.packs(), loading: true },
        })),
        switchMap((clientId) =>
          api.getClientPacks(clientId).pipe(
            tap({
              next: (data) => patchState(store, {
                packs: { data, loading: false, loaded: true },
              }),
              error: () => patchState(store, {
                packs: { data: [], loading: false, loaded: true },
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
          api.getSales({ client_id: clientId }).pipe(
            tap({
              next: (res) => patchState(store, {
                sales: { data: res.data, loading: false, loaded: true },
              }),
              error: () => patchState(store, {
                sales: { data: [], loading: false, loaded: true },
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
          api.getBookings({ client_id: clientId, per_page: 10 }).pipe(
            tap({
              next: (res) => patchState(store, {
                recent: { data: res.data, loading: false, loaded: true },
              }),
              error: () => patchState(store, {
                recent: { data: [], loading: false, loaded: true },
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

      resetData(): void {
        patchState(store, initialState);
      },
    };
  }),
);
