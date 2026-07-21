import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AvailableSlot } from '@models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private readonly api = inject(ApiService);

  getLocationAvailability(locationId: number, date: string, serviceId?: number): Observable<AvailableSlot[]> {
    return this.api.getAvailableSlots({
      location_id: locationId,
      service_id: serviceId,
      date,
    });
  }
}
