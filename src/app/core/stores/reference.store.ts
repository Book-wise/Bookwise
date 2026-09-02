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
import { pipe, switchMap, tap, catchError, of, map, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { RolesApiService } from '@services/api/roles-api.service';
import { Client, Location, Provider, Service, ServicePack, Region, LocationComuna } from '@models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityName = 'clients' | 'locations' | 'providers' | 'services' | 'packs' | 'regions';

interface ReferenceState {
  // Entity arrays (read-only cache)
  clients: Client[];
  locations: Location[];
  providers: Provider[];
  services: Service[];
  packs: ServicePack[];
  regions: Region[];
  comunasByRegion: Record<number, LocationComuna[]>;
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
  regions: false,
};
const initialLoaded: Record<EntityName, boolean> = {
  clients: false,
  locations: false,
  providers: false,
  services: false,
  packs: false,
  regions: false,
};
const initialError: Record<EntityName, string | null> = {
  clients: null,
  locations: null,
  providers: null,
  services: null,
  packs: null,
  regions: null,
};

const initialState: ReferenceState = {
  clients: [],
  locations: [],
  providers: [],
  services: [],
  packs: [],
  regions: [],
  comunasByRegion: {},
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

  // ── Methods (load + invalidation + mutations en un solo bloque, usando closures) ──
  withMethods((store, locationsApi = inject(LocationsApiService), providersApi = inject(ProvidersApiService), servicesApi = inject(ServicesApiService), clientsApi = inject(ClientsApiService), rolesApi = inject(RolesApiService)) => {
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
          locationsApi.getLocations().pipe(
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
          providersApi.getProviders().pipe(
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
          servicesApi.getServices().pipe(
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
          clientsApi.getClients().pipe(
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
          servicesApi.getPacks().pipe(
            map((res) => res.data),
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

    const loadRegions = rxMethod<void>(
      pipe(
        tap(() =>
          patchState(store, {
            loading: { ...store.loading(), regions: true },
            error: { ...store.error(), regions: null },
          }),
        ),
        switchMap(() =>
          locationsApi.getRegions().pipe(
            tap({
              next: (regions) => {
                patchState(store, { regions: regions.data, loading: { ...store.loading(), regions: false }, loaded: { ...store.loaded(), regions: true } });
                // Single request for all comunas (replaces N per-region calls)
                loadAllComunas();
              },
              error: (err) =>
                patchState(store, { loading: { ...store.loading(), regions: false }, error: { ...store.error(), regions: err.message ?? 'Error al cargar regiones' } }),
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    function loadAllComunas(): void {
      locationsApi.getAllComunas().subscribe({
        next: (res) => {
          const comunasByRegion: Record<number, LocationComuna[]> = {};
          for (const comuna of res.data) {
            if (!comunasByRegion[comuna.region_id]) {
              comunasByRegion[comuna.region_id] = [];
            }
            comunasByRegion[comuna.region_id].push(comuna);
          }
          patchState(store, { comunasByRegion });
        },
        error: () => { /* comunas are non-critical, fail silently */ },
      });
    }

    const loadAll = rxMethod<void>(
      pipe(
        tap(() => {
          loadLocations();
          loadProviders();
          loadServices();
          loadClients();
          loadPacks();
          loadRegions();
        }),
      ),
    );

    // ── Catalog mutations (patrón BookingStore, pero con re-throw) ─────
    // Dueñas del write: llaman al endpoint y patchan el estado con la
    // RESPUESTA del server (single source of truth). Devuelven el Observable
    // y NO tragan errores (Design Decisión 9): el subscriber decide el toast
    // o el diálogo. Sin meta-estado de mutación (loading/error) en el store.
    const createProvider = (data: Partial<Provider>) =>
      providersApi.createProvider(data).pipe(
        tap((res) => patchState(store, { providers: [...store.providers(), res.data] })),
      );

    const saveProviderBasics = (id: number, data: Partial<Provider>) =>
      providersApi.updateProvider(id, data).pipe(
        tap((res) => {
          const providers = store.providers();
          const index = providers.findIndex((p) => p.id === id);
          patchState(store, {
            providers:
              index >= 0
                ? providers.map((p) => (p.id === id ? { ...p, ...res.data } : p))
                : [...providers, res.data],
          });
        }),
      );

    /**
     * Flip optimista síncrono sobre `providers` + PATCH {active}.
     * 200 → merge canónico con res.data; error → rollback al snapshot previo y
     * RE-THROW del HttpErrorResponse (incluye el 409 requires_confirmation, que
     * NO se traga: el subscriber decide A2 vs A4). La reactivación nunca gatea.
     */
    const toggleProviderActive = (id: number, active: boolean) => {
      const snapshot = store.providers();
      patchState(store, {
        providers: snapshot.map((p) => (p.id === id ? { ...p, active } : p)),
      });
      return providersApi.updateProvider(id, { active }).pipe(
        tap((res) =>
          patchState(store, {
            providers: store.providers().map((p) =>
              p.id === id ? { ...p, ...res.data } : p,
            ),
          }),
        ),
        catchError((err: HttpErrorResponse) => {
          patchState(store, { providers: snapshot });
          return throwError(() => err);
        }),
      );
    };

    const assignProviderRoles = (providerId: number, roles: string[]) =>
      rolesApi.assignProviderRoles(providerId, roles).pipe(
        tap((res) =>
          patchState(store, {
            providers: store.providers().map((p) =>
              p.id === providerId ? { ...p, roles: res.data } : p,
            ),
          }),
        ),
      );

    // ── Location mutations (U6: mirror de los métodos de providers) ───────

    const createLocation = (data: Partial<Location>) =>
      locationsApi.createLocation(data).pipe(
        tap((res) => patchState(store, { locations: [...store.locations(), res.data] })),
      );

    /**
     * PATCH /locations/{id} con `data` (acepta `force` para el flujo de
     * desactivación forzada). 200 → merge canónico con res.data; error → re-throw
     * sin tocar el estado (no es optimista).
     */
    const updateLocation = (id: number, data: Partial<Location> & { force?: boolean }) =>
      locationsApi.updateLocation(id, data).pipe(
        tap((res) => {
          const locations = store.locations();
          const index = locations.findIndex((l) => l.id === id);
          patchState(store, {
            locations:
              index >= 0
                ? locations.map((l) => (l.id === id ? { ...l, ...res.data } : l))
                : [...locations, res.data],
          });
        }),
      );

    /**
     * Flip optimista síncrono sobre `locations` + PATCH {active[, force]}.
     * 200 → merge canónico con res.data; error → rollback al snapshot previo y
     * RE-THROW del HttpErrorResponse (incluye el 409 requires_confirmation).
     * Mirror exacto de toggleProviderActive (U3).
     */
    const toggleLocationActive = (id: number, active: boolean, force?: boolean) => {
      const snapshot = store.locations();
      patchState(store, {
        locations: snapshot.map((l) => (l.id === id ? { ...l, active } : l)),
      });
      return locationsApi.updateLocation(id, force ? { active, force: true } : { active }).pipe(
        tap((res) =>
          patchState(store, {
            locations: store.locations().map((l) =>
              l.id === id ? { ...l, ...res.data } : l,
            ),
          }),
        ),
        catchError((err: HttpErrorResponse) => {
          patchState(store, { locations: snapshot });
          return throwError(() => err);
        }),
      );
    };

    return {
      // Load individual
      loadLocations,
      loadProviders,
      loadServices,
      loadClients,
      loadPacks,
      loadRegions,
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
      invalidateRegions(): void {
        patchState(store, { loaded: { ...store.loaded(), regions: false } });
        loadRegions();
      },
      invalidateAll(): void {
        patchState(store, { loaded: { ...initialLoaded } });
        loadAll();
      },

      // Mutations (catalog write methods — patchan con respuesta del server)
      createProvider,
      saveProviderBasics,
      toggleProviderActive,
      assignProviderRoles,
      // Location mutations (U6)
      createLocation,
      updateLocation,
      toggleLocationActive,
    };
  }),

  // ── Lifecycle hooks ────────────────────────────────────────────
  withHooks({
    onInit({ loadAll }) {
      loadAll();
    },
  }),
);
