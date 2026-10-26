import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { PaginatedResponse, SiiActivity } from '@models';

/** Filtros del catálogo SII. Todos opcionales. */
export interface SiiActivitiesQuery {
  /** Filtro parcial case-insensitive sobre `code` OR `description`. */
  search?: string;
  page?: number;
  /** 1–100. Si se omite, el backend aplica 25. */
  perPage?: number;
}

/**
 * Catálogo público de actividades económicas del SII (el "giro" del perfil
 * fiscal). 700 códigos, ordenados por `code` ascendente.
 *
 * Con 700 filas no conviene traer el catálogo entero: se busca server-side con
 * debounce desde el select.
 */
@Injectable({ providedIn: 'root' })
export class SiiActivitiesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * GET /sii-activities?search=&page=&per_page= (público, sin token).
   * Devuelve el paginador estándar de Laravel (`data` + `meta`).
   */
  search(query: SiiActivitiesQuery = {}): Observable<PaginatedResponse<SiiActivity>> {
    let params = new HttpParams();

    const term = query.search?.trim();
    if (term) params = params.set('search', term);
    if (query.page && query.page > 0) params = params.set('page', String(query.page));
    if (query.perPage && query.perPage > 0) params = params.set('per_page', String(query.perPage));

    return this.http.get<PaginatedResponse<SiiActivity>>(`${this.baseUrl}/sii-activities`, { params });
  }
}
