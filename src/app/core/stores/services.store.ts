import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject } from '@angular/core';
import { Observable, catchError, defer, forkJoin, map, of, pipe, switchMap, tap } from 'rxjs';
import { ServicesApiService } from '@services/api/services-api.service';
import type { Service, ServicePack } from '@models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityName = 'services' | 'packs';

interface ServicesState {
  services: Service[];
  packs: ServicePack[];
  loading: Record<EntityName, boolean>;
  loaded: Record<EntityName, boolean>;
  error: Record<EntityName, string | null>;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: ServicesState = {
  services: [],
  packs: [],
  loading: { services: false, packs: false },
  loaded: { services: false, packs: false },
  error: { services: null, packs: null },
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Store de dominio del catálogo de servicios y packs.
 *
 * Separado de `ReferenceStore` (antes el store «Dios»): este store es el único
 * dueño de `services` y `packs` y conserva la misma semántica de carga, flags
 * de loading/loaded/error por entidad e invalidación que tenía el store
 * original, para no romper a los consumidores.
 */
export const ServicesStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withMethods((store, servicesApi = inject(ServicesApiService)) => {
    // Observable-returning loaders. Each one owns its loading/error bookkeeping
    // and never emits an error (per-entity catchError), so they can be composed
    // with forkJoin by reloadAll() while the rxMethod wrappers below keep the
    // trigger semantics for loadServices()/loadPacks().
    const fetchServices = (): Observable<void> => {
      patchState(store, {
        loading: { ...store.loading(), services: true },
        error: { ...store.error(), services: null },
      });
      return servicesApi.getServices().pipe(
        tap({
          next: (services) =>
            patchState(store, {
              services,
              loading: { ...store.loading(), services: false },
              loaded: { ...store.loaded(), services: true },
            }),
          error: (err) =>
            patchState(store, {
              loading: { ...store.loading(), services: false },
              error: { ...store.error(), services: err.message ?? 'Error al cargar servicios' },
            }),
        }),
        catchError(() => of(undefined)),
        map((): void => undefined),
      );
    };

    const loadServices = rxMethod<void>(pipe(switchMap(() => fetchServices())));

    const fetchPacks = (): Observable<void> => {
      patchState(store, {
        loading: { ...store.loading(), packs: true },
        error: { ...store.error(), packs: null },
      });
      return servicesApi.getPacks().pipe(
        map((res) => res.data),
        tap({
          next: (packs) =>
            patchState(store, {
              packs,
              loading: { ...store.loading(), packs: false },
              loaded: { ...store.loaded(), packs: true },
            }),
          error: (err) =>
            patchState(store, {
              loading: { ...store.loading(), packs: false },
              error: { ...store.error(), packs: err.message ?? 'Error al cargar paquetes' },
            }),
        }),
        catchError(() => of(undefined)),
        map((): void => undefined),
      );
    };

    const loadPacks = rxMethod<void>(pipe(switchMap(() => fetchPacks())));

    /**
     * Recarga services y packs para un cambio de tenant (compuesto por
     * `ReferenceStore.reloadAll`). Limpia las listas PRIMERO y devuelve un
     * observable frío que se completa sin error aunque una entidad falle.
     */
    const reloadAll = (): Observable<void> => {
      patchState(store, {
        services: [],
        packs: [],
        loading: { ...store.loading(), services: true, packs: true },
        loaded: { ...store.loaded(), services: false, packs: false },
        error: { ...store.error(), services: null, packs: null },
      });
      return defer(() => forkJoin([fetchServices(), fetchPacks()])).pipe(
        map((): void => undefined),
      );
    };

    return {
      loadServices,
      loadPacks,
      reloadAll,

      invalidateServices(): void {
        patchState(store, { loaded: { ...store.loaded(), services: false } });
        loadServices();
      },
      invalidatePacks(): void {
        patchState(store, { loaded: { ...store.loaded(), packs: false } });
        loadPacks();
      },
    };
  }),
);
