import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
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

  it('calls verifyEmail with the token and shows the success state (raw { message, user } body)', async () => {
    authApi = {
      verifyEmail: vi.fn(() =>
        of({ message: 'ok', user: { email_verified_at: '2026-09-01T16:00:00Z' } }),
      ),
    };
    const fixture = await createComponent('tok-123');
    fixture.detectChanges();

    expect(authApi.verifyEmail).toHaveBeenCalledWith('tok-123');
    expect(fixture.componentInstance.state()).toBe('success');
    expect(fixture.componentInstance.emailVerifiedAt()).toBe('2026-09-01T16:00:00Z');
  });

  const errorCodeCases = [
    ['invalid_token', 'auth.verify_email_invalid_token'],
    ['token_expired', 'auth.verify_email_token_expired'],
    ['token_already_used', 'auth.verify_email_token_already_used'],
  ] as const;

  it.each(errorCodeCases)(
    'maps the backend code %s to its own error state and message key',
    async (code, messageKey) => {
      authApi = {
        verifyEmail: vi.fn(() =>
          throwError(() => new HttpErrorResponse({ status: 400, error: { error: code } })),
        ),
      };
      const fixture = await createComponent('tok-123');
      fixture.detectChanges();

      expect(authApi.verifyEmail).toHaveBeenCalledWith('tok-123');
      expect(fixture.componentInstance.state()).toBe(code);
      expect(fixture.componentInstance.errorMessageKey()).toBe(messageKey);
    },
  );

  it('falls back to the generic error state for an unrecognized code', async () => {
    authApi = {
      verifyEmail: vi.fn(() =>
        throwError(() => new HttpErrorResponse({ status: 400, error: { error: 'weird_code' } })),
      ),
    };
    const fixture = await createComponent('tok-123');
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('error');
    expect(fixture.componentInstance.errorMessageKey()).toBe('auth.verify_email_error');
  });

  it('shows the generic error state for an unexpected transport error', async () => {
    authApi = { verifyEmail: vi.fn(() => throwError(() => new Error('bad'))) };
    const fixture = await createComponent('invalid');
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('error');
    expect(fixture.componentInstance.errorMessageKey()).toBe('auth.verify_email_error');
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
