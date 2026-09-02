import { Injectable, signal, computed, Signal } from '@angular/core';
import { Router } from '@angular/router';

/** FullCalendar view type that a pending navigation may request. */
export type PendingCalendarView = 'dayGridMonth' | 'timeGridWeek';

/**
 * Optional view context carried by a pending navigation so the calendar opens
 * mirroring the caller's active range (e.g. the admin dashboard range). When
 * absent the calendar keeps its default behaviour (initial week view, today).
 */
export interface CalendarViewContext {
  view: PendingCalendarView;
  /** ISO date (yyyy-MM-dd) the calendar should position on. */
  gotoDate?: string;
  /** ISO end date of the source range — used to describe a custom/libre range. */
  rangeEnd?: string;
}

@Injectable({ providedIn: 'root' })
export class CalendarNavigationService {
  private readonly pendingLocationId = signal<number | null>(null);
  private readonly pendingProviderId = signal<number | null>(null);
  private readonly pendingStatusIds = signal<number[]>([]);
  private readonly pendingView = signal<PendingCalendarView | null>(null);
  private readonly pendingGotoDate = signal<string | null>(null);
  private readonly pendingRangeEnd = signal<string | null>(null);

  /** True if any pending navigation filter/context is set (location, provider, status, or view). */
  readonly hasPendingNavigation: Signal<boolean> = computed(
    () =>
      this.pendingLocationId() !== null ||
      this.pendingProviderId() !== null ||
      this.pendingStatusIds().length > 0 ||
      this.pendingView() !== null,
  );

  /**
   * Set pending filters/context and navigate. Clears after transactional read.
   * A caller may pass only `statusIds` (with null location/provider) — e.g. the
   * dashboard "Pending appointments" card — and it still works. That caller may
   * also pass a `context` (view + gotoDate) so the calendar opens on the view
   * matching the dashboard's active range instead of the default week. Callers
   * that only pre-select a location/provider (e.g. providers list) pass no
   * context and keep the default week behaviour.
   */
  navigateToCalendar(
    locationId: number | null,
    providerId: number | null,
    statusIds: number[],
    router: Router,
    context?: CalendarViewContext,
  ): Promise<void> {
    this.pendingLocationId.set(locationId);
    this.pendingProviderId.set(providerId);
    this.pendingStatusIds.set(statusIds);
    this.pendingView.set(context?.view ?? null);
    this.pendingGotoDate.set(context?.gotoDate ?? null);
    this.pendingRangeEnd.set(context?.rangeEnd ?? null);
    return router.navigate(['/admin', 'calendar']).then(
      () => undefined,
      () => {
        // Navigation failed (lazy chunk / guard rejection): never leave stale
        // pending signals that would mis-apply filters on a later visit.
        this.clearPending();
      },
    );
  }

  /** Transactional read-and-clear: returns pending state or nulls */
  consumePending(): {
    locationId: number | null;
    providerId: number | null;
    statusIds: number[];
    view: PendingCalendarView | null;
    gotoDate: string | null;
    rangeEnd: string | null;
  } {
    const result = {
      locationId: this.pendingLocationId(),
      providerId: this.pendingProviderId(),
      statusIds: this.pendingStatusIds(),
      view: this.pendingView(),
      gotoDate: this.pendingGotoDate(),
      rangeEnd: this.pendingRangeEnd(),
    };
    this.clearPending();
    return result;
  }

  private clearPending(): void {
    this.pendingLocationId.set(null);
    this.pendingProviderId.set(null);
    this.pendingStatusIds.set([]);
    this.pendingView.set(null);
    this.pendingGotoDate.set(null);
    this.pendingRangeEnd.set(null);
  }
}
