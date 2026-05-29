import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of, map } from 'rxjs';
import { environment } from '@env/environment';
import {
  Location,
  Provider,
  Service,
  ServicePack,
  Client,
  ClientPack,
  Booking,
  BlockedSlot,
  Sale,
  AvailableSlot,
  PaginatedResponse,
  ApiError,
  AuthResponse,
  LoginCredentials,
  RegisterData,
  CreateBooking,
  UpdateBooking,
  BlockConflictResponse,
  CreateSaleRequest,
  UpdateSaleRequest,
  CreateTransactionRequest,
  SaleDetailResponse,
  CreateTransactionResponse,
} from '@models';

@Injectable({
  providedIn: 'root',
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

  createService(payload: { name: string; price: number; duration_minutes: number }): Observable<Service> {
    return this.http.post<Service>(`${this.baseUrl}/services`, payload);
  }

  getPacks(): Observable<PaginatedResponse<ServicePack>> {
    return this.http.get<PaginatedResponse<ServicePack>>(`${this.baseUrl}/packs`);
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
    if (params.location_id)
      httpParams = httpParams.set('location_id', params.location_id.toString());
    if (params.provider_id)
      httpParams = httpParams.set('provider_id', params.provider_id.toString());
    if (params.service_id) httpParams = httpParams.set('service_id', params.service_id.toString());
    if (params.date) httpParams = httpParams.set('date', params.date);

    return this.http.get<AvailableSlot[]>(`${this.baseUrl}/available_slots`, {
      params: httpParams,
    });
  }

  // Blocked slots
  getBlockedSlots(params: { date_from: string; date_to: string; location_id?: number; provider_id?: number }): Observable<{ data: BlockedSlot[] }> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null) httpParams = httpParams.set(k, String(v)); });
    return this.http.get<{ data: BlockedSlot[] }>(`${this.baseUrl}/blocked-slots`, { params: httpParams });
  }

  createBlockedSlot(body: {
    start_time: string; end_time: string;
    reason?: string; provider_id?: number | null; location_id?: number | null;
    repeat?: { type: string; interval: number; days?: number[]; end_type: string; count?: number; until?: string };
  }): Observable<Partial<BlockConflictResponse>> {
    return this.http.post<Partial<BlockConflictResponse>>(`${this.baseUrl}/blocked-slots`, body);
  }

  updateBlockedSlot(id: number, body: { start_time: string; end_time: string; reason?: string; provider_id?: number | null }): Observable<BlockedSlot> {
    return this.http.patch<BlockedSlot>(`${this.baseUrl}/blocked-slots/${id}`, body);
  }

  deleteBlockedSlot(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/blocked-slots/${id}`);
  }

  deleteBlockedSlotGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/blocked-slots/group/${groupId}`);
  }

  // Auth
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, credentials);
  }

  register(data: RegisterData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, data);
  }

  // Endpoints autenticados

  // Providers
  getProviders(params?: { location_id?: number }): Observable<Provider[]> {
    let httpParams = new HttpParams();
    if (params?.location_id)
      httpParams = httpParams.set('location_id', params.location_id.toString());
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
    return this.http.get<PaginatedResponse<Booking>>(`${this.baseUrl}/bookings`, {
      params: httpParams,
    });
  }

  getBooking(id: number): Observable<Booking> {
    return this.http.get<Booking>(`${this.baseUrl}/bookings/${id}`);
  }

  createBooking(booking: CreateBooking): Observable<Booking> {
    return this.http.post<Booking>(`${this.baseUrl}/bookings`, booking);
  }

  updateBooking(id: number, booking: UpdateBooking): Observable<Booking> {
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
  }): Observable<Client[]> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }
    return this.http.get<Client[]>(`${this.baseUrl}/clients`, {
      params: httpParams,
    });
  }

  getClient(id: number): Observable<Client> {
    return this.http.get<Client>(`${this.baseUrl}/clients/${id}`);
  }

  createClient(client: Partial<Client>): Observable<Client> {
    return this.http.post<Client>(`${this.baseUrl}/clients`, client);
  }

  getClientPacks(clientId: number): Observable<ClientPack[]> {
    return this.http.get<ClientPack[]>(`${this.baseUrl}/clients/${clientId}/packs`);
  }

  // Sales
  getSales(params?: {
    client_id?: number;
    client_pack_id?: number;
    payment_status?: 'paid' | 'partial' | 'unpaid';
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

  getSale(id: number): Observable<SaleDetailResponse> {
    return this.http.get<SaleDetailResponse>(`${this.baseUrl}/sales/${id}`);
  }

  createSale(body: CreateSaleRequest): Observable<SaleDetailResponse> {
    return this.http.post<SaleDetailResponse>(`${this.baseUrl}/sales`, body);
  }

  updateSale(id: number, body: UpdateSaleRequest): Observable<SaleDetailResponse> {
    return this.http.patch<SaleDetailResponse>(`${this.baseUrl}/sales/${id}`, body);
  }

  createTransaction(saleId: number, body: CreateTransactionRequest): Observable<CreateTransactionResponse> {
    return this.http.post<CreateTransactionResponse>(`${this.baseUrl}/sales/${saleId}/transactions`, body);
  }

  deleteTransaction(saleId: number, transactionId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/sales/${saleId}/transactions/${transactionId}`);
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
    return this.http.get<PaginatedResponse<ClientPack>>(`${this.baseUrl}/client-packs`, {
      params: httpParams,
    });
  }

  useClientPack(clientPackId: number, bookingId: number): Observable<ClientPack> {
    return this.http.patch<ClientPack>(`${this.baseUrl}/client-packs/${clientPackId}/use`, {
      booking_id: bookingId,
    });
  }
}
