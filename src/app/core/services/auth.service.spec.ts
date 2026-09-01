import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthApiService } from './api/auth-api.service';
import type { AuthMeData } from '@models';

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
  let authApi: { getMe: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    authApi = { getMe: vi.fn() };
    router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthApiService, useValue: authApi },
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(AuthService);
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
});
