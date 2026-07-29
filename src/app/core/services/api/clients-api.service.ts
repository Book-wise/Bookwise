import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Client, ClientPack, PaginatedResponse } from '@models';
import { buildHttpParams } from './build-http-params';

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

  getClient(id: number): Observable<Client> {
    return this.http.get<Client>(`${this.baseUrl}/clients/${id}`);
  }

  createClient(client: Partial<Client>): Observable<Client> {
    return this.http.post<Client>(`${this.baseUrl}/clients`, client);
  }

  updateClient(id: number, data: Partial<Client>): Observable<Client> {
    return this.http.patch<Client>(`${this.baseUrl}/clients/${id}`, data);
  }

  getClientPacks(clientId: number): Observable<ClientPack[]> {
    return this.http.get<ClientPack[]>(`${this.baseUrl}/clients/${clientId}/packs`);
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
