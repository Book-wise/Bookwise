import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthApiService } from '@services/api/auth-api.service';
import { AuthService } from '@services/auth.service';

/**
 * Render-level tests for the login entry hierarchy taken from the artboard
 * `design/login/01-split-brand.html`. The identity providers and the
 * passwordless entry are rendered **disabled on purpose**: their endpoints
 * (`POST /auth/magic-link` and the OAuth callbacks) do not exist in the API
 * yet, and a button that fails is worse than one that says it is coming. These
 * tests pin that: if someone wires the endpoints they must also flip the
 * controls, and if someone removes the guard the note must go with it.
 *
 * The email/password path is untouched by the redesign, so it keeps its own
 * guard here: submitting still calls POST /auth/login with the typed values.
 */
describe('LoginComponent', () => {
  let authApi: { login: ReturnType<typeof vi.fn> };

  const authResponse = {
    token: 'tok_123',
    user: { id: 1, first_name: 'Ana', last_name: 'Pérez', email: 'ana@test.com', role: 'admin' },
    abilities: [],
    permissions: [],
  };

  const mount = async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthApiService, useValue: authApi },
        { provide: AuthService, useValue: { login: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    authApi = { login: vi.fn(() => of(authResponse)) };
  });

  describe('pending entry paths', () => {
    it('renders the three identity providers disabled with the pending note', async () => {
      const fixture = await mount();
      const el = fixture.nativeElement as HTMLElement;

      const providers = Array.from(el.querySelectorAll<HTMLButtonElement>('.providers button'));
      expect(providers.length).toBe(3);
      expect(providers.every((b) => b.disabled)).toBe(true);

      const note = el.querySelector('#login-providers-pending');
      expect(note?.textContent).toContain('próximamente');
    });

    it('keeps each provider button perceivable when it renders icon-only', async () => {
      const fixture = await mount();
      const el = fixture.nativeElement as HTMLElement;

      const providers = Array.from(el.querySelectorAll<HTMLButtonElement>('.providers button'));

      // Sin texto visible, la etiqueta accesible es lo único que queda: si alguien
      // vuelve a los botones con texto, este test lo deja pasar, pero si los deja
      // icon-only sin `aria-label` falla.
      expect(providers.map((b) => b.getAttribute('aria-label'))).toEqual([
        'Continuar con Google',
        'Continuar con Apple',
        'Continuar con Facebook',
      ]);
      expect(providers.every((b) => b.textContent?.trim() === '')).toBe(true);
    });

    it('renders the passwordless entry disabled with its own pending note', async () => {
      const fixture = await mount();
      const el = fixture.nativeElement as HTMLElement;

      const magic = el.querySelector<HTMLButtonElement>('.magic-link');
      expect(magic).toBeTruthy();
      expect(magic!.disabled).toBe(true);

      const note = el.querySelector('#login-magic-pending');
      expect(note?.textContent).toContain('sin contraseña');
    });
  });

  describe('email + password path (unchanged)', () => {
    it('still posts the typed credentials to /auth/login', async () => {
      const fixture = await mount();
      const component = fixture.componentInstance;

      component.credentials = { email: 'ana@test.com', password: 'secreto' };
      component.onLogin();

      expect(authApi.login).toHaveBeenCalledTimes(1);
      expect(authApi.login).toHaveBeenCalledWith({ email: 'ana@test.com', password: 'secreto' });
    });
  });
});
