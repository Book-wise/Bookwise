import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EnrollmentResultComponent } from './enrollment-result.component';
import { AuthService } from '@services/auth.service';
import { PaymentsApiService } from '@services/api/payments-api.service';
import { EnrollmentResultResponse } from '@models';

const okResult: EnrollmentResultResponse = {
  status: 'ok',
  reason: null,
  payment_method: { id: 7, status: 'active', is_default: true },
};

const processingResult: EnrollmentResultResponse = {
  status: 'processing',
  reason: null,
  payment_method: null,
};

describe('EnrollmentResultComponent (pública: resultado de inscripción de medio de pago)', () => {
  let auth: { isAuthenticated: ReturnType<typeof vi.fn> };
  let api: { getEnrollmentResult: ReturnType<typeof vi.fn> };

  /** Establece TestBed con una query, sesión y respuesta del endpoint dadas. */
  async function createComponent(
    query: Record<string, string | null>,
    opts: {
      authenticated?: boolean;
      result?: EnrollmentResultResponse;
      sequence?: EnrollmentResultResponse[];
      errorStatus?: number;
    } = {},
  ) {
    auth = { isAuthenticated: vi.fn(() => opts.authenticated ?? false) };

    const getEnrollmentResult = vi.fn();
    if (opts.errorStatus != null) {
      getEnrollmentResult.mockReturnValue(throwError(() => ({ status: opts.errorStatus })));
    } else if (opts.sequence) {
      for (const r of opts.sequence.slice(0, -1)) {
        getEnrollmentResult.mockReturnValueOnce(of(r));
      }
      getEnrollmentResult.mockReturnValue(of(opts.sequence[opts.sequence.length - 1]));
    } else {
      getEnrollmentResult.mockReturnValue(of(opts.result ?? processingResult));
    }
    api = { getEnrollmentResult };

    const route = {
      snapshot: {
        queryParamMap: {
          get: (key: string) => query[key] ?? null,
        },
      },
    };
    await TestBed.configureTestingModule({
      imports: [EnrollmentResultComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: route },
        { provide: AuthService, useValue: auth },
        { provide: PaymentsApiService, useValue: api },
      ],
    }).compileComponents();
    return TestBed.createComponent(EnrollmentResultComponent);
  }

  it('renders neutral when the URL has no nonce and never calls the endpoint', async () => {
    const fixture = await createComponent({});
    fixture.detectChanges();

    expect(fixture.componentInstance.vm().kind).toBe('neutral');
    expect(api.getEnrollmentResult).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      fixture.componentInstance.lang.t('payment.enrollment.result.neutral_title'),
    );
  });

  it('renders unconfirmed and skips the endpoint without a session', async () => {
    const fixture = await createComponent({ n: 'deadbeef' }, { authenticated: false });
    fixture.detectChanges();

    expect(fixture.componentInstance.vm().kind).toBe('unconfirmed');
    expect(api.getEnrollmentResult).not.toHaveBeenCalled();
  });

  it('renders success from the endpoint ok response, ignoring the query status hint', async () => {
    const fixture = await createComponent(
      { n: 'deadbeef', status: 'failure' },
      { authenticated: true, result: okResult },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.vm().kind).toBe('success');
    expect(api.getEnrollmentResult).toHaveBeenCalledWith('deadbeef');
    // Franja de marca + contexto "Qué pasa ahora" (artboard 04/05).
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.enrollment-result__brand')).toBeTruthy();
    expect(el.textContent).toContain(fixture.componentInstance.lang.t('payment.enrollment.context.next_title'));
  });

  it('renders error with the mapped reason from an endpoint failure', async () => {
    const fixture = await createComponent(
      { n: 'deadbeef' },
      { authenticated: true, result: { status: 'failure', reason: 'payment_enrollment_rejected', payment_method: null } },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.vm().kind).toBe('error');
    expect(fixture.componentInstance.errorMessageKey()).toBe('payment.enrollment.reason.rejected');
    expect((fixture.nativeElement as HTMLElement).querySelector('.enrollment-result__context--causes')).toBeTruthy();
  });

  const reasonCases = [
    ['payment_enrollment_cancelled', 'payment.enrollment.reason.cancelled'],
    ['payment_enrollment_missing_token', 'payment.enrollment.reason.missing_token'],
    ['payment_enrollment_failed', 'payment.enrollment.reason.failed'],
    ['payment_enrollment_rejected', 'payment.enrollment.reason.rejected'],
    ['payment_enrollment_expired', 'payment.enrollment.reason.expired'],
  ] as const;

  it.each(reasonCases)('maps documented reason %s to its own message key', async (reason, key) => {
    const fixture = await createComponent(
      { n: 'deadbeef' },
      { authenticated: true, result: { status: 'failure', reason, payment_method: null } },
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.vm().kind).toBe('error');
    expect(fixture.componentInstance.errorMessageKey()).toBe(key);
  });

  it('renders neutral (never an app error) on a 410 Gone nonce', async () => {
    const fixture = await createComponent({ n: 'spent' }, { authenticated: true, errorStatus: 410 });
    fixture.detectChanges();

    expect(fixture.componentInstance.vm().kind).toBe('neutral');
    expect(fixture.componentInstance.vm().reason).toBeNull();
  });

  it('renders unconfirmed on a server/network failure (never asserts success)', async () => {
    const fixture = await createComponent({ n: 'deadbeef' }, { authenticated: true, errorStatus: 500 });
    fixture.detectChanges();

    expect(fixture.componentInstance.vm().kind).toBe('unconfirmed');
  });

  it('polls while processing and settles on the next response', async () => {
    vi.useFakeTimers();
    try {
      const fixture = await createComponent(
        { n: 'deadbeef' },
        { authenticated: true, sequence: [processingResult, okResult] },
      );
      fixture.detectChanges();

      expect(fixture.componentInstance.vm().kind).toBe('processing');
      expect(api.getEnrollmentResult).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(2000);
      expect(api.getEnrollmentResult).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.vm().kind).toBe('success');
    } finally {
      vi.useRealTimers();
    }
  });
});
