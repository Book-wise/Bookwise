import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CalendarPrefsService } from './calendar-prefs.service';

const keyFor = (userId: number) => `bw:lastLocationId:${userId}`;

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
    it('returns null when nothing is stored for the user', () => {
      expect(service.getLastLocationId(5)).toBeNull();
    });

    it('returns the stored numeric id', () => {
      localStorage.setItem(keyFor(5), '2');

      expect(service.getLastLocationId(5)).toBe(2);
    });

    it('is scoped per user (different users have different keys)', () => {
      localStorage.setItem(keyFor(5), '2');

      expect(service.getLastLocationId(9)).toBeNull();
    });

    it('returns null for a null user id', () => {
      localStorage.setItem(keyFor(5), '2');

      expect(service.getLastLocationId(null)).toBeNull();
    });

    it('returns null when the stored value is not a number', () => {
      localStorage.setItem(keyFor(5), 'not-a-number');

      expect(service.getLastLocationId(5)).toBeNull();
    });
  });

  // ── setLastLocationId ─────────────────────────────────────────────────

  describe('setLastLocationId', () => {
    it('stores the location id under the per-user key', () => {
      service.setLastLocationId(5, 2);

      expect(localStorage.getItem(keyFor(5))).toBe('2');
    });

    it('removes the key when locationId is null', () => {
      localStorage.setItem(keyFor(5), '2');

      service.setLastLocationId(5, null);

      expect(localStorage.getItem(keyFor(5))).toBeNull();
    });

    it('is a no-op when the user id is null', () => {
      service.setLastLocationId(null, 2);

      expect(localStorage.getItem(keyFor(5))).toBeNull();
      expect(localStorage.getItem(keyFor(0))).toBeNull();
    });
  });
});
