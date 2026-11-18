import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Provider } from '@models';
import { collectPaginatedPages } from './collect-paginated';

@Injectable({ providedIn: 'root' })
export class ProvidersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Listado completo: agrega todas las páginas del envelope paginado (ver
   * `collectPaginatedPages`). `ReferenceStore` publica este array como fuente
   * canónica y lo comparten agenda, reservas, roles y dashboard.
   */
  getProviders(params?: { location_id?: number }): Observable<Provider[]> {
    return collectPaginatedPages<Provider>(this.http, `${this.baseUrl}/providers`, params);
  }

  getProvider(id: number): Observable<Provider> {
    return this.http.get<Provider>(`${this.baseUrl}/providers/${id}`);
  }

  createProvider(data: Partial<Provider>): Observable<{ message: string; data: Provider }> {
    return this.http.post<{ message: string; data: Provider }>(`${this.baseUrl}/providers`, data);
  }

  updateProvider(id: number, data: Partial<Provider>): Observable<{ message: string; data: Provider }> {
    return this.http.patch<{ message: string; data: Provider }>(`${this.baseUrl}/providers/${id}`, data);
  }
}
