import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import {
  Booking,
  CreateBooking,
  UpdateBooking,
  ApiResponse,
  PaginatedResponse,
  AvailableSlot,
} from '@models';
import { buildHttpParams } from './build-http-params';

@Injectable({ providedIn: 'root' })
export class BookingsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

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
    return this.http.get<PaginatedResponse<Booking>>(`${this.baseUrl}/bookings`, {
      params: params ? buildHttpParams(params) : undefined,
    });
  }

  getBooking(id: number): Observable<Booking> {
    return this.http
      .get<{ data: Booking }>(`${this.baseUrl}/bookings/${id}`)
      .pipe(map((r) => r.data));
  }

  createBooking(booking: CreateBooking): Observable<Booking> {
    return this.http.post<Booking>(`${this.baseUrl}/bookings`, booking);
  }

  updateBooking(id: number, booking: UpdateBooking): Observable<ApiResponse<Booking>> {
    return this.http.patch<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}`, booking);
  }

  cancelBooking(id: number): Observable<Booking> {
    return this.http.patch<Booking>(`${this.baseUrl}/bookings/${id}/cancel`, {});
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
    if (params.service_id)
      httpParams = httpParams.set('service_id', params.service_id.toString());
    if (params.date) httpParams = httpParams.set('date', params.date);

    return this.http.get<AvailableSlot[]>(`${this.baseUrl}/available_slots`, {
      params: httpParams,
    });
  }
}
