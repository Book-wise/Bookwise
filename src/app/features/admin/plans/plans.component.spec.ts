import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { PlansComponent } from './plans.component';
import { SubscriptionStore } from '@core/stores/subscription.store';
import { HttpErrorService } from '@services/http-error.service';
import type { PlanCatalogGroup, Subscription } from '@models';

/** Catálogo mínimo: dos slugs, cada uno con su fila mensual y anual. */
const catalog: PlanCatalogGroup[] = [
  {
    slug: 'premium',
    name: 'Premium',
    display_order: 3,
    plans: [
      { billing_interval: 'month', price_clp: 51990, max_tenants: 5, max_profesionales: 3, max_locations: 3, max_users: 12, email_monthly_limit: 2500, whatsapp_monthly_limit: 800 },
      { billing_interval: 'year', price_clp: 519900, max_tenants: 5, max_profesionales: 3, max_locations: 3, max_users: 12, email_monthly_limit: 2500, whatsapp_monthly_limit: 800 },
    ],
  },
  {
    slug: 'pro',
    name: 'Pro',
    display_order: 4,
    plans: [
      { billing_interval: 'month', price_clp: 228990, max_tenants: 10, max_profesionales: 5, max_locations: 5, max_users: 25, email_monthly_limit: 6000, whatsapp_monthly_limit: 2000 },
      { billing_interval: 'year', price_clp: 2289900, max_tenants: 10, max_profesionales: 5, max_locations: 5, max_users: 25, email_monthly_limit: 6000, whatsapp_monthly_limit: 2000 },
    ],
  },
];

function makeSubscription(interval: 'month' | 'year', slug = 'premium'): Subscription {
  const group = catalog.find((g) => g.slug === slug)!;
  const entry = group.plans.find((p) => p.billing_interval === interval)!;
  return {
    id: 1,
    status: 'active',
    plan: {
      id: 1,
      slug: group.slug,
      name: group.name,
      billing_interval: interval,
      price_clp: entry.price_clp,
      max_tenants: entry.max_tenants,
      max_profesionales: entry.max_profesionales,
      max_locations: entry.max_locations,
      max_users: entry.max_users,
      email_monthly_limit: entry.email_monthly_limit,
      whatsapp_monthly_limit: entry.whatsapp_monthly_limit,
    },
    scheduled_plan: null,
    cancel_at_period_end: false,
    current_period_start: '2026-10-01T00:00:00Z',
    current_period_end: '2026-10-31T00:00:00Z',
    next_billing_at: '2026-11-01T00:00:00Z',
    activated_at: null,
    paused_at: null,
    cancelled_at: null,
    addons: [],
    addons_total_clp: 0,
    total_price_clp: entry.price_clp,
  };
}

describe('PlansComponent — current plan detection', () => {
  let subscription: ReturnType<typeof signal<Subscription | null>>;
  let setAddon: ReturnType<typeof vi.fn>;
  let component: PlansComponent;

  function setup(sub: Subscription | null): void {
    subscription = signal<Subscription | null>(sub);
    setAddon = vi.fn(() => of({ data: sub }));

    TestBed.configureTestingModule({
      imports: [PlansComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: SubscriptionStore,
          useValue: {
            plans: signal(catalog),
            loading: signal({ plans: false, subscription: false, usage: false }),
            subscription,
            error: signal({ plans: null, subscription: null, usage: null }),
            loadPlans: vi.fn(),
            loadSubscription: vi.fn(),
            setAddon,
          },
        },
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });

    component = TestBed.createComponent(PlansComponent).componentInstance;
    component.ngOnInit();
  }

  const premium = () => catalog.find((g) => g.slug === 'premium')!;
  const pro = () => catalog.find((g) => g.slug === 'pro')!;

  it('marks the plan as current only when slug AND interval match', () => {
    setup(makeSubscription('month'));

    // Arranca en la modalidad del plan actual (mensual).
    expect(component.interval()).toBe('month');
    expect(component.isCurrent(premium())).toBe(true);
  });

  it('does NOT mark the same plan as current on the annual tab (it is a discounted offer)', () => {
    setup(makeSubscription('month'));

    component.setInterval('year');

    // Mismo slug, distinto intervalo → no es el plan actual.
    expect(component.isCurrent(premium())).toBe(false);
  });

  it('marks the annual plan as current when the account pays annually', () => {
    setup(makeSubscription('year'));

    expect(component.interval()).toBe('year');
    expect(component.isCurrent(premium())).toBe(true);

    // Y deja de serlo al mirar la pestaña mensual (viceversa).
    component.setInterval('month');
    expect(component.isCurrent(premium())).toBe(false);
  });

  it('never marks a different slug as current', () => {
    setup(makeSubscription('month'));

    expect(component.isCurrent(pro())).toBe(false);
  });

  it('preselects the current plan radio when the user has not chosen yet', () => {
    setup(makeSubscription('month'));

    // Sin elección explícita, el radio nace marcado en el plan actual.
    expect(component.selectedSlug()).toBeNull();
    expect(component.isSelected(premium())).toBe(true);
    expect(component.isSelected(pro())).toBe(false);
  });

  it('lets an explicit selection override the preselected current plan', () => {
    setup(makeSubscription('month'));

    component.selectPlan(pro());

    expect(component.isSelected(pro())).toBe(true);
    expect(component.isSelected(premium())).toBe(false);
  });

  it('does not preselect anything on the other interval (the account has a single plan)', () => {
    // La cuenta paga MENSUAL: en la pestaña anual no hay plan marcado.
    setup(makeSubscription('month'));
    expect(component.isSelected(premium())).toBe(true);

    component.setInterval('year');

    expect(component.isSelected(premium())).toBe(false);
    expect(component.isSelected(pro())).toBe(false);
  });

  it('opens on the interval the account actually pays and marks its plan there', () => {
    // La cuenta paga ANUAL: arranca en esa pestaña, con su plan marcado.
    setup(makeSubscription('year'));

    expect(component.interval()).toBe('year');
    expect(component.isSelected(premium())).toBe(true);

    // Y en la mensual no queda nada seleccionado.
    component.setInterval('month');
    expect(component.isSelected(premium())).toBe(false);
  });

  it('has no current plan when there is no live subscription', () => {
    setup(null);

    expect(component.isCurrent(premium())).toBe(false);
    expect(component.isCurrent(pro())).toBe(false);
  });

  // ── Add-ons ─────────────────────────────────────────────────────────────
  it('respects the lower bound of the pack stepper', () => {
    setup(makeSubscription('month'));

    // Sin add-ons contratados, el stepper arranca en 0 y no puede bajar.
    expect(component.quantityFor('whatsapp')).toBe(0);
    component.changeQuantity('whatsapp', -1);

    expect(component.quantityFor('whatsapp')).toBe(0);
    expect(component.hasDraftChanges()).toBe(false);
    expect(setAddon).not.toHaveBeenCalled();
  });

  it('counts contract add-on credits on top of the plan limit', () => {
    const sub = makeSubscription('month');
    // 2 packs de WhatsApp × 50 créditos = 100 extra sobre el límite del plan (800).
    sub.addons = [{ type: 'whatsapp', quantity: 2, credits_per_pack: 50, price_clp: 10_000 }];
    setup(sub);

    expect(component.quantityFor('whatsapp')).toBe(2);
    expect(component.creditsFor('whatsapp')).toBe(800 + 100);
    // El canal sin add-ons queda en su límite base.
    expect(component.creditsFor('email')).toBe(2500);
  });

  it('exposes the add-on catalog offered by the backend', () => {
    const sub = makeSubscription('month');
    sub.addon_catalog = [
      { type: 'email', credits_per_pack: 50, price_clp: 3000 },
      { type: 'whatsapp', credits_per_pack: 50, price_clp: 5000 },
    ];
    setup(sub);

    expect(component.addonCatalog().map((a) => a.type)).toEqual(['email', 'whatsapp']);
  });
});

/** Catálogo de packs del backend (precio unitario por pack de 50 créditos). */
function withAddonCatalog(sub: Subscription): Subscription {
  sub.addon_catalog = [
    { type: 'email', credits_per_pack: 50, price_clp: 3000 },
    { type: 'whatsapp', credits_per_pack: 50, price_clp: 5000 },
  ];
  return sub;
}

/**
 * Monta el componente con un store mockeado. `onSetAddon` permite simular
 * fallos de la API en el flujo de confirmación.
 */
function mountPlans(
  sub: Subscription | null,
  onSetAddon: (type: string, quantity: number) => Observable<{ data: Subscription }> = () =>
    of({ data: sub as Subscription }),
): {
  component: PlansComponent;
  setAddon: ReturnType<typeof vi.fn>;
  httpError: { handle: ReturnType<typeof vi.fn> };
} {
  const setAddon = vi.fn(onSetAddon);
  const httpError = { handle: vi.fn() };

  TestBed.configureTestingModule({
    imports: [PlansComponent],
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: SubscriptionStore,
        useValue: {
          plans: signal(catalog),
          loading: signal({ plans: false, subscription: false, usage: false }),
          subscription: signal<Subscription | null>(sub),
          error: signal({ plans: null, subscription: null, usage: null }),
          loadPlans: vi.fn(),
          loadSubscription: vi.fn(),
          setAddon,
        },
      },
      { provide: HttpErrorService, useValue: httpError },
      { provide: Router, useValue: { navigate: vi.fn() } },
    ],
  });

  const component = TestBed.createComponent(PlansComponent).componentInstance;
  component.ngOnInit();
  return { component, setAddon, httpError };
}

describe('PlansComponent — borrador de add-ons (barra flotante)', () => {
  it('accumulates pack changes in a draft without writing to the API', () => {
    const { component, setAddon } = mountPlans(withAddonCatalog(makeSubscription('month')));

    expect(component.hasDraftChanges()).toBe(false);

    component.changeQuantity('whatsapp', 1);

    // Nada se persiste hasta confirmar.
    expect(setAddon).not.toHaveBeenCalled();
    expect(component.quantityFor('whatsapp')).toBe(1);
    expect(component.pendingAddons()).toEqual([{ type: 'whatsapp', from: 0, to: 1 }]);
    expect(component.hasDraftChanges()).toBe(true);
    // Los créditos del canal siguen el borrador (800 del plan + 1 pack de 50).
    expect(component.creditsFor('whatsapp')).toBe(850);
  });

  it('stacks draft steps on top of the persisted quantity', () => {
    const sub = withAddonCatalog(makeSubscription('month'));
    sub.addons = [{ type: 'whatsapp', quantity: 2, credits_per_pack: 50, price_clp: 10_000 }];
    const { component } = mountPlans(sub);

    component.changeQuantity('whatsapp', 1);

    expect(component.quantityFor('whatsapp')).toBe(3);
    expect(component.pendingAddons()).toEqual([{ type: 'whatsapp', from: 2, to: 3 }]);
  });

  it('drops the pending change when the quantity returns to the persisted one', () => {
    const sub = withAddonCatalog(makeSubscription('month'));
    sub.addons = [{ type: 'email', quantity: 1, credits_per_pack: 50, price_clp: 3000 }];
    const { component } = mountPlans(sub);

    component.changeQuantity('email', 1);
    expect(component.hasDraftChanges()).toBe(true);

    component.changeQuantity('email', -1);

    expect(component.quantityFor('email')).toBe(1);
    expect(component.pendingAddons()).toEqual([]);
    expect(component.hasDraftChanges()).toBe(false);
  });

  it('cancel discards the draft and writes nothing', () => {
    const { component, setAddon } = mountPlans(withAddonCatalog(makeSubscription('month')));

    component.changeQuantity('whatsapp', 2);
    component.cancelChanges();

    expect(component.quantityFor('whatsapp')).toBe(0);
    expect(component.hasDraftChanges()).toBe(false);
    expect(setAddon).not.toHaveBeenCalled();
  });

  it('confirm applies exactly one PUT per changed channel and clears the draft', () => {
    const sub = withAddonCatalog(makeSubscription('month'));
    sub.addons = [{ type: 'email', quantity: 1, credits_per_pack: 50, price_clp: 3000 }];
    const { component, setAddon } = mountPlans(sub);

    component.changeQuantity('email', 1); // 1 → 2 (canal con cambios)
    component.changeQuantity('whatsapp', 2); // 0 → 2
    component.confirmChanges();

    expect(setAddon).toHaveBeenCalledTimes(2);
    expect(setAddon).toHaveBeenCalledWith('email', 2);
    expect(setAddon).toHaveBeenCalledWith('whatsapp', 2);
    expect(component.hasDraftChanges()).toBe(false);
    expect(component.confirming()).toBe(false);
  });

  it('keeps a failed channel pending and stops before the remaining ones', () => {
    const sub = withAddonCatalog(makeSubscription('month'));
    let calls = 0;
    const { component, setAddon, httpError } = mountPlans(sub, () => {
      calls += 1;
      return calls === 1 ? throwError(() => new Error('boom')) : of({ data: sub });
    });

    component.changeQuantity('email', 1);
    component.changeQuantity('whatsapp', 1);
    component.confirmChanges();

    // Corta en el primer fallo: no sigue escribiendo el resto.
    expect(setAddon).toHaveBeenCalledTimes(1);
    expect(component.confirming()).toBe(false);
    expect(httpError.handle).toHaveBeenCalled();
    // Ambos cambios siguen en el borrador para reintentar.
    expect(component.pendingAddons().map((p) => p.type)).toEqual(['email', 'whatsapp']);
  });

  it('reflects the draft in the summary total', () => {
    const { component } = mountPlans(withAddonCatalog(makeSubscription('month')));

    // Premium mensual $51.990 sin add-ons.
    expect(component.addonsSubtotal()).toBe(0);
    expect(component.draftTotal()).toBe(51_990);

    component.changeQuantity('whatsapp', 1);

    expect(component.addonsSubtotal()).toBe(5000);
    expect(component.draftTotal()).toBe(56_990);

    component.cancelChanges();

    expect(component.draftTotal()).toBe(51_990);
  });
});

