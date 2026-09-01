import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { VerifyEmailComponent } from './verify-email.component';
import { AuthApiService } from '@services/api/auth-api.service';

describe('VerifyEmailComponent', () => {
  let authApi: { verifyEmail: ReturnType<typeof vi.fn> };
  let route: { snapshot: { queryParamMap: { get: ReturnType<typeof vi.fn> } } };

  async function createComponent(token: string | null) {
    route = { snapshot: { queryParamMap: { get: vi.fn(() => token) } } };
    await TestBed.configureTestingModule({
      imports: [VerifyEmailComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthApiService, useValue: authApi },
        { provide: ActivatedRoute, useValue: route },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();
    return TestBed.createComponent(VerifyEmailComponent);
  }

  it('calls verifyEmail with the token and shows the success state', async () => {
    authApi = {
      verifyEmail: vi.fn(() => of({ data: { email_verified_at: '2026-09-01T16:00:00Z' } })),
    };
    const fixture = await createComponent('tok-123');
    fixture.detectChanges();

    expect(authApi.verifyEmail).toHaveBeenCalledWith('tok-123');
    expect(fixture.componentInstance.state()).toBe('success');
    expect(fixture.componentInstance.emailVerifiedAt()).toBe('2026-09-01T16:00:00Z');
  });

  it('shows the error state for an invalid token and never proceeds to onboarding', async () => {
    authApi = { verifyEmail: vi.fn(() => throwError(() => new Error('bad'))) };
    const fixture = await createComponent('invalid');
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('error');
    expect(authApi.verifyEmail).toHaveBeenCalledWith('invalid');
  });

  it('shows the error state when no token is provided', async () => {
    authApi = { verifyEmail: vi.fn() };
    const fixture = await createComponent(null);
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('error');
    expect(authApi.verifyEmail).not.toHaveBeenCalled();
  });
});
