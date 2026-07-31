import { Injectable, signal, computed, Signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class CalendarNavigationService {
  private readonly pendingLocationId = signal<number | null>(null);
  private readonly pendingProviderId = signal<number | null>(null);

  /** True if any pending navigation filter is set */
  readonly hasPendingNavigation: Signal<boolean> = computed(() =>
    this.pendingLocationId() !== null || this.pendingProviderId() !== null,
  );

  /** Set pending filters and navigate. Clears after transactional read. */
  navigateToCalendar(locationId: number, providerId: number, router: Router): void {
    this.pendingLocationId.set(locationId);
    this.pendingProviderId.set(providerId);
    void router.navigate(['/admin', 'calendar']);
  }

  /** Transactional read-and-clear: returns pending state or nulls */
  consumePending(): { locationId: number | null; providerId: number | null } {
    const result = {
      locationId: this.pendingLocationId(),
      providerId: this.pendingProviderId(),
    };
    this.pendingLocationId.set(null);
    this.pendingProviderId.set(null);
    return result;
  }
}
