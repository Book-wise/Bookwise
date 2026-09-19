import { Injectable, Injector, inject, signal } from '@angular/core';
import { Observable, concatMap, map } from 'rxjs';
import { Location } from '@models';
import { AuthService } from './auth.service';
import { CalendarPrefsService } from './calendar-prefs.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { BookingStore } from '@core/stores/booking.store';

/**
 * Published by the coordinator after every successful switch so a mounted
 * agenda can react to the new tenant's resolved selection.
 */
export interface TenantSwitchResult {
  userId: number | null;
  tenantId: number;
  locationId: number | null;
  providerId: number | null;
}

/**
 * Owns the tenant-switch use case end to end, IN ORDER:
 *
 * 1. `AuthService.switchTenant` (identity only, never navigates),
 * 2. exactly one `ReferenceStore.reloadAll()`,
 * 3. selection resolution (tenant-scoped memory, first ACTIVE location, or
 *    `null` for the provider = all providers),
 * 4. `BookingStore.resetTenantState()` + `lastSwitch` publication.
 *
 * `AuthService` stays auth-only and `ReferenceStore` never imports it: the
 * coordinator is the only place that knows both. The reference store is
 * resolved LAZILY inside `switchTenant()` — never as a constructor parameter
 * or field initializer — because `AuthService` is constructed on the login
 * page and constructing the store there would fire its pre-auth `onInit`
 * `loadAll()`.
 */
@Injectable({ providedIn: 'root' })
export class TenantSwitchService {
  private readonly auth = inject(AuthService);
  private readonly calendarPrefs = inject(CalendarPrefsService);
  private readonly injector = inject(Injector);

  /** Last completed switch; `null` until the first successful one. */
  readonly lastSwitch = signal<TenantSwitchResult | null>(null);

  /**
   * Switches the active tenant and completes once identity, reference data and
   * selection are consistent. An auth failure propagates (no `catchError`
   * here) so call sites keep their `switchTenantErrorKey(err)` toast, and no
   * reload, selection resolution or reset runs after it.
   */
  switchTenant(tenantId: number): Observable<void> {
    return this.auth.switchTenant(tenantId).pipe(
      // 1 → 2: wait for the identity switch, then run exactly one full reload.
      concatMap(() => {
        // Lazy resolution: constructing this coordinator must never construct
        // the reference store (see the class doc for the pre-auth reason).
        const referenceStore = this.injector.get(ReferenceStore);
        return referenceStore.reloadAll().pipe(map(() => referenceStore));
      }),
      // 3 → 4: resolve the selection, then reset stale booking state and publish.
      map((referenceStore) => {
        const userId = this.auth.user()?.id ?? null;
        const locationId = this.resolveLocationId(
          referenceStore.locations(),
          userId,
          tenantId,
        );
        // Provider memory is carried as-is (null = all providers); the agenda
        // reconciles it against the new tenant's provider list. Never default
        // to the first available provider.
        const providerId = this.calendarPrefs.getLastProviderId(userId, tenantId);

        this.injector.get(BookingStore).resetTenantState();
        this.lastSwitch.set({ userId, tenantId, locationId, providerId });
      }),
    );
  }

  /**
   * Remembered location when it still exists AND is active; otherwise the first
   * ACTIVE location; otherwise `null` when the tenant has none available.
   */
  private resolveLocationId(
    locations: Location[],
    userId: number | null,
    tenantId: number,
  ): number | null {
    const activeLocations = locations.filter((location) => location.active);
    const rememberedId = this.calendarPrefs.getLastLocationId(userId, tenantId);
    if (rememberedId != null && activeLocations.some((location) => location.id === rememberedId)) {
      return rememberedId;
    }
    return activeLocations[0]?.id ?? null;
  }
}
