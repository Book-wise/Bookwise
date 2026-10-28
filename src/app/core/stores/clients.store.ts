import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ClientsApiService, ClientListFilters } from '@services/api/clients-api.service';
import { Client } from '@models';

interface ClientsState {
  clients: Client[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

const initialState: ClientsState = {
  clients: [],
  loading: false,
  loaded: false,
  error: null,
};

/**
 * Store de la lista de clientes de "Base de Pacientes".
 *
 * Es dueño de la lista y de las mutaciones: `load` trae la lista agregada y
 * `create` / `update` / `deactivate` llaman al API y **parchean el cache** con
 * la respuesta del servidor (mismo patrón que `ReferenceStore` con
 * providers/locations). Así la pantalla no re-consulta la lista completa tras
 * cada alta/edición/desactivación.
 *
 * Hoy la lista se pide agregada (todas las páginas) porque el backend todavía
 * no está mergeado con paginación server-side; cuando eso llegue, `load` pide
 * una sola página y guarda `meta.total`.
 */
export const ClientsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withMethods((store, api = inject(ClientsApiService)) => {
    /** Inserta o reemplaza el cliente en la lista cacheada (sin re-fetch). */
    const patchClient = (client: Client): void => {
      const existing = store.clients().some((c) => c.id === client.id);
      patchState(store, {
        clients: existing
          ? store.clients().map((c) => (c.id === client.id ? client : c))
          : [client, ...store.clients()],
      });
    };

    return {
      /** Carga la lista completa agregada con búsqueda + filtros aplicados. */
      load(params: ClientListFilters & { search?: string }): Observable<void> {
        patchState(store, { loading: true, error: null });
        return api.listClients(params).pipe(
          tap({
            next: (clients) =>
              patchState(store, { clients, loading: false, loaded: true, error: null }),
            error: () => patchState(store, { loading: false, loaded: true, error: 'load_failed' }),
          }),
          map((): void => undefined),
        );
      },

      /** Alta: POST + agrega el cliente a la lista cacheada. */
      create(data: Partial<Client>): Observable<Client> {
        return api.createClient(data).pipe(tap(patchClient));
      },

      /** Edición: PATCH + merge en la lista cacheada. */
      update(id: number, data: Partial<Client> & { force?: boolean }): Observable<Client> {
        return api.updateClient(id, data).pipe(tap(patchClient));
      },

      /**
       * Desactivar (soft). `force = true` reintenta saltando el 409. Merge en el
       * cache al 200; el 409 (requires_confirmation) se propaga para que la
       * pantalla muestre el diálogo con `affects`.
       */
      deactivate(id: number, force = false): Observable<Client> {
        return api
          .updateClient(id, force ? { active: false, force: true } : { active: false })
          .pipe(tap(patchClient));
      },

      /** Merge directo de un cliente ya obtenido por otro camino. */
      patchClient,
    };
  }),
);
