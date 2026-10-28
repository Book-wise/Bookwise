import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, of, switchMap } from 'rxjs';
import { environment } from '@env/environment';
import { Client, ClientPack, PaginatedResponse } from '@models';
import { buildHttpParams } from './build-http-params';
import { collectPaginatedPages } from './collect-paginated';

/**
 * Filtros de "Base de Pacientes" (contrato de clientes §3). Todos opcionales;
 * el backend ignora los params que todavía no implementa.
 */
export interface ClientListFilters {
  location_id?: number;
  provider_id?: number;
  service_id?: number;
  booking_status_id?: number;
  has_booked?: 'ever' | 'upcoming';
  gender?: string;
  birth_date_from?: string;
  birth_date_to?: string;
  created_from?: string;
  created_to?: string;
}

/** Params de una página del listado: filtros + búsqueda + orden server-side. */
export interface ClientPageParams extends ClientListFilters {
  search?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
}

/** Una página del listado con su metadata (server-side). */
export interface ClientPage {
  rows: Client[];
  total: number;
  from: number;
  to: number;
  lastPage: number;
  currentPage: number;
}

@Injectable({ providedIn: 'root' })
export class ClientsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getClients(params?: {
    location_id?: number;
    search?: string;
    page?: number;
    per_page?: number;
  }): Observable<Client[]> {
    return this.http
      .get<Client[] | PaginatedResponse<Client>>(`${this.baseUrl}/clients`, {
        params: params ? buildHttpParams(params) : undefined,
      })
      .pipe(map((res) => (Array.isArray(res) ? res : (res?.data ?? []))));
  }

  /**
   * Listado completo de clientes para la pantalla "Base de Pacientes": agrega
   * todas las páginas (igual que providers/locations) para que el contador
   * "Mostrando X de N" sea real y la búsqueda no trunque a 15. Cuando el
   * backend entregue el envelope `{data, links, meta}` (contrato §1),
   * `collectPaginatedPages` ya lo consume sin cambios.
   */
  /**
   * Una página del listado (server-side): usa `meta.total`/`from`/`to`/`last_page`.
   * Si el backend todavía devuelve array plano (deploy pendiente), cae a agregar
   * todas las páginas con `collectPaginatedPages` para no romper la pantalla.
   */
  listClientsPage(params: ClientPageParams, page = 1, perPage = 10): Observable<ClientPage> {
    const url = `${this.baseUrl}/clients`;
    return this.http
      .get<Client[] | PaginatedResponse<Client>>(url, {
        params: buildHttpParams({ ...params, per_page: perPage, page }),
      })
      .pipe(
        switchMap((res) => {
          if (Array.isArray(res)) {
            return collectPaginatedPages<Client>(this.http, url, params as Record<string, unknown>).pipe(
              map((rows) => ({
                rows,
                total: rows.length,
                from: rows.length ? 1 : 0,
                to: rows.length,
                lastPage: 1,
                currentPage: 1,
              })),
            );
          }
          const meta = res.meta;
          return of({
            rows: res.data,
            total: meta.total,
            from: meta.from,
            to: meta.to,
            lastPage: meta.last_page,
            currentPage: meta.current_page,
          });
        }),
      );
  }

  getClient(id: number): Observable<Client> {
    return this.http.get<{ data: Client }>(`${this.baseUrl}/clients/${id}`).pipe(map((r) => r.data));
  }

  createClient(client: Partial<Client>): Observable<Client> {
    return this.http.post<Client>(`${this.baseUrl}/clients`, client);
  }

  updateClient(id: number, data: Partial<Client> & { force?: boolean }): Observable<Client> {
    return this.http
      .patch<{ data: Client }>(`${this.baseUrl}/clients/${id}`, data)
      .pipe(map((r) => r.data));
  }

  getClientPacks(clientId: number): Observable<ClientPack[]> {
    return this.http
      .get<{ data: ClientPack[] }>(`${this.baseUrl}/clients/${clientId}/packs`)
      .pipe(map((r) => r.data));
  }

  getClientPacksList(params?: {
    client_id?: number;
    status?: string;
  }): Observable<PaginatedResponse<ClientPack>> {
    return this.http.get<PaginatedResponse<ClientPack>>(`${this.baseUrl}/client-packs`, {
      params: params ? buildHttpParams(params) : undefined,
    });
  }

  useClientPack(clientPackId: number, bookingId: number): Observable<ClientPack> {
    return this.http.patch<ClientPack>(`${this.baseUrl}/client-packs/${clientPackId}/use`, {
      booking_id: bookingId,
    });
  }
}
