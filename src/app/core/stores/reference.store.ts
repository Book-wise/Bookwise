import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject, computed } from '@angular/core';
import { pipe, switchMap, tap, catchError, of, map } from 'rxjs';
import { ApiService } from '@services/api.service';
import { Client, Location, Provider, Service, ServicePack } from '@models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityName = 'clients' | 'locations' | 'providers' | 'services' | 'packs';

interface ReferenceState {
  // Entity arrays (read-only cache)
  clients: Client[];
  locations: Location[];
  providers: Provider[];
  services: Service[];
  packs: ServicePack[];
  // Meta-state
  loading: Record<EntityName, boolean>;
  loaded: Record<EntityName, boolean>;
  error: Record<EntityName, string | null>;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialLoading: Record<EntityName, boolean> = {
  clients: false,
  locations: false,
  providers: false,
  services: false,
  packs: false,
};
const initialLoaded: Record<EntityName, boolean> = {
  clients: false,
  locations: false,
  providers: false,
  services: false,
  packs: false,
};
const initialError: Record<EntityName, string | null> = {
  clients: null,
  locations: null,
  providers: null,
  services: null,
  packs: null,
};

const initialState: ReferenceState = {
  clients: [],
  locations: [],
  providers: [],
  services: [],
  packs: [],
  loading: initialLoading,
  loaded: initialLoaded,
  error: initialError,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const ReferenceStore = signalStore(
  { providedIn: 'root' },

  // ── State ──────────────────────────────────────────────────────
  withState(initialState),

  // ── Computed signals ───────────────────────────────────────────
  withComputed((store) => ({
    anyLoading: computed(() => Object.values(store.loading()).some(Boolean)),
    allLoaded: computed(() => Object.values(store.loaded()).every(Boolean)),
  })),

  // ── Methods (load + invalidation en un solo bloque, usando closures) ──
  withMethods((store, api = inject(ApiService)) => {
    // Los rxMethods se definen como variables locales para que los métodos de
    // invalidación puedan referenciarlos por closure (evita type issues entre
    // withMethods encadenados)
    const loadLocations = rxMethod<void>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: { ...store.loading(), locations: true },
            error: { ...store.error(), locations: null },
          }),
        ),
        switchMap(() =>
          api.getLocations().pipe(
            tap({
              next: (locations) =>
                patchState(store, { locations, loading: { ...store.loading(), locations: false }, loaded: { ...store.loaded(), locations: true } }),
              error: (err) =>
                patchState(store, { loading: { ...store.loading(), locations: false }, error: { ...store.error(), locations: err.message ?? 'Error al cargar ubicaciones' } }),
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    const loadProviders = rxMethod<void>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: { ...store.loading(), providers: true },
            error: { ...store.error(), providers: null },
          }),
        ),
        switchMap(() =>
          api.getProviders().pipe(
            tap({
              next: (providers) =>
                patchState(store, { providers, loading: { ...store.loading(), providers: false }, loaded: { ...store.loaded(), providers: true } }),
              error: (err) =>
                patchState(store, { loading: { ...store.loading(), providers: false }, error: { ...store.error(), providers: err.message ?? 'Error al cargar proveedores' } }),
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    const loadServices = rxMethod<void>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: { ...store.loading(), services: true },
            error: { ...store.error(), services: null },
          }),
        ),
        switchMap(() =>
          api.getServices().pipe(
            tap({
              next: (services) =>
                patchState(store, { services, loading: { ...store.loading(), services: false }, loaded: { ...store.loaded(), services: true } }),
              error: (err) =>
                patchState(store, { loading: { ...store.loading(), services: false }, error: { ...store.error(), services: err.message ?? 'Error al cargar servicios' } }),
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    const loadClients = rxMethod<void>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: { ...store.loading(), clients: true },
            error: { ...store.error(), clients: null },
          }),
        ),
        switchMap(() =>
          api.getClients().pipe(
            tap({
              next: (clients) =>
                patchState(store, { clients, loading: { ...store.loading(), clients: false }, loaded: { ...store.loaded(), clients: true } }),
              error: (err) =>
                patchState(store, { loading: { ...store.loading(), clients: false }, error: { ...store.error(), clients: err.message ?? 'Error al cargar clientes' } }),
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    const loadPacks = rxMethod<void>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: { ...store.loading(), packs: true },
            error: { ...store.error(), packs: null },
          }),
        ),
        switchMap(() =>
          api.getPacks().pipe(
            tap({
              next: (packs) =>
                patchState(store, { packs, loading: { ...store.loading(), packs: false }, loaded: { ...store.loaded(), packs: true } }),
              error: (err) =>
                patchState(store, { loading: { ...store.loading(), packs: false }, error: { ...store.error(), packs: err.message ?? 'Error al cargar paquetes' } }),
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    const loadAll = rxMethod<void>(
      pipe(
        tap(() => {
          loadLocations();
          loadProviders();
          loadServices();
          loadClients();
          loadPacks();
        }),
      ),
    );

    return {
      // Load individual
      loadLocations,
      loadProviders,
      loadServices,
      loadClients,
      loadPacks,
      loadAll,

      // Invalidation (usa las closures, no store.method)
      invalidateLocations(): void {
        patchState(store, { loaded: { ...store.loaded(), locations: false } });
        loadLocations();
      },
      invalidateProviders(): void {
        patchState(store, { loaded: { ...store.loaded(), providers: false } });
        loadProviders();
      },
      invalidateServices(): void {
        patchState(store, { loaded: { ...store.loaded(), services: false } });
        loadServices();
      },
      invalidateClients(): void {
        patchState(store, { loaded: { ...store.loaded(), clients: false } });
        loadClients();
      },
      invalidatePacks(): void {
        patchState(store, { loaded: { ...store.loaded(), packs: false } });
        loadPacks();
      },
      invalidateAll(): void {
        patchState(store, { loaded: { ...initialLoaded } });
        loadAll();
      },
    };
  }),

  // ── Lifecycle hooks ────────────────────────────────────────────
  withHooks({
    onInit({ loadAll }) {
      loadAll();
    },
  }),
);
