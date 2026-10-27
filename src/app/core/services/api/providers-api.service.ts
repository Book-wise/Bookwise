import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { PaginatedResponse, Provider } from '@models';
import { buildHttpParams } from './build-http-params';

/**
 * Tamaño de página al listar. El backend pagina (`{data, links, meta}`, default
 * 15) y **no valida ni acota `per_page`**, así que pedimos un valor explícito y
 * acotado en vez de depender de un número enorme.
 */
const LIST_PER_PAGE = 25;

@Injectable({ providedIn: 'root' })
export class ProvidersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getProviders(params?: { location_id?: number }): Observable<Provider[]> {
    const query = buildHttpParams({ ...params, per_page: LIST_PER_PAGE });
    return this.http
      .get<PaginatedResponse<Provider>>(`${this.baseUrl}/providers`, { params: query })
      .pipe(map((res) => res.data));
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
