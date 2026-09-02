import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '@services/auth.service';
import { AuthApiService } from '@services/api/auth-api.service';
import { MessageService } from 'primeng/api';
import type { AuthMeData, Business } from '@models';

const business: Business = {
  id: 1,
  name: 'Kinesilk Centro',
  rut: '11111111-1',
  email: 'negocio@test.com',
  address: 'Av. Providencia 123',
  phone: '+56912345678',
  plan: 'starter',
};

function makeMe(biz: Business | null): AuthMeData {
  return {
    id: 7,
    name: 'Admin',
    email: 'admin@test.com',
    phone: '+56912345678',
    role: 'admin',
    tenant_id: 1,
    email_verified_at: '2026-09-01T16:00:00Z',
    onboarding_complete: biz !== null,
    business: biz,
  };
}

describe('ProfileComponent', () => {
  let auth: {
    me: ReturnType<typeof signal<AuthMeData | null>>;
    meLoaded: ReturnType<typeof signal<boolean>>;
    loadMe: ReturnType<typeof vi.fn>;
  };
  let api: { changePassword: ReturnType<typeof vi.fn> };
  let toast: { add: ReturnType<typeof vi.fn> };
  let component: ProfileComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<ProfileComponent>>;

  beforeEach(async () => {
    auth = {
      me: signal(makeMe(business) as AuthMeData | null),
      meLoaded: signal(true),
      loadMe: vi.fn(),
    };
    api = { changePassword: vi.fn() };
    toast = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: auth },
        { provide: AuthApiService, useValue: api },
        { provide: MessageService, useValue: toast },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
  });

  it('shows the CTA when business is null', () => {
    auth.me.set(makeMe(null) as AuthMeData | null);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    expect(nativeEl.querySelector('.business-cta')).toBeTruthy();
  });

  it('renders business RUT/email read-only and never issues an update request', () => {
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const inputs = Array.from(nativeEl.querySelectorAll<HTMLInputElement>('input'));

    const rutInput = inputs.find((i) => i.value === '11111111-1');
    const emailInput = inputs.find((i) => i.value === 'negocio@test.com');

    expect(rutInput).toBeTruthy();
    expect(rutInput!.readOnly).toBe(true);
    expect(emailInput).toBeTruthy();
    expect(emailInput!.readOnly).toBe(true);

    // Sin endpoint de actualización invocado (el perfil es de solo lectura).
    expect(auth.loadMe).not.toHaveBeenCalled();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('calls changePassword with the payload and shows success on 200', () => {
    api.changePassword.mockReturnValue(of({ message: 'OK' }));
    fixture.detectChanges();

    component.pwCurrent.set('ClaveActual123');
    component.pwNew.set('ClaveNueva456');
    component.pwConfirm.set('ClaveNueva456');
    component.changePassword();

    expect(api.changePassword).toHaveBeenCalledWith({
      current_password: 'ClaveActual123',
      password: 'ClaveNueva456',
      password_confirmation: 'ClaveNueva456',
    });
    expect(toast.add).toHaveBeenCalled();
    expect(component.pwCurrent()).toBe('');
    expect(component.pwNew()).toBe('');
    expect(component.pwConfirm()).toBe('');
    expect(component.pwError()).toBeNull();
  });

  it('maps a 422 current_password error to the current field', () => {
    api.changePassword.mockReturnValue(
      throwError(() => ({
        status: 422,
        error: { errors: { current_password: ['La contraseña actual no es correcta.'] } },
      })),
    );
    fixture.detectChanges();

    component.pwCurrent.set('Mala');
    component.pwNew.set('ClaveNueva456');
    component.pwConfirm.set('ClaveNueva456');
    component.changePassword();

    expect(component.pwFieldErrors().current).toBeTruthy();
    expect(component.pwFieldErrors().password).toBeUndefined();
    expect(component.pwError()).toBeNull();
  });

  it('blocks submit when password and confirmation do not match', () => {
    fixture.detectChanges();

    component.pwCurrent.set('ClaveActual123');
    component.pwNew.set('ClaveNueva456');
    component.pwConfirm.set('ClaveDistinta789');
    component.changePassword();

    expect(api.changePassword).not.toHaveBeenCalled();
    expect(component.pwFieldErrors().password).toBeTruthy();
  });

  it('blocks submit when the new password is not strong enough', () => {
    fixture.detectChanges();

    component.pwCurrent.set('ClaveActual123');
    component.pwNew.set('debil123'); // no uppercase → not strong
    component.pwConfirm.set('debil123');
    component.changePassword();

    expect(api.changePassword).not.toHaveBeenCalled();
    expect(component.pwFieldErrors().password).toBeTruthy();
    expect(component.pwStrong()).toBe(false);
  });

  it('computes strength checkpoints for the new password', () => {
    fixture.detectChanges();

    component.pwNew.set('ClaveNueva456');
    expect(component.pwStrong()).toBe(true);

    component.pwNew.set('clave');
    expect(component.pwStrong()).toBe(false);
    expect(component.pwStrengthChecks().some((c) => !c.met)).toBe(true);
  });
});
