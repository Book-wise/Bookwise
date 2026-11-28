import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SubscriptionApiService } from './subscription-api.service';
import { environment } from '@env/environment';
import { Subscription, UsageData } from '@models';

describe('SubscriptionApiService', () => {
  let service: SubscriptionApiService;
  let httpMock: HttpTestingController;

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SubscriptionApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getUsage calls GET /subscription/usage and returns the full { data } payload', () => {
    service.getUsage().subscribe((res) => {
      expect(res).toEqual({ data: usageData });
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/subscription/usage`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: usageData });
  });

  const activeSub: Subscription = {
    id: 9,
    status: 'active',
    plan: null,
    scheduled_plan: null,
    cancel_at_period_end: false,
    current_period_start: '2026-11-28T00:00:00+00:00',
    current_period_end: '2026-12-28T00:00:00+00:00',
    next_billing_at: '2026-12-28T00:00:00+00:00',
    activated_at: '2026-11-28T00:00:00+00:00',
    paused_at: null,
    cancelled_at: null,
  };

  it('checkout calls POST /subscriptions/{id}/checkout and returns the updated subscription', () => {
    service.checkout(9).subscribe((res) => {
      expect(res.data.status).toBe('active');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/subscriptions/9/checkout`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ message: 'Pago confirmado.', data: activeSub });
  });

  it('surfaces the 402 first_month_charge_rejected on checkout rejection', () => {
    service.checkout(9).subscribe({
      error: (err: { error?: { error: string } }) => {
        expect(err.error?.error).toBe('first_month_charge_rejected');
      },
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/subscriptions/9/checkout`);
    req.flush(
      { error: 'first_month_charge_rejected', detail: 'El cobro de la primera mensualidad fue rechazado.' },
      { status: 402, statusText: 'Payment Required' },
    );
  });
});
