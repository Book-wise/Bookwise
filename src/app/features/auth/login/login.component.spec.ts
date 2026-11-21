import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthApiService } from '@services/api/auth-api.service';
import { AuthService } from '@services/auth.service';

/**
 * Render-level tests for the login entry hierarchy taken from the artboard
 * `design/login/01-split-brand.html`: cuatro caminos de entrada — Google, Apple,
 * Facebook y correo — y el formulario de correo **plegado** hasta que se elige
 * ese camino.
 *
 * Los tres proveedores de identidad se renderizan deshabilitados a propósito:
 * los endpoints OAuth no existen todavía en el API y un botón que falla es peor
 * que uno que avisa. El camino del correo sí funciona y despliega el formulario.
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

  const emailEntry = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>('.provider.email') as HTMLButtonElement;

  const emailSlot = (el: HTMLElement) => el.querySelector<HTMLElement>('#email-form') as HTMLElement;

  const providersView = (el: HTMLElement) => el.querySelector<HTMLElement>('.providers');

  beforeEach(() => {
    authApi = { login: vi.fn(() => of(authResponse)) };
  });

  describe('entry paths', () => {
    it('renders four full-width entries with visible text', async () => {
      const fixture = await mount();
      const el = fixture.nativeElement as HTMLElement;

      const providers = Array.from(el.querySelectorAll<HTMLButtonElement>('.providers button'));
      expect(providers.length).toBe(4);
      expect(providers.map((b) => b.textContent?.trim())).toEqual([
        'Continuar con Google',
        'Continuar con Apple',
        'Continuar con Facebook',
        'Continuar con el correo',
      ]);
    });

    it('keeps the three OAuth providers disabled with the pending note', async () => {
      const fixture = await mount();
      const el = fixture.nativeElement as HTMLElement;

      const oauth = Array.from(el.querySelectorAll<HTMLButtonElement>('.providers button')).slice(0, 3);
      expect(oauth.every((b) => b.disabled)).toBe(true);
      expect(el.querySelector('#login-providers-pending')?.textContent).toContain('próximamente');
    });

    it('leaves the email entry enabled because it does not depend on the API', async () => {
      const fixture = await mount();
      expect(emailEntry(fixture.nativeElement as HTMLElement).disabled).toBe(false);
    });
  });

  describe('email form takes over the panel', () => {
    it('starts collapsed, showing the entry paths only', async () => {
      const fixture = await mount();
      const el = fixture.nativeElement as HTMLElement;

      expect(emailSlot(el).hidden).toBe(true);
      expect(providersView(el)).toBeTruthy();
      expect(el.querySelector('.back')).toBeFalsy();
    });

    it('replaces the entry paths with the form when the email entry is chosen', async () => {
      const fixture = await mount();
      const el = fixture.nativeElement as HTMLElement;

      emailEntry(el).click();
      fixture.detectChanges();

      // Los accesos se retiran para que el formulario ocupe ese espacio.
      expect(providersView(el)).toBeFalsy();
      expect(emailSlot(el).hidden).toBe(false);
      expect(el.querySelector('.back')?.textContent).toContain('Volver a los otros accesos');
    });

    it('returns to the entry paths from the back control', async () => {
      const fixture = await mount();
      const el = fixture.nativeElement as HTMLElement;

      emailEntry(el).click();
      fixture.detectChanges();
      (el.querySelector('.back') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(providersView(el)).toBeTruthy();
      expect(emailSlot(el).hidden).toBe(true);
    });

    it('moves the focus to the email field when it opens', async () => {
      const fixture = await mount();
      const el = fixture.nativeElement as HTMLElement;

      emailEntry(el).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(el.querySelector('#email'));
    });
  });

  describe('email + password path (unchanged)', () => {
    it('still posts the typed credentials to /auth/login', async () => {
      const fixture = await mount();
      const component = fixture.componentInstance;

      component.showEmailForm.set(true);
      component.credentials = { email: 'ana@test.com', password: 'secreto' };
      component.onLogin();

      expect(authApi.login).toHaveBeenCalledTimes(1);
      expect(authApi.login).toHaveBeenCalledWith({ email: 'ana@test.com', password: 'secreto' });
    });
  });
});
