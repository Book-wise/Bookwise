import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { BillingComponent } from './billing.component';
import { AuthService } from '@services/auth.service';
import { SubscriptionStore } from '@core/stores/subscription.store';
import { HttpErrorService } from '@services/http-error.service';
import { Router } from '@angular/router';
import { AuthMeData, Business, Subscription, UsageData } from '@models';

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
  account_reference: 'BW-ZA86KC',
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

const subscriptionData: Subscription = {
  id: 9,
  status: 'active',
  plan: {
    id: 3,
    slug: 'premium',
    name: 'Premium',
    billing_interval: 'month',
    price_clp: 51990,
    max_tenants: 5,
    max_profesionales: 3,
    max_locations: 3,
    max_users: 12,
    email_monthly_limit: 2500,
    whatsapp_monthly_limit: 800,
  },
  scheduled_plan: null,
  cancel_at_period_end: false,
  current_period_start: '2026-10-01T00:00:00Z',
  current_period_end: '2026-10-31T00:00:00Z',
  next_billing_at: '2026-11-01T00:00:00Z',
  activated_at: null,
  paused_at: null,
  cancelled_at: null,
};

describe('BillingComponent — plan usage wiring', () => {
  let auth: { me: ReturnType<typeof signal<AuthMeData | null>> };
  let httpError: { handle: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let usageSignal: ReturnType<typeof signal<UsageData | null>>;
  let subscriptionSignal: ReturnType<typeof signal<Subscription | null>>;
  let errorSignal: ReturnType<typeof signal<{ usage: unknown; subscription: unknown; plans: unknown }>>;
  let loadUsage: ReturnType<typeof vi.fn>;
  let loadSubscription: ReturnType<typeof vi.fn>;
  let component: BillingComponent;

  beforeEach(async () => {
    auth = { me: signal(makeMe() as AuthMeData | null) };
    httpError = { handle: vi.fn() };
    router = { navigate: vi.fn() };
    usageSignal = signal<UsageData | null>(usageData);
    subscriptionSignal = signal<Subscription | null>(subscriptionData);
    errorSignal = signal({ usage: null, subscription: null, plans: null });
    loadUsage = vi.fn();
    loadSubscription = vi.fn();

    const fakeStore = {
      usage: usageSignal,
      subscription: subscriptionSignal,
      loading: signal({ usage: false, subscription: false, plans: false }),
      error: errorSignal,
      loadUsage,
      loadSubscription,
      loadPlans: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BillingComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: auth },
        { provide: SubscriptionStore, useValue: fakeStore },
        { provide: HttpErrorService, useValue: httpError },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    component = TestBed.createComponent(BillingComponent).componentInstance;
  });

  it('builds the usage metrics from the cached store usage', () => {
    component.ngOnInit();

    expect(loadUsage).toHaveBeenCalledTimes(1);
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

  it('renders empty metrics when usage is null', () => {
    usageSignal.set(null);
    component.ngOnInit();

    expect(component.usageMetrics()).toEqual([]);
  });

  it('goToPlans navigates to /admin/planes', () => {
    component.goToPlans();

    expect(router.navigate).toHaveBeenCalledWith(['/admin/planes']);
  });

  it('loads the real plan from the cached subscription and renders its price and period', () => {
    component.ngOnInit();

    expect(loadSubscription).toHaveBeenCalledTimes(1);
    expect(component.planName()).toBe('Premium');
    expect(component.planPriceLabel()).toContain('51.990');
    expect(component.periodStart()).toContain('oct');
    expect(component.periodEnd()).toContain('oct');
  });

  it('derives account id, renewal date and interval from the real endpoints', () => {
    component.ngOnInit();

    // account_id desde GET /usage; next_billing_at desde GET /subscription.
    expect(component.accountId()).toBe('5');
    expect(component.renewalDate()).toContain('2026');
    expect(component.billingIntervalLabel()).toBe(component.lang.t('billing.monthly_billing'));
  });

  it('derives the public account reference from the endpoint without exposing the PK', () => {
    component.ngOnInit();

    // account_reference es la referencia pública; no se usa el account_id=5.
    expect(component.accountRef()).toBe('BW-ZA86KC');
  });

  it('flags only the metrics that already consumed their full limit', () => {
    component.ngOnInit();

    const metrics = component.usageMetrics();
    const byKey = (key: string) => metrics.find((m) => m.key === key)!;

    // professionals = 3/3 → en el máximo (muestra CTA de upgrade).
    expect(component.isAtLimit(byKey('professionals'))).toBe(true);
    // el resto todavía tiene cupo → sin CTA.
    expect(component.isAtLimit(byKey('locations'))).toBe(false);
    expect(component.isAtLimit(byKey('tenants'))).toBe(false);
    expect(component.isAtLimit(byKey('email'))).toBe(false);
  });

  it('derives plan features from the real plan limits plus active add-ons', () => {
    component.ngOnInit();

    const features = component.planFeatures();
    expect(features.join(' | ')).toContain('negocios');
    expect(features.join(' | ')).toContain('profesionales');
    // whatsapp pack_credit=100 → aparece como add-on
    expect(features.join(' | ')).toContain('créditos WhatsApp');
  });
});
