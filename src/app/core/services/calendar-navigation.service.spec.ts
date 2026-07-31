import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { CalendarNavigationService } from './calendar-navigation.service';

describe('CalendarNavigationService', () => {
  let service: CalendarNavigationService;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRouter = { navigate: vi.fn() };

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

    it('consumePending returns nulls when nothing is pending', () => {
      const result = service.consumePending();
      expect(result).toEqual({ locationId: null, providerId: null });
    });
  });

  // ── navigateToCalendar ─────────────────────────────────────────

  describe('navigateToCalendar', () => {
    it('sets pending signals when called', () => {
      service.navigateToCalendar(3, 7, mockRouter as unknown as Router);

      const pending = service.consumePending();
      expect(pending.locationId).toBe(3);
      expect(pending.providerId).toBe(7);
    });

    it('calls router.navigate with /admin/calendar', () => {
      service.navigateToCalendar(3, 7, mockRouter as unknown as Router);

      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin', 'calendar']);
    });

    it('hasPendingNavigation is true after navigateToCalendar', () => {
      expect(service.hasPendingNavigation()).toBe(false);

      service.navigateToCalendar(1, 2, mockRouter as unknown as Router);

      expect(service.hasPendingNavigation()).toBe(true);
    });
  });

  // ── consumePending ─────────────────────────────────────────────

  describe('consumePending', () => {
    it('returns the pending values and clears them', () => {
      service.navigateToCalendar(5, 10, mockRouter as unknown as Router);

      const first = service.consumePending();
      expect(first).toEqual({ locationId: 5, providerId: 10 });

      const second = service.consumePending();
      expect(second).toEqual({ locationId: null, providerId: null });
    });

    it('resets hasPendingNavigation after consumption', () => {
      service.navigateToCalendar(5, 10, mockRouter as unknown as Router);
      expect(service.hasPendingNavigation()).toBe(true);

      service.consumePending();
      expect(service.hasPendingNavigation()).toBe(false);
    });

    it('is idempotent when called multiple times with no new navigation', () => {
      const first = service.consumePending();
      const second = service.consumePending();
      expect(first).toEqual({ locationId: null, providerId: null });
      expect(second).toEqual({ locationId: null, providerId: null });
    });
  });
});
