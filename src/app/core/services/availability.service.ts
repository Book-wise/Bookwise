import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { ProviderAvailability, AvailableSlot } from '@models';

// Interfaz para disponibilidad - aún sin endpoint en API
export interface ProviderAvailabilitySlot {
  id?: number;
  provider_id: number;
  location_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AvailabilityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // MOCK: Disponibilidad por defecto hasta que exista endpoint en API
  private mockAvailability: ProviderAvailabilitySlot[] = [
    // Provider 1 - Lunes a Viernes 9:00 a 18:00
    { provider_id: 1, location_id: 1, day_of_week: 1, start_time: '09:00', end_time: '18:00', is_active: true },
    { provider_id: 1, location_id: 1, day_of_week: 2, start_time: '09:00', end_time: '18:00', is_active: true },
    { provider_id: 1, location_id: 1, day_of_week: 3, start_time: '09:00', end_time: '18:00', is_active: true },
    { provider_id: 1, location_id: 1, day_of_week: 4, start_time: '09:00', end_time: '18:00', is_active: true },
    { provider_id: 1, location_id: 1, day_of_week: 5, start_time: '09:00', end_time: '18:00', is_active: true },
  ];

  // Obtener disponibilidad de un profesional
  getProviderAvailability(providerId: number): Observable<ProviderAvailabilitySlot[]> {
    // TODO: Reemplazar con endpoint real cuando exista
    // return this.http.get<ProviderAvailabilitySlot[]>(`${this.baseUrl}/providers/${providerId}/availability`);
    
    return of(this.mockAvailability.filter(a => a.provider_id === providerId)).pipe(delay(300));
  }

  // Obtener disponibilidad por location
  getLocationAvailability(locationId: number, date?: string): Observable<AvailableSlot[]> {
    // Este usa el endpoint existente de available_slots
    return this.http.get<AvailableSlot[]>(`${this.baseUrl}/available_slots`, {
      params: { location_id: locationId.toString() }
    });
  }

  // Guardar disponibilidad del profesional (mock)
  saveProviderAvailability(providerId: number, availability: ProviderAvailabilitySlot[]): Observable<ProviderAvailabilitySlot[]> {
    // TODO: Reemplazar con endpoint real cuando exista
    // return this.http.post<ProviderAvailabilitySlot[]>(`${this.baseUrl}/providers/${providerId}/availability`, { availability });
    
    this.mockAvailability = [
      ...this.mockAvailability.filter(a => a.provider_id !== providerId),
      ...availability
    ];
    return of(availability).pipe(delay(500));
  }

  // Verificar colisiones de horario
  checkScheduleCollision(providerId: number, locationId: number, startTime: string, endTime: string, excludeBookingId?: number): Observable<{ has_collision: boolean; colliding_bookings: number[] }> {
    // TODO: Endpoint real cuando exista
    // return this.http.post<{has_collision: boolean; colliding_bookings: number[]}>(`${this.baseUrl}/providers/${providerId}/check-collision`, { ... });
    
    // Mock: siempre sin colisión
    return of({ has_collision: false, colliding_bookings: [] }).pipe(delay(200));
  }

  // Obtener horarios disponibles para una fecha específica
  getAvailableHours(locationId: number, providerId: number, serviceId: number, date: string): Observable<{ time: string; available: boolean }[]> {
    // Generarmock de horarios disponibles
    const hours: { time: string; available: boolean }[] = [];
    for (let h = 9; h < 18; h++) {
      hours.push({ time: `${h.toString().padStart(2, '0')}:00`, available: Math.random() > 0.3 });
      hours.push({ time: `${h.toString().padStart(2, '0')}:30`, available: Math.random() > 0.3 });
    }
    return of(hours).pipe(delay(300));
  }
}