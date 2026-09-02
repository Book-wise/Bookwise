import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { CalendarNavigationService } from './calendar-navigation.service';

describe('CalendarNavigationService', () => {
  let service: CalendarNavigationService;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRouter = { navigate: vi.fn(() => Promise.resolve(true)) };

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(CalendarNavigationService);
  });

  // ── Initial state ──────────────────────────────────────────────

  describe('initial state', () => {
    it('hasPendingNavigation is false when no filters are set', () => {
      expect(service.hasPendingNavigation()).toBe(false);
    });

    it('consumePending returns nulls and an empty status list when nothing is pending', () => {
      const result = service.consumePending();
      expect(result).toEqual({
        locationId: null,
        providerId: null,
        statusIds: [],
        view: null,
        gotoDate: null,
        rangeEnd: null,
      });
    });
  });

  // ── navigateToCalendar ─────────────────────────────────────────

  describe('navigateToCalendar', () => {
    it('sets pending signals when called', () => {
      service.navigateToCalendar(3, 7, [5], mockRouter as unknown as Router);

      const pending = service.consumePending();
      expect(pending.locationId).toBe(3);
      expect(pending.providerId).toBe(7);
      expect(pending.statusIds).toEqual([5]);
      // No view context passed → nulls (default week behaviour preserved)
      expect(pending.view).toBeNull();
      expect(pending.gotoDate).toBeNull();
      expect(pending.rangeEnd).toBeNull();
    });

    it('calls router.navigate with /admin/calendar', () => {
      service.navigateToCalendar(3, 7, [], mockRouter as unknown as Router);

      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin', 'calendar']);
    });

    it('hasPendingNavigation is true after navigateToCalendar', () => {
      expect(service.hasPendingNavigation()).toBe(false);

      service.navigateToCalendar(1, 2, [], mockRouter as unknown as Router);

      expect(service.hasPendingNavigation()).toBe(true);
    });
  });

  // ── status-only navigation (dashboard pending card) ─────────────

  describe('status-only navigation', () => {
    it('is pending when only statusIds are provided (null location/provider)', () => {
      service.navigateToCalendar(null, null, [5], mockRouter as unknown as Router);

      expect(service.hasPendingNavigation()).toBe(true);
      const pending = service.consumePending();
      expect(pending.locationId).toBeNull();
      expect(pending.providerId).toBeNull();
      expect(pending.statusIds).toEqual([5]);
    });

    it('hasPendingNavigation is true when statusIds are non-empty even with no location/provider', () => {
      service.navigateToCalendar(null, null, [5], mockRouter as unknown as Router);
      expect(service.hasPendingNavigation()).toBe(true);
    });

    it('hasPendingNavigation is false when statusIds are empty', () => {
      service.navigateToCalendar(null, null, [], mockRouter as unknown as Router);
      expect(service.hasPendingNavigation()).toBe(false);
    });
  });

  // ── view-context navigation (dashboard pending card) ────────────

  describe('view-context navigation', () => {
    it('carries a view + gotoDate context for a status-only navigation', () => {
      service.navigateToCalendar(null, null, [5], mockRouter as unknown as Router, {
        view: 'dayGridMonth',
        gotoDate: '2026-09-01',
      });

      expect(service.hasPendingNavigation()).toBe(true);
      const pending = service.consumePending();
      expect(pending.locationId).toBeNull();
      expect(pending.providerId).toBeNull();
      expect(pending.statusIds).toEqual([5]);
      expect(pending.view).toBe('dayGridMonth');
      expect(pending.gotoDate).toBe('2026-09-01');
      expect(pending.rangeEnd).toBeNull();
    });

    it('carries a week view with a range end for custom/libre ranges', () => {
      service.navigateToCalendar(null, null, [5], mockRouter as unknown as Router, {
        view: 'timeGridWeek',
        gotoDate: '2026-08-15',
        rangeEnd: '2026-09-30',
      });

      const pending = service.consumePending();
      expect(pending.view).toBe('timeGridWeek');
      expect(pending.gotoDate).toBe('2026-08-15');
      expect(pending.rangeEnd).toBe('2026-09-30');
    });

    it('is pending when a view context is set even without statusIds', () => {
      service.navigateToCalendar(null, null, [], mockRouter as unknown as Router, {
        view: 'dayGridMonth',
        gotoDate: '2026-09-01',
      });

      expect(service.hasPendingNavigation()).toBe(true);
      const pending = service.consumePending();
      expect(pending.view).toBe('dayGridMonth');
      expect(service.hasPendingNavigation()).toBe(false);
    });

    it('clears the view context when navigation rejects', async () => {
      const nav = Promise.reject(new Error('lazy chunk failed'));
      nav.catch(() => {});
      const rejectedRouter = { navigate: vi.fn(() => nav) };

      service.navigateToCalendar(null, null, [5], rejectedRouter as unknown as Router, {
        view: 'dayGridMonth',
        gotoDate: '2026-09-01',
      });
      await new Promise((r) => setTimeout(r, 0));

      expect(service.hasPendingNavigation()).toBe(false);
      expect(service.consumePending()).toEqual({
        locationId: null,
        providerId: null,
        statusIds: [],
        view: null,
        gotoDate: null,
        rangeEnd: null,
      });
    });
  });

  // ── navigation rejection ───────────────────────────────────────

  describe('navigateToCalendar with a rejected navigation', () => {
    it('clears all pending signals when router.navigate rejects', async () => {
      // Same promise observed from both sides: the test handles the rejection
      // (avoiding unhandled-rejection noise) and the service must also react.
      const nav = Promise.reject(new Error('lazy chunk failed'));
      nav.catch(() => {});
      const rejectedRouter = { navigate: vi.fn(() => nav) };

      service.navigateToCalendar(3, 7, [5], rejectedRouter as unknown as Router);
      await new Promise((r) => setTimeout(r, 0));

      expect(service.hasPendingNavigation()).toBe(false);
      expect(service.consumePending()).toEqual({
        locationId: null,
        providerId: null,
        statusIds: [],
        view: null,
        gotoDate: null,
        rangeEnd: null,
      });
    });

    it('keeps pending signals set when navigation resolves', async () => {
      await service.navigateToCalendar(3, 7, [5], mockRouter as unknown as Router);

      expect(service.hasPendingNavigation()).toBe(true);
      expect(service.consumePending()).toEqual({
        locationId: 3,
        providerId: 7,
        statusIds: [5],
        view: null,
        gotoDate: null,
        rangeEnd: null,
      });
    });
  });

  // ── consumePending ─────────────────────────────────────────────

  describe('consumePending', () => {
    it('returns the pending values and clears them', () => {
      service.navigateToCalendar(5, 10, [4, 6], mockRouter as unknown as Router);

      const first = service.consumePending();
      expect(first).toEqual({
        locationId: 5,
        providerId: 10,
        statusIds: [4, 6],
        view: null,
        gotoDate: null,
        rangeEnd: null,
      });

      const second = service.consumePending();
      expect(second).toEqual({
        locationId: null,
        providerId: null,
        statusIds: [],
        view: null,
        gotoDate: null,
        rangeEnd: null,
      });
    });

    it('resets hasPendingNavigation after consumption', () => {
      service.navigateToCalendar(5, 10, [5], mockRouter as unknown as Router);
      expect(service.hasPendingNavigation()).toBe(true);

      service.consumePending();
      expect(service.hasPendingNavigation()).toBe(false);
    });

    it('is idempotent when called multiple times with no new navigation', () => {
      const first = service.consumePending();
      const second = service.consumePending();
      expect(first).toEqual({
        locationId: null,
        providerId: null,
        statusIds: [],
        view: null,
        gotoDate: null,
        rangeEnd: null,
      });
      expect(second).toEqual({
        locationId: null,
        providerId: null,
        statusIds: [],
        view: null,
        gotoDate: null,
        rangeEnd: null,
      });
    });
  });
});
