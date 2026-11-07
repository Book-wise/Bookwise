import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  Service,
  ServicePack,
  PaginatedResponse,
  CreateServicePayload,
  UpdateServicePayload,
  ServiceStatus,
} from '@models';
import { collectPaginatedPages } from './collect-paginated';
import { buildHttpParams } from './build-http-params';

export type GetServicesParams = {
  search?: string;
  status?: ServiceStatus;
  active?: 0 | 1;
};

export interface ServiceImage {
  image_url: string;
  image_thumb_url: string;
}

@Injectable({ providedIn: 'root' })
export class ServicesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getServices(params?: GetServicesParams): Observable<Service[]> {
    // El backend ya devuelve `{data, links, meta}` (pagina a 15 por defecto):
    // se agregan todas las páginas para no truncar el catálogo a la primera.
    return collectPaginatedPages<Service>(this.http, `${this.baseUrl}/services`, params);
  }

  getService(id: number): Observable<Service> {
    return this.http.get<Service>(`${this.baseUrl}/services/${id}`);
  }

  createService(payload: CreateServicePayload): Observable<Service> {
    return this.http.post<Service>(`${this.baseUrl}/services`, payload);
  }

  updateService(id: number, payload: UpdateServicePayload): Observable<Service> {
    return this.http.patch<Service>(`${this.baseUrl}/services/${id}`, payload);
  }

  deleteService(id: number, force = false): Observable<unknown> {
    return this.http.delete<unknown>(
      `${this.baseUrl}/services/${id}`,
      force ? { params: buildHttpParams({ force: 'true' }) } : {},
    );
  }

  uploadServiceImage(id: number, file: File): Observable<ServiceImage> {
    const form = new FormData();
    form.append('image', file);
    // No se setea Content-Type a mano: con FormData el navegador agrega el
    // multipart boundary automáticamente.
    return this.http.post<ServiceImage>(`${this.baseUrl}/services/${id}/image`, form);
  }

  getPacks(): Observable<PaginatedResponse<ServicePack>> {
    return this.http.get<PaginatedResponse<ServicePack>>(`${this.baseUrl}/packs`);
  }

  getPack(id: number): Observable<ServicePack> {
    return this.http.get<ServicePack>(`${this.baseUrl}/packs/${id}`);
  }
}
