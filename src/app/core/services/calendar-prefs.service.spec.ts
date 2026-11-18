import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CalendarPrefsService } from './calendar-prefs.service';

const locationKey = (userId: number, tenantId: number) => `bw:lastLocationId:${userId}:${tenantId}`;
const providerKey = (userId: number, tenantId: number) => `bw:lastProviderId:${userId}:${tenantId}`;
const legacyLocationKey = (userId: number) => `bw:lastLocationId:${userId}`;

describe('CalendarPrefsService', () => {
  let service: CalendarPrefsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(CalendarPrefsService);
  });

  // ── getLastLocationId ─────────────────────────────────────────────────

  describe('getLastLocationId', () => {
    it('returns null when nothing is stored for the user/tenant', () => {
      expect(service.getLastLocationId(5, 1)).toBeNull();
    });

    it('returns the stored numeric id for the tenant', () => {
      localStorage.setItem(locationKey(5, 1), '2');

      expect(service.getLastLocationId(5, 1)).toBe(2);
    });

    it('is scoped per tenant (no cross-tenant resolution)', () => {
      localStorage.setItem(locationKey(5, 1), '2');

      expect(service.getLastLocationId(5, 2)).toBeNull();
    });

    it('keeps the same numeric location id independent per tenant', () => {
      localStorage.setItem(locationKey(5, 1), '2');
      localStorage.setItem(locationKey(5, 2), '9');

      expect(service.getLastLocationId(5, 1)).toBe(2);
      expect(service.getLastLocationId(5, 2)).toBe(9);
    });

    it('is scoped per user', () => {
      localStorage.setItem(locationKey(5, 1), '2');

      expect(service.getLastLocationId(9, 1)).toBeNull();
    });

    it('reads the legacy user-only key when no tenant-scoped key exists', () => {
      localStorage.setItem(legacyLocationKey(5), '2');

      expect(service.getLastLocationId(5, 1)).toBe(2);
    });

    it('prefers the tenant-scoped key over the legacy one', () => {
      localStorage.setItem(legacyLocationKey(5), '2');
      localStorage.setItem(locationKey(5, 1), '7');

      expect(service.getLastLocationId(5, 1)).toBe(7);
    });

    it('returns null for a null user id', () => {
      localStorage.setItem(locationKey(5, 1), '2');

      expect(service.getLastLocationId(null, 1)).toBeNull();
    });

    it('returns null when the stored value is not a number', () => {
      localStorage.setItem(locationKey(5, 1), 'not-a-number');

      expect(service.getLastLocationId(5, 1)).toBeNull();
    });
  });

  // ── setLastLocationId ─────────────────────────────────────────────────

  describe('setLastLocationId', () => {
    it('stores the location id under the tenant-scoped key', () => {
      service.setLastLocationId(5, 1, 2);

      expect(localStorage.getItem(locationKey(5, 1))).toBe('2');
    });

    it('removes the tenant-scoped key when locationId is null', () => {
      localStorage.setItem(locationKey(5, 1), '2');

      service.setLastLocationId(5, 1, null);

      expect(localStorage.getItem(locationKey(5, 1))).toBeNull();
    });

    it('does not touch another tenant key', () => {
      service.setLastLocationId(5, 2, 9);
      service.setLastLocationId(5, 1, 2);

      expect(localStorage.getItem(locationKey(5, 2))).toBe('9');
      expect(localStorage.getItem(locationKey(5, 1))).toBe('2');
    });

    it('is a no-op when the user id is null', () => {
      service.setLastLocationId(null, 1, 2);

      expect(localStorage.getItem(locationKey(5, 1))).toBeNull();
      expect(localStorage.getItem(legacyLocationKey(5))).toBeNull();
    });
  });

  // ── provider preferences ──────────────────────────────────────────────

  describe('provider preferences', () => {
    it('returns null when nothing is stored for the user/tenant', () => {
      expect(service.getLastProviderId(5, 1)).toBeNull();
    });

    it('stores and reads the provider id under the tenant-scoped key', () => {
      service.setLastProviderId(5, 1, 3);

      expect(localStorage.getItem(providerKey(5, 1))).toBe('3');
      expect(service.getLastProviderId(5, 1)).toBe(3);
    });

    it('is scoped per tenant', () => {
      service.setLastProviderId(5, 1, 3);

      expect(service.getLastProviderId(5, 2)).toBeNull();
    });

    it('removes the key when providerId is null (clear → all providers)', () => {
      service.setLastProviderId(5, 1, 3);

      service.setLastProviderId(5, 1, null);

      expect(localStorage.getItem(providerKey(5, 1))).toBeNull();
      expect(service.getLastProviderId(5, 1)).toBeNull();
    });

    it('is a no-op when the user id is null', () => {
      service.setLastProviderId(null, 1, 3);

      expect(localStorage.getItem(providerKey(5, 1))).toBeNull();
    });
  });

  // ── clearForUser ──────────────────────────────────────────────────────

  describe('clearForUser', () => {
    it('removes every tenant-scoped key of the user (location + provider)', () => {
      localStorage.setItem(locationKey(5, 1), '2');
      localStorage.setItem(locationKey(5, 2), '7');
      localStorage.setItem(providerKey(5, 1), '3');

      service.clearForUser(5);

      expect(localStorage.getItem(locationKey(5, 1))).toBeNull();
      expect(localStorage.getItem(locationKey(5, 2))).toBeNull();
      expect(localStorage.getItem(providerKey(5, 1))).toBeNull();
    });

    it('removes the legacy user-only location key', () => {
      localStorage.setItem(legacyLocationKey(5), '2');

      service.clearForUser(5);

      expect(localStorage.getItem(legacyLocationKey(5))).toBeNull();
    });

    it('leaves other users keys untouched', () => {
      localStorage.setItem(locationKey(5, 1), '2');
      localStorage.setItem(locationKey(9, 1), '4');
      localStorage.setItem(legacyLocationKey(9), '4');

      service.clearForUser(5);

      expect(localStorage.getItem(locationKey(9, 1))).toBe('4');
      expect(localStorage.getItem(legacyLocationKey(9))).toBe('4');
    });

    it('does not remove a different user whose id shares the same prefix digits', () => {
      localStorage.setItem(locationKey(50, 1), '2');

      service.clearForUser(5);

      expect(localStorage.getItem(locationKey(50, 1))).toBe('2');
    });

    it('is a no-op for a null user id', () => {
      localStorage.setItem(locationKey(5, 1), '2');

      service.clearForUser(null);

      expect(localStorage.getItem(locationKey(5, 1))).toBe('2');
    });
  });
});
