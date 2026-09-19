import { Injectable } from '@angular/core';

/**
 * Per-user, per-tenant calendar preferences persisted in localStorage.
 *
 * Keys:
 * - Location: `bw:lastLocationId:<userId>:<tenantId>`
 * - Provider: `bw:lastProviderId:<userId>:<tenantId>`
 *
 * The legacy user-only location key `bw:lastLocationId:<userId>` (written
 * before tenant scoping) stays readable so an existing user does not lose
 * their remembered location, and is removed by `clearForUser` on logout.
 */
@Injectable({ providedIn: 'root' })
export class CalendarPrefsService {
  private readonly LOCATION_PREFIX = 'bw:lastLocationId';
  private readonly PROVIDER_PREFIX = 'bw:lastProviderId';

  /** Last location chosen by the user for the tenant, or null if none stored. */
  getLastLocationId(userId: number | null, tenantId: number | null): number | null {
    return this.readNumber(this.locationKeys(userId, tenantId));
  }

  /** Persists the last location for the tenant; null removes the key. */
  setLastLocationId(
    userId: number | null,
    tenantId: number | null,
    locationId: number | null,
  ): void {
    this.writeNumber(this.LOCATION_PREFIX, userId, tenantId, locationId);
  }

  /** Last provider chosen by the user for the tenant, or null (all providers). */
  getLastProviderId(userId: number | null, tenantId: number | null): number | null {
    return this.readNumber(this.providerKeys(userId, tenantId));
  }

  /** Persists the last provider for the tenant; null (all) removes the key. */
  setLastProviderId(
    userId: number | null,
    tenantId: number | null,
    providerId: number | null,
  ): void {
    this.writeNumber(this.PROVIDER_PREFIX, userId, tenantId, providerId);
  }

  /**
   * Removes every tenant-scoped preference of the user (location + provider)
   * plus the legacy user-only location key. Enumerates localStorage by prefix
   * so no tracked-key index can drift or leak stale keys.
   */
  clearForUser(userId: number | null): void {
    if (typeof window === 'undefined' || userId == null) return;
    const legacyKey = `${this.LOCATION_PREFIX}:${userId}`;
    const prefixes = [
      `${this.LOCATION_PREFIX}:${userId}:`,
      `${this.PROVIDER_PREFIX}:${userId}:`,
    ];
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key == null) continue;
      if (key === legacyKey || prefixes.some((prefix) => key.startsWith(prefix))) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
  }

  // ── internals ─────────────────────────────────────────────────────────

  private writeNumber(
    prefix: string,
    userId: number | null,
    tenantId: number | null,
    value: number | null,
  ): void {
    if (typeof window === 'undefined' || userId == null) return;
    const key = this.scopedKey(prefix, userId, tenantId);
    if (value == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, String(value));
    }
  }

  private scopedKey(prefix: string, userId: number, tenantId: number | null): string {
    return tenantId == null ? `${prefix}:${userId}` : `${prefix}:${userId}:${tenantId}`;
  }

  /** Read order: tenant-scoped key first, then the legacy user-only key. */
  private locationKeys(userId: number | null, tenantId: number | null): string[] {
    return this.readKeys(this.LOCATION_PREFIX, userId, tenantId);
  }

  private providerKeys(userId: number | null, tenantId: number | null): string[] {
    return this.readKeys(this.PROVIDER_PREFIX, userId, tenantId);
  }

  private readKeys(prefix: string, userId: number | null, tenantId: number | null): string[] {
    if (userId == null) return [];
    const keys = [`${prefix}:${userId}`];
    if (tenantId != null) keys.unshift(`${prefix}:${userId}:${tenantId}`);
    return keys;
  }

  private readNumber(keys: string[]): number | null {
    if (typeof window === 'undefined') return null;
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw == null) continue;
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
  }
}
