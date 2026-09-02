import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthApiService } from '@services/api/auth-api.service';

describe('ResetPasswordComponent', () => {
  let authApi: { resetPassword: ReturnType<typeof vi.fn> };
  let route: { snapshot: { queryParamMap: { get: ReturnType<typeof vi.fn> } } };

  async function createComponent(token: string | null) {
    route = { snapshot: { queryParamMap: { get: vi.fn(() => token) } } };
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthApiService, useValue: authApi },
        { provide: ActivatedRoute, useValue: route },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();
    return TestBed.createComponent(ResetPasswordComponent);
  }

  function fillValidPassword(fixture: { componentInstance: ResetPasswordComponent }) {
    fixture.componentInstance.password = 'NewPass1';
    fixture.componentInstance.passwordConfirmation = 'NewPass1';
  }

  it('reads the token from the query params and submits it with the new password', async () => {
    authApi = { resetPassword: vi.fn(() => of({ message: 'ok' })) };
    const fixture = await createComponent('tok-9');
    fixture.detectChanges();

    fillValidPassword(fixture);
    fixture.componentInstance.onSubmit();

    expect(authApi.resetPassword).toHaveBeenCalledWith({
      token: 'tok-9',
      password: 'NewPass1',
      password_confirmation: 'NewPass1',
    });
    expect(fixture.componentInstance.state()).toBe('success');
  });

  const errorCodeCases = [
    ['invalid_token', 'auth.reset.invalid_token'],
    ['token_expired', 'auth.reset.token_expired'],
    ['token_already_used', 'auth.reset.token_already_used'],
  ] as const;

  it.each(errorCodeCases)(
    'maps the backend code %s to its own error state and message key',
    async (code, messageKey) => {
      authApi = {
        resetPassword: vi.fn(() =>
          throwError(() => new HttpErrorResponse({ status: 400, error: { error: code } })),
        ),
      };
      const fixture = await createComponent('tok-9');
      fixture.detectChanges();

      fillValidPassword(fixture);
      fixture.componentInstance.onSubmit();

      expect(authApi.resetPassword).toHaveBeenCalledWith({
        token: 'tok-9',
        password: 'NewPass1',
        password_confirmation: 'NewPass1',
      });
      expect(fixture.componentInstance.state()).toBe(code);
      expect(fixture.componentInstance.errorMessageKey()).toBe(messageKey);
    },
  );

  it('maps a 422 errors.password into a field error under the input', async () => {
    authApi = {
      resetPassword: vi.fn(() =>
        throwError(() =>
          new HttpErrorResponse({
            status: 422,
            error: {
              message: 'The given data was invalid.',
              errors: { password: ['The password field must be at least 8 characters.'] },
            },
          }),
        ),
      ),
    };
    const fixture = await createComponent('tok-9');
    fixture.detectChanges();

    fillValidPassword(fixture);
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('form');
    expect(fixture.componentInstance.passwordError()).toBe('La contraseña debe tener al menos 8 caracteres.');
    expect(fixture.nativeElement.textContent).toContain('La contraseña debe tener al menos 8 caracteres.');
  });

  it('falls back to the generic retryable error for an unexpected failure', async () => {
    authApi = { resetPassword: vi.fn(() => throwError(() => new Error('network down'))) };
    const fixture = await createComponent('tok-9');
    fixture.detectChanges();

    fillValidPassword(fixture);
    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.state()).toBe('form');
    expect(fixture.componentInstance.serverError()).toBe(
      'No se pudo restablecer la contraseña. Inténtalo de nuevo.',
    );
  });

  it('falls back to the generic retryable error for an unrecognized 400 code', async () => {
    authApi = {
      resetPassword: vi.fn(() =>
        throwError(() => new HttpErrorResponse({ status: 400, error: { error: 'weird_code' } })),
      ),
    };
    const fixture = await createComponent('tok-9');
    fixture.detectChanges();

    fillValidPassword(fixture);
    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.state()).toBe('form');
    expect(fixture.componentInstance.serverError()).toBe(
      'No se pudo restablecer la contraseña. Inténtalo de nuevo.',
    );
  });

  it('blocks submit when the password confirmation does not match', async () => {
    authApi = { resetPassword: vi.fn(() => of({ message: 'ok' })) };
    const fixture = await createComponent('tok-9');
    fixture.detectChanges();

    fixture.componentInstance.password = 'NewPass1';
    fixture.componentInstance.passwordConfirmation = 'Different1';
    fixture.componentInstance.onSubmit();

    expect(authApi.resetPassword).not.toHaveBeenCalled();
    expect(fixture.componentInstance.state()).toBe('form');
  });

  it('blocks submit when the new password is shorter than the 8-char minimum', async () => {
    authApi = { resetPassword: vi.fn(() => of({ message: 'ok' })) };
    const fixture = await createComponent('tok-9');
    fixture.detectChanges();

    fixture.componentInstance.password = 'short';
    fixture.componentInstance.passwordConfirmation = 'short';
    fixture.componentInstance.onSubmit();

    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });

  it('shows the no_token error state when the route has no token and never calls the API', async () => {
    authApi = { resetPassword: vi.fn() };
    const fixture = await createComponent(null);
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('no_token');
    expect(fixture.componentInstance.errorMessageKey()).toBe('auth.reset.no_token');
    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });
});
