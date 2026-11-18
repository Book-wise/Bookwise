import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TenantSwitchService } from './tenant-switch.service';
import { AuthService } from './auth.service';
import { CalendarPrefsService } from './calendar-prefs.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { BookingStore } from '@core/stores/booking.store';
import type { AuthMeData, Location, Provider, User } from '@models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 7, email: 'admin@test.com', name: 'Admin', role: 'admin', ...overrides };
}

function makeLocation(overrides: Partial<Location> = {}): Location {
  return { id: 1, name: 'Sala 1', active: true, ...overrides } as Location;
}

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return { id: 1, first_name: 'Dr.', last_name: 'Uno', active: true, ...overrides } as Provider;
}

const switchedMe: AuthMeData = {
  id: 7,
  name: 'Tenant B Admin',
  email: 'admin@test.com',
  role: 'admin',
  tenant_id: 2,
  email_verified_at: null,
  onboarding_complete: true,
  business: null,
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('TenantSwitchService', () => {
  let authMock: {
    switchTenant: ReturnType<typeof vi.fn>;
    user: WritableSignal<User | null>;
  };
  let prefsMock: {
    getLastLocationId: ReturnType<typeof vi.fn>;
    setLastLocationId: ReturnType<typeof vi.fn>;
    getLastProviderId: ReturnType<typeof vi.fn>;
    setLastProviderId: ReturnType<typeof vi.fn>;
    clearForUser: ReturnType<typeof vi.fn>;
  };
  let refMock: {
    reloadAll: ReturnType<typeof vi.fn>;
    locations: WritableSignal<Location[]>;
    providers: WritableSignal<Provider[]>;
  };
  let bookingMock: { resetTenantState: ReturnType<typeof vi.fn> };
  let referenceStoreConstructions: number;
  let service: TenantSwitchService;

  beforeEach(() => {
    authMock = { switchTenant: vi.fn(), user: signal<User | null>(makeUser()) };
    prefsMock = {
      getLastLocationId: vi.fn().mockReturnValue(null),
      setLastLocationId: vi.fn(),
      getLastProviderId: vi.fn().mockReturnValue(null),
      setLastProviderId: vi.fn(),
      clearForUser: vi.fn(),
    };
    refMock = {
      reloadAll: vi.fn().mockReturnValue(of(undefined)),
      locations: signal<Location[]>([]),
      providers: signal<Provider[]>([]),
    };
    bookingMock = { resetTenantState: vi.fn() };
    referenceStoreConstructions = 0;

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: authMock },
        { provide: CalendarPrefsService, useValue: prefsMock },
        { provide: BookingStore, useValue: bookingMock },
        {
          // Lazy factory: counts how many times the store is actually resolved.
          provide: ReferenceStore,
          useFactory: () => {
            referenceStoreConstructions++;
            return refMock;
          },
        },
      ],
    });
    service = TestBed.inject(TenantSwitchService);
  });

  // ── API surface ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('exposes lastSwitch as null before the first switch', () => {
      expect(service.lastSwitch()).toBeNull();
    });
  });

  // ── Lazy ReferenceStore resolution (D2) ────────────────────────────────

  describe('lazy reference store resolution', () => {
    it('does not construct the reference store when the coordinator is created', () => {
      // Injecting the coordinator already happened in beforeEach.
      expect(referenceStoreConstructions).toBe(0);
    });

    it('resolves the reference store only inside switchTenant()', () => {
      authMock.switchTenant.mockReturnValue(of(switchedMe));

      service.switchTenant(2).subscribe();

      expect(referenceStoreConstructions).toBe(1);
      expect(refMock.reloadAll).toHaveBeenCalledTimes(1);
    });
  });

  // ── Ordering (R2) ──────────────────────────────────────────────────────

  describe('ordered orchestration', () => {
    it('awaits the auth switch before reloading, then resolves and resets after the reload', () => {
      const auth$ = new Subject<AuthMeData>();
      const reload$ = new Subject<void>();
      authMock.switchTenant.mockReturnValue(auth$.asObservable());
      refMock.reloadAll.mockReturnValue(reload$.asObservable());

      service.switchTenant(2).subscribe();

      // Step 1 in flight: nothing else has run yet.
      expect(authMock.switchTenant).toHaveBeenCalledWith(2);
      expect(refMock.reloadAll).not.toHaveBeenCalled();
      expect(bookingMock.resetTenantState).not.toHaveBeenCalled();

      // Step 1 resolves → step 2 (single reload) starts.
      auth$.next(switchedMe);
      auth$.complete();
      expect(refMock.reloadAll).toHaveBeenCalledTimes(1);
      // Steps 3–4 wait for the reload to complete.
      expect(bookingMock.resetTenantState).not.toHaveBeenCalled();
      expect(service.lastSwitch()).toBeNull();

      // Step 2 resolves → steps 3–4 run.
      reload$.next();
      reload$.complete();
      expect(bookingMock.resetTenantState).toHaveBeenCalledTimes(1);
      expect(service.lastSwitch()).not.toBeNull();
    });

    it('runs exactly one full reload per switch', () => {
      authMock.switchTenant.mockReturnValue(of(switchedMe));

      service.switchTenant(2).subscribe();

      expect(refMock.reloadAll).toHaveBeenCalledTimes(1);
    });

    it('publishes the switch result with the userId and target tenantId', () => {
      authMock.switchTenant.mockReturnValue(of(switchedMe));
      refMock.locations.set([makeLocation({ id: 5, active: true })]);
      prefsMock.getLastProviderId.mockReturnValue(3);

      service.switchTenant(2).subscribe();

      expect(service.lastSwitch()).toEqual({
        userId: 7,
        tenantId: 2,
        locationId: 5,
        providerId: 3,
      });
    });
  });

  // ── Auth error propagation (R2) ────────────────────────────────────────

  describe('auth error', () => {
    it('propagates the error without reloading, resolving or resetting', () => {
      const error = new HttpErrorResponse({ status: 401 });
      authMock.switchTenant.mockReturnValue(throwError(() => error));

      let received: unknown = null;
      service.switchTenant(2).subscribe({ error: (e) => (received = e) });

      expect(received).toBe(error);
      expect(refMock.reloadAll).not.toHaveBeenCalled();
      expect(prefsMock.getLastLocationId).not.toHaveBeenCalled();
      expect(prefsMock.getLastProviderId).not.toHaveBeenCalled();
      expect(bookingMock.resetTenantState).not.toHaveBeenCalled();
      expect(service.lastSwitch()).toBeNull();
    });
  });

  // ── Location resolution (R4) ───────────────────────────────────────────

  describe('location resolution', () => {
    beforeEach(() => {
      authMock.switchTenant.mockReturnValue(of(switchedMe));
    });

    it('restores the remembered location when it still exists and is active', () => {
      prefsMock.getLastLocationId.mockReturnValue(5);
      refMock.locations.set([
        makeLocation({ id: 5, active: true }),
        makeLocation({ id: 9, active: true }),
      ]);

      service.switchTenant(2).subscribe();

      expect(prefsMock.getLastLocationId).toHaveBeenCalledWith(7, 2);
      expect(service.lastSwitch()?.locationId).toBe(5);
    });

    it('falls back to the first ACTIVE location when the remembered one is inactive', () => {
      prefsMock.getLastLocationId.mockReturnValue(5);
      refMock.locations.set([
        makeLocation({ id: 5, active: false }),
        makeLocation({ id: 9, active: true }),
      ]);

      service.switchTenant(2).subscribe();

      expect(service.lastSwitch()?.locationId).toBe(9);
    });

    it('falls back to the first ACTIVE location when the remembered one no longer exists', () => {
      prefsMock.getLastLocationId.mockReturnValue(404);
      refMock.locations.set([
        makeLocation({ id: 4, active: false }),
        makeLocation({ id: 9, active: true }),
      ]);

      service.switchTenant(2).subscribe();

      expect(service.lastSwitch()?.locationId).toBe(9);
    });

    it('defaults to the first ACTIVE location when there is no memory', () => {
      prefsMock.getLastLocationId.mockReturnValue(null);
      refMock.locations.set([
        makeLocation({ id: 4, active: false }),
        makeLocation({ id: 9, active: true }),
      ]);

      service.switchTenant(2).subscribe();

      expect(service.lastSwitch()?.locationId).toBe(9);
    });

    it('resolves null when the tenant has no active location', () => {
      prefsMock.getLastLocationId.mockReturnValue(null);
      refMock.locations.set([makeLocation({ id: 4, active: false })]);

      service.switchTenant(2).subscribe();

      expect(service.lastSwitch()?.locationId).toBeNull();
    });
  });

  // ── Provider resolution (R4) ───────────────────────────────────────────

  describe('provider resolution', () => {
    beforeEach(() => {
      authMock.switchTenant.mockReturnValue(of(switchedMe));
    });

    it('restores the remembered provider for the tenant', () => {
      prefsMock.getLastProviderId.mockReturnValue(3);

      service.switchTenant(2).subscribe();

      expect(prefsMock.getLastProviderId).toHaveBeenCalledWith(7, 2);
      expect(service.lastSwitch()?.providerId).toBe(3);
    });

    it('defaults to null (all providers), never the first available, without memory', () => {
      prefsMock.getLastProviderId.mockReturnValue(null);
      // Providers exist in the store, but the coordinator must not pick one.
      refMock.providers.set([makeProvider({ id: 1 }), makeProvider({ id: 2 })]);

      service.switchTenant(2).subscribe();

      expect(service.lastSwitch()?.providerId).toBeNull();
    });
  });
});
