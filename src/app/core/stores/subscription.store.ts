import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject, computed } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, catchError, of, pipe, switchMap, tap } from 'rxjs';
import { SubscriptionApiService } from '@services/api/subscription-api.service';
import { PlanCatalogGroup, Subscription, UsageData } from '@models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityName = 'plans' | 'subscription' | 'usage';

interface SubscriptionState {
  /** Catálogo público de planes (GET /v1/plans), estático por sesión. */
  plans: PlanCatalogGroup[];
  /** Suscripción de la cuenta activa (GET /v1/subscription). */
  subscription: Subscription | null;
  /** Uso vs límite de la cuenta activa (GET /v1/subscription/usage). */
  usage: UsageData | null;
  // Meta-state por entidad
  loading: Record<EntityName, boolean>;
  loaded: Record<EntityName, boolean>;
  /** Último error de red por entidad (para que el componente decida el toast). */
  error: Record<EntityName, HttpErrorResponse | null>;
}

const initialLoading: Record<EntityName, boolean> = {
  plans: false,
  subscription: false,
  usage: false,
};
const initialLoaded: Record<EntityName, boolean> = {
  plans: false,
  subscription: false,
  usage: false,
};
const initialError: Record<EntityName, HttpErrorResponse | null> = {
  plans: null,
  subscription: null,
  usage: null,
};

const initialState: SubscriptionState = {
  plans: [],
  subscription: null,
  usage: null,
  loading: initialLoading,
  loaded: initialLoaded,
  error: initialError,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Caché de la cuenta para planes/suscripción/uso.
 *
 * El catálogo `plans` es público y estable → se cachea para toda la sesión
 * (`loaded` no-op). `subscription` y `usage` son de la CUENTA activa; se
 * cachean y solo se re-consultan al invalidarlos explícitamente (p. ej. tras
 * un cambio de plan o reactivación). Así `billing`, `/admin/planes` y la
 * pantalla de negocios comparten UN solo round-trip por entidad en vez de
 * repetir llamadas en cada navegación.
 */
export const SubscriptionStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => ({
    anyLoading: computed(() => Object.values(store.loading()).some(Boolean)),
  })),

  withMethods((store, subscriptionApi = inject(SubscriptionApiService)) => {
    /** GET /v1/plans — lazy, cacheado de por vida (catálogo público). */
    const loadPlans = rxMethod<void>(
      pipe(
        switchMap(() => {
          if (store.loaded().plans || store.loading().plans) return EMPTY;
          patchState(store, {
            loading: { ...store.loading(), plans: true },
            error: { ...store.error(), plans: null },
          });
          return subscriptionApi.getPlans().pipe(
            tap({
              next: (res) =>
                patchState(store, {
                  plans: res.data ?? [],
                  loading: { ...store.loading(), plans: false },
                  loaded: { ...store.loaded(), plans: true },
                }),
              error: (err: HttpErrorResponse) =>
                patchState(store, {
                  loading: { ...store.loading(), plans: false },
                  error: { ...store.error(), plans: err },
                }),
            }),
            catchError(() => of(undefined)),
          );
        }),
      ),
    );

    /** GET /v1/subscription — lazy, cacheado hasta invalidación. */
    const loadSubscription = rxMethod<void>(
      pipe(
        switchMap(() => {
          if (store.loaded().subscription || store.loading().subscription) return EMPTY;
          patchState(store, {
            loading: { ...store.loading(), subscription: true },
            error: { ...store.error(), subscription: null },
          });
          return subscriptionApi.getSubscription().pipe(
            tap({
              next: (res) =>
                patchState(store, {
                  subscription: res.data ?? null,
                  loading: { ...store.loading(), subscription: false },
                  loaded: { ...store.loaded(), subscription: true },
                }),
              error: (err: HttpErrorResponse) =>
                patchState(store, {
                  subscription: null,
                  loading: { ...store.loading(), subscription: false },
                  loaded: { ...store.loaded(), subscription: true },
                  error: { ...store.error(), subscription: err },
                }),
            }),
            catchError(() => of(undefined)),
          );
        }),
      ),
    );

    /** GET /v1/subscription/usage — lazy, cacheado hasta invalidación. */
    const loadUsage = rxMethod<void>(
      pipe(
        switchMap(() => {
          if (store.loaded().usage || store.loading().usage) return EMPTY;
          patchState(store, {
            loading: { ...store.loading(), usage: true },
            error: { ...store.error(), usage: null },
          });
          return subscriptionApi.getUsage().pipe(
            tap({
              next: (res) =>
                patchState(store, {
                  usage: res.data ?? null,
                  loading: { ...store.loading(), usage: false },
                  loaded: { ...store.loaded(), usage: true },
                }),
              error: (err: HttpErrorResponse) =>
                patchState(store, {
                  usage: null,
                  loading: { ...store.loading(), usage: false },
                  loaded: { ...store.loaded(), usage: true },
                  error: { ...store.error(), usage: err },
                }),
            }),
            catchError(() => of(undefined)),
          );
        }),
      ),
    );

    return {
      loadPlans,
      loadSubscription,
      loadUsage,

      /**
       * PUT /subscription/addons — upsert de la cantidad de packs de un canal.
       * Parchea la suscripción con la respuesta canónica del servidor (trae
       * addons, addons_total_clp, total_price_clp y addon_catalog actualizados)
       * y re-throw del error para que el componente decida el toast.
       */
      setAddon(type: 'email' | 'whatsapp', quantity: number) {
        return subscriptionApi.updateAddons(type, quantity).pipe(
          tap((res) =>
            patchState(store, {
              subscription: res.data,
              loaded: { ...store.loaded(), subscription: true },
              error: { ...store.error(), subscription: null },
            }),
          ),
        );
      },

      /** Fuerza la re-consulta de la suscripción (p. ej. tras cambiar de plan). */
      invalidateSubscription(): void {
        patchState(store, { loaded: { ...store.loaded(), subscription: false } });
        loadSubscription();
      },

      /** Fuerza la re-consulta del uso (p. ej. tras consumir cupo). */
      invalidateUsage(): void {
        patchState(store, { loaded: { ...store.loaded(), usage: false } });
        loadUsage();
      },

      /** Re-consulta suscripción + uso (p. ej. tras cambiar de cuenta activa). */
      invalidateAccountData(): void {
        patchState(store, {
          loaded: { ...store.loaded(), subscription: false, usage: false },
        });
        loadSubscription();
        loadUsage();
      },
    };
  }),
);
