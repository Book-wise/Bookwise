import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SubscriptionApiService } from './subscription-api.service';
import { environment } from '@env/environment';
import { UsageData } from '@models';

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
});
