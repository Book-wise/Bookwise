import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
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
    return this.http.get<Client[]>(`${this.baseUrl}/clients`, {
      params: params ? buildHttpParams(params) : undefined,
    });
  }

  /**
   * Listado completo de clientes para la pantalla "Base de Pacientes": agrega
   * todas las páginas (igual que providers/locations) para que el contador
   * "Mostrando X de N" sea real y la búsqueda no trunque a 15. Cuando el
   * backend entregue el envelope `{data, links, meta}` (contrato §1),
   * `collectPaginatedPages` ya lo consume sin cambios.
   */
  listClients(params?: ClientListFilters & { search?: string }): Observable<Client[]> {
    return collectPaginatedPages<Client>(
      this.http,
      `${this.baseUrl}/clients`,
      params as Record<string, unknown> | undefined,
    );
  }

  getClient(id: number): Observable<Client> {
    return this.http.get<{ data: Client }>(`${this.baseUrl}/clients/${id}`).pipe(map((r) => r.data));
  }

  createClient(client: Partial<Client>): Observable<Client> {
    return this.http.post<Client>(`${this.baseUrl}/clients`, client);
  }

  updateClient(id: number, data: Partial<Client>): Observable<Client> {
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
