import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MyPlanComponent } from './my-plan.component';
import { SubscriptionStore } from '@core/stores/subscription.store';
import type { Subscription } from '@models';

function makeSubscription(): Subscription {
  return {
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
    addons: [
      { type: 'whatsapp', quantity: 2, credits_per_pack: 50, price_clp: 10_000 },
    ],
    addons_total_clp: 10_000,
    total_price_clp: 61_990,
    addon_catalog: [],
  };
}

describe('MyPlanComponent — Mi plan (read-only)', () => {
  let subscription: ReturnType<typeof signal<Subscription | null>>;
  let loadSubscription: ReturnType<typeof vi.fn>;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let component: MyPlanComponent;

  function setup(sub: Subscription | null): void {
    subscription = signal<Subscription | null>(sub);
    loadSubscription = vi.fn();
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      imports: [MyPlanComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: SubscriptionStore,
          useValue: {
            subscription,
            loading: signal({ subscription: false, plans: false, usage: false }),
            loadSubscription,
          },
        },
        { provide: Router, useValue: router },
      ],
    });

    component = TestBed.createComponent(MyPlanComponent).componentInstance;
    component.ngOnInit();
  }

  it('loads the subscription once and exposes plan price and total', () => {
    setup(makeSubscription());

    expect(loadSubscription).toHaveBeenCalledTimes(1);
    expect(component.planName()).toBe('Premium');
    expect(component.planPrice()).toBe(51_990);
    expect(component.totalPrice()).toBe(61_990);
    expect(component.addonsTotal()).toBe(10_000);
  });

  it('suffixes the price by the real billing interval', () => {
    setup(makeSubscription());
    expect(component.intervalSuffix()).toBe('/mes');

    const yearly = makeSubscription();
    yearly.plan!.billing_interval = 'year';
    subscription.set(yearly);
    expect(component.intervalSuffix()).toBe('/año');
  });

  it('formats the next billing date from next_billing_at', () => {
    setup(makeSubscription());
    expect(component.nextBillingDate()).toContain('2026');
  });

  it('labels add-ons by channel and total credits', () => {
    setup(makeSubscription());
    const label = component.addonLabel(component.addons()[0]);
    expect(label).toContain('WhatsApp');
    expect(label).toContain('100');
  });

  it('navigates to manage and billing routes', () => {
    setup(makeSubscription());

    component.goToManage();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/planes/administrar']);

    component.goToBilling();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/facturacion']);
  });

  it('reports no current plan when there is no live subscription', () => {
    setup(null);

    expect(component.currentPlan()).toBeNull();
    expect(component.planName()).toBe('');
    expect(component.planPrice()).toBe(0);
  });
});
