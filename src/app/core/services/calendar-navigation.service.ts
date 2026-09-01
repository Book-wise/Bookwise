import { Injectable, signal, computed, Signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class CalendarNavigationService {
  private readonly pendingLocationId = signal<number | null>(null);
  private readonly pendingProviderId = signal<number | null>(null);
  private readonly pendingStatusIds = signal<number[]>([]);

  /** True if any pending navigation filter is set (location, provider, or status). */
  readonly hasPendingNavigation: Signal<boolean> = computed(
    () =>
      this.pendingLocationId() !== null ||
      this.pendingProviderId() !== null ||
      this.pendingStatusIds().length > 0,
  );

  /**
   * Set pending filters and navigate. Clears after transactional read.
   * A caller may pass only `statusIds` (with null location/provider) — e.g. the
   * dashboard "Pending appointments" card — and it still works.
   */
  navigateToCalendar(
    locationId: number | null,
    providerId: number | null,
    statusIds: number[],
    router: Router,
  ): Promise<void> {
    this.pendingLocationId.set(locationId);
    this.pendingProviderId.set(providerId);
    this.pendingStatusIds.set(statusIds);
    return router.navigate(['/admin', 'calendar']).then(
      () => undefined,
      () => {
        // Navigation failed (lazy chunk / guard rejection): never leave stale
        // pending signals that would mis-apply filters on a later visit.
        this.pendingLocationId.set(null);
        this.pendingProviderId.set(null);
        this.pendingStatusIds.set([]);
      },
    );
  }

  /** Transactional read-and-clear: returns pending state or nulls */
  consumePending(): { locationId: number | null; providerId: number | null; statusIds: number[] } {
    const result = {
      locationId: this.pendingLocationId(),
      providerId: this.pendingProviderId(),
      statusIds: this.pendingStatusIds(),
    };
    this.pendingLocationId.set(null);
    this.pendingProviderId.set(null);
    this.pendingStatusIds.set([]);
    return result;
  }
}
