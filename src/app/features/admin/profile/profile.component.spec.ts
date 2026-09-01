import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProfileComponent } from './profile.component';
import { AuthService } from '@services/auth.service';
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
  let fixture: ReturnType<typeof TestBed.createComponent<ProfileComponent>>;

  beforeEach(async () => {
    auth = {
      me: signal(makeMe(business) as AuthMeData | null),
      meLoaded: signal(true),
      loadMe: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
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
  });
});
