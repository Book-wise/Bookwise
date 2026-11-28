import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { BillingPaymentsApiService } from './billing-payments-api.service';
import { environment } from '@env/environment';
import { BillingPaymentsResponse } from '@models';

describe('BillingPaymentsApiService', () => {
  let service: BillingPaymentsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BillingPaymentsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const response: BillingPaymentsResponse = {
    data: [
      {
        id: 41,
        kind: 'recurring',
        provider: 'transbank_oneclick_mall',
        provider_transaction_id: 'TX-1',
        amount_clp: 34990,
        currency: 'CLP',
        status: 'succeeded',
        failure_code: null,
        paid_at: '2026-11-12T10:00:00+00:00',
        created_at: '2026-11-12T10:00:00+00:00',
      },
    ],
    meta: { current_page: 1, from: 1, last_page: 1, per_page: 25, to: 1, total: 1 },
  };

  it('calls GET /payments and returns the paginator payload', () => {
    service.getPayments().subscribe((res) => {
      expect(res).toEqual(response);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/payments`);
    expect(req.request.method).toBe('GET');
    req.flush(response);
  });

  it('sends only the filters it was given as query params', () => {
    service.getPayments({ page: 2, status: 'failed', from: '2026-11-01', to: '2026-11-30' }).subscribe();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/payments?page=2&status=failed&from=2026-11-01&to=2026-11-30`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(response);
  });

  it('surfaces the backend error envelope without wrapping it', () => {
    service.getPayments({ page: 1 }).subscribe({
      error: (err: { status: number; error?: { error: string } }) => {
        expect(err.status).toBe(403);
        expect(err.error?.error).toBe('insufficient_role');
      },
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/payments?page=1`);
    req.flush(
      { error: 'insufficient_role', detail: 'Solo el owner o billing ve el historial.' },
      { status: 403, statusText: 'Forbidden' },
    );
  });
});
