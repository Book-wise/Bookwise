import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { onboardingGuard } from './onboarding.guard';
import { AuthService } from '@services/auth.service';
import type { AuthMeData } from '@models';

const meBase: AuthMeData = {
  id: 7,
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
  tenant_id: 1,
  email_verified_at: '2026-09-01T16:00:00Z',
  onboarding_complete: true,
  business: null,
};

describe('onboardingGuard', () => {
  let authService: { loadMe: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = { loadMe: vi.fn() };
    router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  });

  /** Runs the guard inside the injection context and collects the emitted value. */
  function run(): boolean | undefined {
    let emitted: boolean | undefined;
    TestBed.runInInjectionContext(() => {
      const result = onboardingGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Observable<boolean>;
      result.subscribe({ next: (v) => (emitted = v) });
    });
    return emitted;
  }

  it('allows access when onboarding_complete=true', () => {
    authService.loadMe.mockReturnValue(of({ ...meBase, onboarding_complete: true }));

    expect(run()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to /onboarding when onboarding_complete=false', () => {
    authService.loadMe.mockReturnValue(of({ ...meBase, onboarding_complete: false }));

    expect(run()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  it('redirects to /onboarding and never authorizes when loadMe fails', () => {
    authService.loadMe.mockReturnValue(throwError(() => new Error('boom')));

    expect(run()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });
});
