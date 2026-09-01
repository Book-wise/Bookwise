import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { OnboardingComponent } from './onboarding.component';
import { BusinessesApiService } from '@services/api/businesses-api.service';
import { AuthService } from '@services/auth.service';
import { HttpErrorService } from '@services/http-error.service';
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

function meData(): AuthMeData {
  return {
    id: 7,
    name: 'Admin',
    email: 'admin@test.com',
    phone: '+56912345678',
    role: 'admin',
    tenant_id: 1,
    email_verified_at: '2026-09-01T16:00:00Z',
    onboarding_complete: false,
    business: null,
  };
}

describe('OnboardingComponent', () => {
  let businessesApi: { createBusiness: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let auth: {
    me: ReturnType<typeof signal<AuthMeData | null>>;
    meLoaded: ReturnType<typeof signal<boolean>>;
    setMe: ReturnType<typeof vi.fn>;
    setUser: ReturnType<typeof vi.fn>;
  };
  let fixture: ReturnType<typeof TestBed.createComponent<OnboardingComponent>>;
  let component: OnboardingComponent;

  beforeEach(async () => {
    businessesApi = { createBusiness: vi.fn() };
    router = { navigate: vi.fn() };
    auth = {
      me: signal(meData()),
      meLoaded: signal(true),
      setMe: vi.fn(),
      setUser: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: BusinessesApiService, useValue: businessesApi },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
  });

  it('does not POST when the form is invalid', () => {
    fixture.detectChanges();

    const formEl = fixture.nativeElement.querySelector('form');
    formEl.dispatchEvent(new Event('submit'));

    expect(businessesApi.createBusiness).not.toHaveBeenCalled();
  });

  it('POSTs and navigates to /admin when the form is valid', () => {
    businessesApi.createBusiness.mockReturnValue(
      of({ data: { business }, user: { id: 7, email: 'admin@test.com', name: 'Admin', role: 'admin' } }),
    );

    component.formData = {
      name: 'Kinesilk Centro',
      rut: '11111111-1',
      email: 'negocio@test.com',
      address: 'Av. Providencia 123',
      phone: '+56912345678',
      plan: 'starter',
    };
    fixture.detectChanges();

    const formEl = fixture.nativeElement.querySelector('form');
    formEl.dispatchEvent(new Event('submit'));

    expect(businessesApi.createBusiness).toHaveBeenCalledWith(component.formData);
    expect(auth.setMe).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/admin']);
  });
});
