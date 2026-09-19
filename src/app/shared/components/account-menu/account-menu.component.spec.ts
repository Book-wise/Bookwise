import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Popover } from 'primeng/popover';
import { AccountMenuComponent } from './account-menu.component';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
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
  } as AuthMeData;
}

function makeUser(): User {
  return { id: 7, email: 'admin@test.com', name: 'Admin', role: 'admin' };
}

/**
 * Thin delegation spec: the account menu no longer reloads the reference store
 * itself — it hands the switch to the coordinator and keeps its own toasts.
 */
describe('AccountMenuComponent — tenant switch delegation', () => {
  let tenantSwitch: { switchTenant: ReturnType<typeof vi.fn>; lastSwitch: ReturnType<typeof signal<unknown>> };
  let toast: { add: ReturnType<typeof vi.fn> };
  let component: AccountMenuComponent;

  beforeEach(async () => {
    tenantSwitch = { switchTenant: vi.fn(() => of(void 0)), lastSwitch: signal(null) };
    toast = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AccountMenuComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: AuthService,
          useValue: {
            me: signal(makeMe()),
            user: signal(makeUser()),
            userRole: () => 'admin',
            isAdmin: () => true,
          },
        },
        { provide: TenantSwitchService, useValue: tenantSwitch },
        { provide: MessageService, useValue: toast },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    component = TestBed.createComponent(AccountMenuComponent).componentInstance;
  });

  function popoverMock(): Popover {
    return { hide: vi.fn() } as unknown as Popover;
  }

  it('delegates to the coordinator, keeps the success toast and closes the popover', () => {
    const popover = popoverMock();

    component.switchTo(otherBusiness, popover);

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
    expect(popover.hide).toHaveBeenCalled();
  });

  it('maps a switch error to the tenant error key with a global error toast', () => {
    tenantSwitch.switchTenant.mockReturnValue(throwError(() => ({ status: 403 })));

    component.switchTo(otherBusiness, popoverMock());

    const config = toast.add.mock.calls[0][0] as {
      key: string;
      severity: string;
      detail: string;
    };
    expect(config.key).toBe('global');
    expect(config.severity).toBe('error');
    expect(config.detail).toBe(TestBed.inject(LanguageService).t('auth.switch_tenant_forbidden'));
  });

  it('does not switch when the business is already active', () => {
    component.switchTo(business, popoverMock());

    expect(tenantSwitch.switchTenant).not.toHaveBeenCalled();
    expect(toast.add).not.toHaveBeenCalled();
  });
});
