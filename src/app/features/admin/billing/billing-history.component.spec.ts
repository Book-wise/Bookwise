import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { BillingHistoryComponent } from './billing-history.component';
import { BillingPaymentsApiService } from '@services/api/billing-payments-api.service';
import type { BillingPayment, BillingPaymentsResponse } from '@models';

const payment: BillingPayment = {
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
};

function page(
  data: BillingPayment[],
  meta: Partial<BillingPaymentsResponse['meta']> = {},
): BillingPaymentsResponse {
  return {
    data,
    meta: {
      current_page: 1,
      from: data.length ? 1 : null,
      last_page: 1,
      per_page: 25,
      to: data.length || null,
      total: data.length,
      ...meta,
    },
  };
}

describe('BillingHistoryComponent — cargo history (GET /v1/payments)', () => {
  let router: { navigate: ReturnType<typeof vi.fn> };
  let getPayments: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<BillingHistoryComponent>;
  let component: BillingHistoryComponent;

  function setup(opts: { response?: BillingPaymentsResponse; error?: unknown } = {}): void {
    router = { navigate: vi.fn() };
    getPayments = vi.fn((query: { page?: number } = {}) => {
      if (opts.error) return throwError(() => opts.error);
      const base = opts.response ?? page([payment]);
      // El mock refleja la página pedida, como el paginator real.
      return of({ ...base, meta: { ...base.meta, current_page: query.page ?? 1 } });
    });

    TestBed.configureTestingModule({
      imports: [BillingHistoryComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: router },
        { provide: BillingPaymentsApiService, useValue: { getPayments } },
      ],
    });

    fixture = TestBed.createComponent(BillingHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('loads the first page from the API on init', () => {
    setup();

    expect(getPayments).toHaveBeenCalledWith({ page: 1 });
    expect(component.payments().length).toBe(1);
    expect(component.total()).toBe(1);
  });

  it('renders the real charges instead of mock invoices', () => {
    setup();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('#41');
    expect(el.textContent).toContain('34.990');
    expect(el.textContent).toContain(component.lang.t('billing.payment.succeeded'));
  });

  it('shows the empty state when the account has no charges', () => {
    setup({ response: page([]) });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain(component.lang.t('billing.history.empty'));
    expect(el.querySelector('.invoice-table')).toBeNull();
  });

  it('shows an error state with retry instead of an empty table when the API fails', () => {
    setup({ error: { status: 403, error: { error: 'insufficient_role' } } });
    const el = fixture.nativeElement as HTMLElement;

    expect(component.failed()).toBe(true);
    expect(component.payments().length).toBe(0);
    expect(el.querySelector('.history__state--error')).toBeTruthy();
    expect(el.textContent).toContain(component.lang.t('billing.history.retry'));

    component.load(1);
    expect(getPayments).toHaveBeenCalledTimes(2);
  });

  it('shows the provider failure_code as-is on a failed charge (never translated)', () => {
    setup({
      response: page([{ ...payment, status: 'failed', failure_code: 'INVALID_CARD', paid_at: null }]),
    });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('INVALID_CARD');
    expect(component.statusKey('failed')).toBe('billing.payment.failed');
    expect(component.statusChipClass('failed')).toBe('bw-chip--danger');
  });

  it('maps every payment status to its own chip and label', () => {
    expect(component.statusKey('succeeded')).toBe('billing.payment.succeeded');
    expect(component.statusKey('pending')).toBe('billing.payment.pending');
    expect(component.statusKey('requires_action')).toBe('billing.payment.requires_action');
    expect(component.statusKey('refunded')).toBe('billing.payment.refunded');

    expect(component.statusChipClass('succeeded')).toBe('bw-chip--success');
    expect(component.statusChipClass('pending')).toBe('bw-chip--warning');
    expect(component.statusChipClass('failed')).toBe('bw-chip--danger');
  });

  it('pages forward and back with the server-side paginator', () => {
    setup({ response: page([payment], { current_page: 1, last_page: 3, total: 60 }) });
    expect(component.paginated()).toBe(true);

    component.nextPage();
    expect(getPayments).toHaveBeenLastCalledWith({ page: 2 });

    component.previousPage();
    expect(getPayments).toHaveBeenLastCalledWith({ page: 1 });
  });

  it('hides the pager on a single page', () => {
    setup();
    expect(component.paginated()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('.history__pager')).toBeNull();
  });

  it('formats CLP amounts with the repo formatter', () => {
    setup();
    expect(component.price(34990)).toContain('34.990');
  });

  it('navigates back to billing', () => {
    setup();
    component.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/admin/facturacion']);
  });
});
