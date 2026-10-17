import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { BillingComponent } from './billing.component';
import { AuthService } from '@services/auth.service';
import { SubscriptionApiService } from '@services/api/subscription-api.service';
import { HttpErrorService } from '@services/http-error.service';
import type { AuthMeData, Business, UsageData } from '@models';

const business: Business = {
  id: 12,
  name: 'Bookwise',
  rut: '11111111-1',
  email: 'bookwise@test.com',
  address: 'Av. Siempre Viva 123',
  plan: 'premium',
};

function makeMe(): AuthMeData {
  return {
    id: 5,
    name: 'Admin',
    email: 'admin@test.com',
    role: 'admin',
    tenant_id: 12,
    email_verified_at: '2026-09-01T16:00:00Z',
    onboarding_complete: true,
    business,
    businesses: [business],
  } as AuthMeData;
}

const usageData: UsageData = {
  account_id: 5,
  plan: { slug: 'premium', billing_interval: 'month' },
  tenants: { limit: 5, current: 2 },
  users: { limit: 12, current: 4 },
  businesses: [
    {
      tenant_id: 12,
      professionals: { limit: 3, current: 3 },
      locations: { limit: 3, current: 1 },
    },
  ],
  confirmations: {
    email: {
      limit: 2500,
      consumed: 1200,
      remaining: 1300,
      period_start: '2026-10-01T00:00:00+00:00',
      period_end: '2026-10-31T00:00:00+00:00',
      pack_credit: 0,
      by_tenant: [{ tenant_id: 12, name: 'Bookwise', consumed: 640 }],
    },
    whatsapp: {
      limit: 800,
      consumed: 640,
      remaining: 160,
      period_start: '2026-10-01T00:00:00+00:00',
      period_end: '2026-10-31T00:00:00+00:00',
      pack_credit: 100,
      by_tenant: [{ tenant_id: 12, name: 'Bookwise', consumed: 640 }],
    },
  },
};

describe('BillingComponent — plan usage wiring', () => {
  let auth: { me: ReturnType<typeof signal<AuthMeData | null>> };
  let api: { getUsage: ReturnType<typeof vi.fn> };
  let httpError: { handle: ReturnType<typeof vi.fn> };
  let component: BillingComponent;

  beforeEach(async () => {
    auth = { me: signal(makeMe() as AuthMeData | null) };
    api = { getUsage: vi.fn(() => of({ data: usageData })) };
    httpError = { handle: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BillingComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: auth },
        { provide: SubscriptionApiService, useValue: api },
        { provide: HttpErrorService, useValue: httpError },
      ],
    }).compileComponents();

    component = TestBed.createComponent(BillingComponent).componentInstance;
  });

  it('builds the usage metrics from GET /subscription/usage data', () => {
    component.ngOnInit();

    expect(api.getUsage).toHaveBeenCalledTimes(1);
    expect(component.loading()).toBe(false);

    const metrics = component.usageMetrics();
    expect(metrics.map((m) => m.key)).toEqual([
      'tenants',
      'users',
      'professionals',
      'locations',
      'email',
      'whatsapp',
    ]);

    const tenants = metrics[0];
    expect(tenants.used).toBe(2);
    expect(tenants.limit).toBe(5);
    expect(tenants.remaining).toBe(3);

    const users = metrics[1];
    expect(users.used).toBe(4);
    expect(users.limit).toBe(12);

    // professionals/locations = suma de `businesses[]`
    const professionals = metrics[2];
    expect(professionals.used).toBe(3);
    expect(professionals.limit).toBe(3);

    const locations = metrics[3];
    expect(locations.used).toBe(1);
    expect(locations.limit).toBe(3);

    const email = metrics[4];
    expect(email.used).toBe(1200);
    expect(email.limit).toBe(2500);
    expect(email.remaining).toBe(1300);
    expect(email.byTenantLabel).toContain('Bookwise');

    const whatsapp = metrics[5];
    expect(whatsapp.used).toBe(640);
    expect(whatsapp.limit).toBe(800);
    expect(whatsapp.remaining).toBe(160);
  });

  it('maps tenant_id → name from AuthService.me().businesses', () => {
    component.ngOnInit();

    const email = component.usageMetrics().find((m) => m.key === 'email')!;
    expect(email.byTenantLabel).toBe('Bookwise: 640');
  });

  it('routes 402/403 errors through HttpErrorService.handle', () => {
    api.getUsage.mockReturnValue(throwError(() => ({ status: 402, error: { error: 'subscription_inactive' } })));

    component.ngOnInit();

    expect(component.loading()).toBe(false);
    expect(component.usage()).toBeNull();
    expect(component.usageMetrics()).toEqual([]);
    expect(httpError.handle).toHaveBeenCalledTimes(1);
  });
});
