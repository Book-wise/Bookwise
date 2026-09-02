import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthApiService } from '@services/api/auth-api.service';

describe('ForgotPasswordComponent', () => {
  let authApi: { forgotPassword: ReturnType<typeof vi.fn> };

  async function createComponent() {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthApiService, useValue: authApi },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: vi.fn(() => null) } } },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();
    return TestBed.createComponent(ForgotPasswordComponent);
  }

  it('submits the typed email and shows the sent state with that email', async () => {
    authApi = { forgotPassword: vi.fn(() => of({ message: 'ok' })) };
    const fixture = await createComponent();
    fixture.detectChanges();

    fixture.componentInstance.email = 'user@example.com';
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(authApi.forgotPassword).toHaveBeenCalledWith('user@example.com');
    expect(fixture.componentInstance.state()).toBe('sent');
    expect(fixture.componentInstance.sentEmail()).toBe('user@example.com');
    expect(fixture.nativeElement.textContent).toContain('user@example.com');
  });

  it('maps a 422 errors.email into a field error under the input', async () => {
    authApi = {
      forgotPassword: vi.fn(() =>
        throwError(() =>
          new HttpErrorResponse({
            status: 422,
            error: {
              message: 'The given data was invalid.',
              errors: { email: ['The email field must be a valid email address.'] },
            },
          }),
        ),
      ),
    };
    const fixture = await createComponent();
    fixture.detectChanges();

    fixture.componentInstance.email = 'not-an-email';
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(authApi.forgotPassword).toHaveBeenCalledWith('not-an-email');
    expect(fixture.componentInstance.state()).toBe('form');
    expect(fixture.componentInstance.fieldError()).toBe('El email debe ser un email válido.');
    expect(fixture.nativeElement.textContent).toContain('El email debe ser un email válido.');
  });

  it('falls back to the generic error message for an unexpected failure', async () => {
    authApi = { forgotPassword: vi.fn(() => throwError(() => new Error('network down'))) };
    const fixture = await createComponent();
    fixture.detectChanges();

    fixture.componentInstance.email = 'user@example.com';
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('form');
    expect(fixture.componentInstance.error()).toBe('No se pudo enviar el enlace. Inténtalo de nuevo.');
  });

  it('does not call the API when the email is empty', async () => {
    authApi = { forgotPassword: vi.fn() };
    const fixture = await createComponent();
    fixture.detectChanges();

    fixture.componentInstance.email = '   ';
    fixture.componentInstance.onSubmit();

    expect(authApi.forgotPassword).not.toHaveBeenCalled();
    expect(fixture.componentInstance.state()).toBe('form');
  });
});
