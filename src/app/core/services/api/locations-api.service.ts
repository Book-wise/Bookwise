import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { Location, PaginatedResponse, Region, LocationComuna } from '@models';
import { buildHttpParams } from './build-http-params';

/**
 * Tamaño de página al listar. El backend pagina (`{data, links, meta}`, default
 * 15) y no acota `per_page`, así que pedimos un valor explícito y acotado.
 */
const LIST_PER_PAGE = 25;

@Injectable({ providedIn: 'root' })
export class LocationsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getLocations(): Observable<Location[]> {
    return this.http
      .get<PaginatedResponse<Location>>(`${this.baseUrl}/locations`, {
        params: buildHttpParams({ per_page: LIST_PER_PAGE }),
      })
      .pipe(map((res) => res.data));
  }

  getLocation(id: number): Observable<Location> {
    return this.http.get<Location>(`${this.baseUrl}/locations/${id}`);
  }

  createLocation(data: Partial<Location>): Observable<{ message: string; data: Location }> {
    return this.http.post<{ message: string; data: Location }>(`${this.baseUrl}/locations`, data);
  }

  updateLocation(id: number, data: Partial<Location> & { force?: boolean }): Observable<{ message: string; data: Location }> {
    return this.http.patch<{ message: string; data: Location }>(`${this.baseUrl}/locations/${id}`, data);
  }

  getRegions(): Observable<{ data: Region[] }> {
    return this.http.get<{ data: Region[] }>(`${this.baseUrl}/regions`);
  }

  getComunas(regionId: number): Observable<{ data: LocationComuna[] }> {
    return this.http.get<{ data: LocationComuna[] }>(`${this.baseUrl}/regions/${regionId}/comunas`);
  }

  getAllComunas(): Observable<{ data: (LocationComuna & { region_id: number })[] }> {
    return this.http.get<{ data: (LocationComuna & { region_id: number })[] }>(`${this.baseUrl}/comunas`);
  }
}
