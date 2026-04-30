import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Location,
  Provider,
  Service,
  ServicePack,
  Client,
  ClientPack,
  Booking,
  Sale,
  AvailableSlot,
  PaginatedResponse,
  ApiError
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // Endpoints públicos (sin autenticación)
  
  getLocations(): Observable<Location[]> {
    return this.http.get<Location[]>(`${this.baseUrl}/locations`);
  }

  getLocation(id: number): Observable<Location> {
    return this.http.get<Location>(`${this.baseUrl}/locations/${id}`);
  }

  getServices(): Observable<Service[]> {
    return this.http.get<Service[]>(`${this.baseUrl}/services`);
  }

  getService(id: number): Observable<Service> {
    return this.http.get<Service>(`${this.baseUrl}/services/${id}`);
  }

  getPacks(): Observable<ServicePack[]> {
    return this.http.get<ServicePack[]>(`${this.baseUrl}/packs`);
  }

  getPack(id: number): Observable<ServicePack> {
    return this.http.get<ServicePack>(`${this.baseUrl}/packs/${id}`);
  }

  getAvailableSlots(params: {
    location_id?: number;
    provider_id?: number;
    service_id?: number;
    date?: string;
  }): Observable<AvailableSlot[]> {
    let httpParams = new HttpParams();
    if (params.location_id) httpParams = httpParams.set('location_id', params.location_id.toString());
    if (params.provider_id) httpParams = httpParams.set('provider_id', params.provider_id.toString());
    if (params.service_id) httpParams = httpParams.set('service_id', params.service_id.toString());
    if (params.date) httpParams = httpParams.set('date', params.date);

    return this.http.get<AvailableSlot[]>(`${this.baseUrl}/available_slots`, { params: httpParams });
  }

  // Endpoints autenticados

  // Providers
  getProviders(params?: { location_id?: number }): Observable<Provider[]> {
    let httpParams = new HttpParams();
    if (params?.location_id) httpParams = httpParams.set('location_id', params.location_id.toString());
    return this.http.get<Provider[]>(`${this.baseUrl}/providers`, { params: httpParams });
  }

  getProvider(id: number): Observable<Provider> {
    return this.http.get<Provider>(`${this.baseUrl}/providers/${id}`);
  }

  // Bookings
  getBookings(params?: {
    location_id?: number;
    provider_id?: number;
    client_id?: number;
    status_id?: number;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<Booking>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }
    return this.http.get<PaginatedResponse<Booking>>(`${this.baseUrl}/bookings`, { params: httpParams });
  }

  getBooking(id: number): Observable<Booking> {
    return this.http.get<Booking>(`${this.baseUrl}/bookings/${id}`);
  }

  createBooking(booking: Partial<Booking>): Observable<Booking> {
    return this.http.post<Booking>(`${this.baseUrl}/bookings`, booking);
  }

  updateBooking(id: number, booking: Partial<Booking>): Observable<Booking> {
    return this.http.patch<Booking>(`${this.baseUrl}/bookings/${id}`, booking);
  }

  cancelBooking(id: number): Observable<Booking> {
    return this.http.patch<Booking>(`${this.baseUrl}/bookings/${id}/cancel`, {});
  }

  // Clients
  getClients(params?: {
    location_id?: number;
    search?: string;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<Client>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }
    return this.http.get<PaginatedResponse<Client>>(`${this.baseUrl}/clients`, { params: httpParams });
  }

  getClient(id: number): Observable<Client> {
    return this.http.get<Client>(`${this.baseUrl}/clients/${id}`);
  }

  getClientPacks(clientId: number): Observable<ClientPack[]> {
    return this.http.get<ClientPack[]>(`${this.baseUrl}/clients/${clientId}/packs`);
  }

  // Sales
  getSales(params?: {
    location_id?: number;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<Sale>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }
    return this.http.get<PaginatedResponse<Sale>>(`${this.baseUrl}/sales`, { params: httpParams });
  }

  getSale(id: number): Observable<Sale> {
    return this.http.get<Sale>(`${this.baseUrl}/sales/${id}`);
  }

  // Client Packs
  getClientPacksList(params?: {
    client_id?: number;
    status?: string;
  }): Observable<PaginatedResponse<ClientPack>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }
    return this.http.get<PaginatedResponse<ClientPack>>(`${this.baseUrl}/client-packs`, { params: httpParams });
  }

  useClientPack(clientPackId: number, bookingId: number): Observable<ClientPack> {
    return this.http.patch<ClientPack>(`${this.baseUrl}/client-packs/${clientPackId}/use`, { booking_id: bookingId });
  }
}