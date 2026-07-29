import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Service, ServicePack, PaginatedResponse } from '@models';

@Injectable({ providedIn: 'root' })
export class ServicesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getServices(): Observable<Service[]> {
    return this.http.get<Service[]>(`${this.baseUrl}/services`);
  }

  getService(id: number): Observable<Service> {
    return this.http.get<Service>(`${this.baseUrl}/services/${id}`);
  }

  createService(payload: {
    name: string;
    price: number;
    duration_minutes: number;
  }): Observable<Service> {
    return this.http.post<Service>(`${this.baseUrl}/services`, payload);
  }

  getPacks(): Observable<PaginatedResponse<ServicePack>> {
    return this.http.get<PaginatedResponse<ServicePack>>(`${this.baseUrl}/packs`);
  }

  getPack(id: number): Observable<ServicePack> {
    return this.http.get<ServicePack>(`${this.baseUrl}/packs/${id}`);
  }
}
