import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import {
  ClientsApiService,
  ClientListFilters,
  ClientPageParams,
} from '@services/api/clients-api.service';
import { Client } from '@models';

interface ClientsState {
  clients: Client[];
  total: number;
  from: number;
  to: number;
  lastPage: number;
  currentPage: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

const initialState: ClientsState = {
  clients: [],
  total: 0,
  from: 0,
  to: 0,
  lastPage: 1,
  currentPage: 1,
  loading: false,
  loaded: false,
  error: null,
};

/** Query completa del listado (server-side): página + orden + filtros. */
export interface ClientsQuery {
  page: number;
  perPage: number;
  sort: string;
  direction: 'asc' | 'desc';
  filters: ClientListFilters & { search?: string };
}

/**
 * Store de la lista de clientes de "Base de Pacientes".
 *
 * Server-side: `load` pide UNA página (con `meta.total`/`from`/`to`/`last_page`,
 * sort y filtros) y guarda la metadata. Las mutaciones (`create`/`update`/
 * `deactivate`) llaman al API y **parchean la página actual** con la respuesta
 * del servidor, sin re-consultar el listado (patrón de `ReferenceStore`).
 */
export const ClientsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withMethods((store, api = inject(ClientsApiService)) => {
    /** Inserta o reemplaza el cliente en la página cacheada (sin re-fetch). */
    const patchClient = (client: Client): void => {
      const existing = store.clients().some((c) => c.id === client.id);
      patchState(store, {
        clients: existing
          ? store.clients().map((c) => (c.id === client.id ? client : c))
          : [client, ...store.clients()],
      });
    };

    return {
      /** Pide una página del listado con su metadata. */
      load(query: ClientsQuery): Observable<void> {
        patchState(store, { loading: true, error: null });
        const params: ClientPageParams = {
          ...query.filters,
          sort: query.sort,
          direction: query.direction,
        };
        return api.listClientsPage(params, query.page, query.perPage).pipe(
          tap({
            next: (page) =>
              patchState(store, {
                clients: page.rows,
                total: page.total,
                from: page.from,
                to: page.to,
                lastPage: page.lastPage,
                currentPage: page.currentPage,
                loading: false,
                loaded: true,
                error: null,
              }),
            error: () => patchState(store, { loading: false, loaded: true, error: 'load_failed' }),
          }),
          map((): void => undefined),
        );
      },

      /** Alta: POST + agrega el cliente a la página cacheada. */
      create(data: Partial<Client>): Observable<Client> {
        return api.createClient(data).pipe(tap(patchClient));
      },

      /** Edición: PATCH + merge en la página cacheada. */
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
