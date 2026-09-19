import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { BusinessesListComponent } from './businesses-list.component';
import { AuthService } from '@services/auth.service';
import { TenantSwitchService } from '@services/tenant-switch.service';
import type { AuthMeData, Business, User } from '@models';

const business: Business = {
  id: 1,
  name: 'Kinesilk Centro',
  rut: '11111111-1',
  email: 'negocio@test.com',
  address: 'Av. Providencia 123',
  phone: '+56912345678',
  plan: 'starter',
};
const otherBusiness: Business = { ...business, id: 2, name: 'Kinesilk Norte' };

function makeMe(): AuthMeData {
  return {
    id: 7,
    name: 'Admin',
    email: 'admin@test.com',
    phone: '+56912345678',
    role: 'admin',
    tenant_id: 1,
    email_verified_at: '2026-09-01T16:00:00Z',
    onboarding_complete: true,
    business,
    businesses: [business, otherBusiness],
    is_admin_general: true,
  } as AuthMeData;
}

function makeUser(): User {
  return { id: 7, email: 'admin@test.com', name: 'Admin', role: 'admin' };
}

/**
 * Thin delegation spec: the businesses list no longer reloads the reference
 * store itself — it hands the switch to the coordinator and keeps its toasts.
 */
describe('BusinessesListComponent — tenant switch delegation', () => {
  let tenantSwitch: { switchTenant: ReturnType<typeof vi.fn>; lastSwitch: ReturnType<typeof signal<unknown>> };
  let toast: { add: ReturnType<typeof vi.fn> };
  let component: BusinessesListComponent;

  beforeEach(async () => {
    tenantSwitch = { switchTenant: vi.fn(() => of(void 0)), lastSwitch: signal(null) };
    toast = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BusinessesListComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: AuthService,
          useValue: {
            me: signal(makeMe()),
            user: signal(makeUser()),
            isAdminGeneral: () => true,
          },
        },
        { provide: TenantSwitchService, useValue: tenantSwitch },
        { provide: MessageService, useValue: toast },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    component = TestBed.createComponent(BusinessesListComponent).componentInstance;
  });

  it('delegates to the coordinator and keeps the success toast', () => {
    component.switchTo(otherBusiness);

    expect(tenantSwitch.switchTenant).toHaveBeenCalledWith(2);
    expect(toast.add).toHaveBeenCalledTimes(1);
    const config = toast.add.mock.calls[0][0] as {
      key: string;
      severity: string;
      detail: string;
    };
    expect(config.key).toBe('global');
    expect(config.severity).toBe('success');
    expect(config.detail).toBe('Kinesilk Norte');
  });

  it('maps a switch error to the tenant error key with a global error toast', () => {
    tenantSwitch.switchTenant.mockReturnValue(throwError(() => ({ status: 403 })));

    component.switchTo(otherBusiness);

    const config = toast.add.mock.calls[0][0] as {
      key: string;
      severity: string;
      detail: string;
    };
    expect(config.key).toBe('global');
    expect(config.severity).toBe('error');
    expect(config.detail).toBe(component.lang.t('auth.switch_tenant_forbidden'));
  });

  it('does not switch when the business is already active', () => {
    component.switchTo(business);

    expect(tenantSwitch.switchTenant).not.toHaveBeenCalled();
  });
});
