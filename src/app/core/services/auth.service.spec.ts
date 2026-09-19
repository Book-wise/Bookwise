import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthApiService } from './api/auth-api.service';
import { CalendarPrefsService } from './calendar-prefs.service';
import type { AuthMeData, AuthSwitchResponse, Business } from '@models';

const business: Business = {
  id: 1,
  name: 'Kinesilk Centro',
  rut: '11111111-1',
  email: 'negocio@test.com',
  address: 'Av. Providencia 123',
  phone: '+56912345678',
  plan: 'starter',
};

const me: AuthMeData = {
  id: 7,
  name: 'Admin',
  email: 'admin@test.com',
  phone: '+56912345678',
  role: 'admin',
  tenant_id: 1,
  email_verified_at: '2026-09-01T16:00:00Z',
  onboarding_complete: true,
  business: null,
};

describe('AuthService', () => {
  let authApi: { getMe: ReturnType<typeof vi.fn>; switchTenant: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let calendarPrefs: CalendarPrefsService;
  let service: AuthService;

  beforeEach(() => {
    authApi = { getMe: vi.fn(), switchTenant: vi.fn() };
    router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthApiService, useValue: authApi },
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(AuthService);
    calendarPrefs = TestBed.inject(CalendarPrefsService);
  });

  describe('loadMe', () => {
    it('fetches /auth/me and caches it on the first call', () => {
      authApi.getMe.mockReturnValue(of(me));

      let result: AuthMeData | undefined;
      service.loadMe().subscribe((r) => (result = r));

      expect(result).toEqual(me);
      expect(service.me()).toEqual(me);
      expect(service.meLoaded()).toBe(true);
      expect(authApi.getMe).toHaveBeenCalledTimes(1);
    });

    it('does not refetch when the cache is already loaded', () => {
      authApi.getMe.mockReturnValue(of(me));

      service.loadMe().subscribe();
      service.loadMe().subscribe();

      expect(authApi.getMe).toHaveBeenCalledTimes(1);
    });

    it('force=true refetches even when the cache is loaded', () => {
      authApi.getMe.mockReturnValue(of(me));

      service.loadMe().subscribe();
      authApi.getMe.mockClear();
      service.loadMe(true).subscribe();

      expect(authApi.getMe).toHaveBeenCalledTimes(1);
    });
  });

  describe('needsOnboarding', () => {
    it('is true when /auth/me is not loaded yet', () => {
      expect(service.needsOnboarding()).toBe(true);
    });

    it('is true when there is no business (tenant pending without name)', () => {
      service.setMe(me); // onboarding_complete=true, pero business null
      expect(service.needsOnboarding()).toBe(true);
    });

    it('is true when the business name is blank', () => {
      service.setMe({ ...me, business: { ...business, name: '   ' } });
      expect(service.needsOnboarding()).toBe(true);
    });

    it('is false when the active business has a name', () => {
      service.setMe({ ...me, business });
      expect(service.needsOnboarding()).toBe(false);
    });
  });

  describe('setMe', () => {
    it('updates the cached me payload', () => {
      const updated: AuthMeData = { ...me, onboarding_complete: false };
      service.setMe(updated);

      expect(service.me()).toEqual(updated);
      expect(service.meLoaded()).toBe(true);
    });
  });

  describe('login stays synchronous', () => {
    it('sets the token/user and navigates by role synchronously', () => {
      service.login('tok', { id: 7, email: 'admin@test.com', name: 'Admin', role: 'admin' });

      expect(service.token()).toBe('tok');
      expect(service.user()?.role).toBe('admin');
      expect(router.navigate).toHaveBeenCalledWith(['/admin']);
    });
  });

  describe('switchTenant', () => {
    const switchedMe: AuthMeData = {
      ...me,
      name: 'Tenant B Admin',
      tenant_id: 2,
      provider_id: 3,
    };

    it('adopts the ROTATED token, refreshes identity and stores abilities without navigating', () => {
      const response: AuthSwitchResponse = {
        token: 'rotated-token',
        user: switchedMe,
        abilities: ['bookings.view', 'agenda.manage'],
      };
      authApi.switchTenant.mockReturnValue(of(response));

      let result: AuthSwitchResponse | undefined;
      service.switchTenant(2).subscribe((r) => (result = r));

      expect(result).toEqual(response);
      // Rotated token is adopted in memory AND persisted (old one is revoked).
      expect(service.token()).toBe('rotated-token');
      expect(localStorage.getItem('auth_token')).toBe('rotated-token');
      expect(service.me()).toEqual(switchedMe);
      expect(service.meLoaded()).toBe(true);
      expect(service.user()?.name).toBe('Tenant B Admin');
      expect(service.user()?.tenant_id).toBe(2);
      expect(service.user()?.provider_id).toBe(3);
      // Abilities come top-level from the switch response.
      expect(service.abilities()).toEqual(['bookings.view', 'agenda.manage']);
      expect(service.hasAbility('agenda.manage')).toBe(true);
      expect(service.hasAbility('bookings.delete')).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('maps null provider_id to null on the persisted user', () => {
      authApi.switchTenant.mockReturnValue(
        of<AuthSwitchResponse>({ token: 'tok', user: { ...me, provider_id: null }, abilities: [] }),
      );

      service.switchTenant(1).subscribe();

      expect(service.user()?.provider_id).toBeNull();
    });

    it('defaults abilities to an empty list when the payload omits them', () => {
      authApi.switchTenant.mockReturnValue(
        of({ token: 'tok', user: me, abilities: undefined as unknown as string[] }),
      );

      service.switchTenant(1).subscribe();

      expect(service.abilities()).toEqual([]);
      expect(service.hasAbility('bookings.view')).toBe(false);
    });
  });

  describe('persisted token accessor', () => {
    it('getStoredToken reads the token persisted in localStorage', () => {
      localStorage.setItem('auth_token', 'persisted-token');
      expect(service.getStoredToken()).toBe('persisted-token');
    });

    it('syncTokenFromStorage re-syncs the in-memory token from localStorage', () => {
      service.setToken('old-token');
      localStorage.setItem('auth_token', 'rotated-token');

      service.syncTokenFromStorage();

      expect(service.getToken()).toBe('rotated-token');
      expect(service.token()).toBe('rotated-token');
      expect(localStorage.getItem('auth_token')).toBe('rotated-token');
    });
  });

  describe('logout', () => {
    it('clears auth state and the tenant-scoped + legacy preference keys', () => {
      service.login('tok', { id: 7, email: 'admin@test.com', name: 'Admin', role: 'admin' });
      localStorage.setItem('bw:lastLocationId:7', '2');
      localStorage.setItem('bw:lastLocationId:7:1', '2');
      localStorage.setItem('bw:lastProviderId:7:1', '3');
      expect(service.user()?.id).toBe(7);

      service.logout();

      expect(service.token()).toBeNull();
      expect(service.user()).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('auth_user')).toBeNull();
      expect(localStorage.getItem('bw:lastLocationId:7')).toBeNull();
      expect(localStorage.getItem('bw:lastLocationId:7:1')).toBeNull();
      expect(localStorage.getItem('bw:lastProviderId:7:1')).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('delegates preference cleanup to CalendarPrefsService.clearForUser', () => {
      const clearSpy = vi.spyOn(calendarPrefs, 'clearForUser');
      service.login('tok', { id: 7, email: 'admin@test.com', name: 'Admin', role: 'admin' });

      service.logout();

      expect(clearSpy).toHaveBeenCalledWith(7);
    });

    it('leaves other users\u2019 preference keys untouched when logging out an anonymous session', () => {
      // Ensure an anonymous state (no user on the service) before asserting that
      // logout does not touch other users' preference keys.
      service.logout();
      localStorage.setItem('bw:lastLocationId:9', '2');

      service.logout();

      expect(localStorage.getItem('bw:lastLocationId:9')).toBe('2');
    });
  });
});
