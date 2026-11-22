import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EnrollmentResultComponent } from './enrollment-result.component';
import { AuthService } from '@services/auth.service';
import { PaymentsApiService } from '@services/api/payments-api.service';
import { PaymentMethodInfo } from '@models';

const activeMethod: PaymentMethodInfo = {
  id: 7,
  provider: 'transbank_oneclick_mall',
  is_default: true,
  status: 'active',
  created_at: '2026-02-12T10:00:00.000000Z',
};

describe('EnrollmentResultComponent (pública: resultado de inscripción de medio de pago)', () => {
  let auth: { isAuthenticated: ReturnType<typeof vi.fn> };
  let api: { getMethods: ReturnType<typeof vi.fn> };

  /** Establece TestBed con una query, sesión y estado de medios de pago dados. */
  async function createComponent(
    query: Record<string, string | null>,
    opts: { authenticated?: boolean; methods?: PaymentMethodInfo[]; failMethods?: boolean } = {},
  ) {
    auth = {
      isAuthenticated: vi.fn(() => opts.authenticated ?? false),
    };
    api = {
      getMethods:
        opts.failMethods
          ? vi.fn(() => throwError(() => new Error('network')))
          : vi.fn(() => of({ data: opts.methods ?? [] })),
    };
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

  it('renders success for status=ok only when an active card exists (reconciliación)', async () => {
    const fixture = await createComponent({ status: 'ok' }, { authenticated: true, methods: [activeMethod] });
    fixture.detectChanges();

    expect(fixture.componentInstance.vm().kind).toBe('success');
    // Franja de marca + contexto "Qué pasa ahora" (artboard 04/05).
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.enrollment-result__brand')).toBeTruthy();
    expect(el.textContent).toContain(fixture.componentInstance.lang.t('payment.enrollment.context.next_title'));
    // Noindex: página pública de pago no indexable.
    const robots = (document.head.querySelector('meta[name="robots"]') as HTMLMetaElement | null);
    expect(robots?.content).toContain('noindex');
  });

  it('never claims success from the URL alone: status=ok with no active card is unconfirmed', async () => {
    const fixture = await createComponent({ status: 'ok' }, { authenticated: true, methods: [] });
    fixture.detectChanges();

    expect(fixture.componentInstance.vm().kind).toBe('unconfirmed');
  });

  it('status=ok without a session stays unconfirmed (no fake success before login)', async () => {
    const fixture = await createComponent({ status: 'ok' }, { authenticated: false });
    fixture.detectChanges();

    expect(fixture.componentInstance.vm().kind).toBe('unconfirmed');
    expect(api.getMethods).not.toHaveBeenCalled();
  });

  it('a failed method check never upgrades the claimed ok to success', async () => {
    const fixture = await createComponent({ status: 'ok' }, { authenticated: true, failMethods: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.vm().kind).toBe('unconfirmed');
  });

  const reasonCases = [
    ['payment_enrollment_cancelled', 'payment.enrollment.reason.cancelled'],
    ['payment_enrollment_missing_token', 'payment.enrollment.reason.missing_token'],
    ['payment_enrollment_failed', 'payment.enrollment.reason.failed'],
    ['payment_enrollment_rejected', 'payment.enrollment.reason.rejected'],
    ['payment_enrollment_expired', 'payment.enrollment.reason.expired'],
  ] as const;

  it.each(reasonCases)('maps documented reason %s to its own message key', async (reason, key) => {
    const fixture = await createComponent({ status: 'error', reason });
    fixture.detectChanges();
    expect(fixture.componentInstance.vm().kind).toBe('error');
    expect(fixture.componentInstance.errorMessageKey()).toBe(key);
  });

  it('adds the possible-causes block and retry CTA on any error state', async () => {
    const fixture = await createComponent({ status: 'error', reason: 'payment_enrollment_rejected' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.enrollment-result__context--causes')).toBeTruthy();
    expect(el.textContent).toContain(fixture.componentInstance.lang.t('payment.enrollment.result.retry'));
  });

  it('renders processing for status=processing (confirmación en curso)', async () => {
    const fixture = await createComponent({ status: 'processing' });
    fixture.detectChanges();
    expect(fixture.componentInstance.vm().kind).toBe('processing');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(fixture.componentInstance.lang.t('payment.enrollment.result.processing_chip'));
  });

  it('defaults to neutral (not error) when the query has no status: no fake failure either', async () => {
    const fixture = await createComponent({});
    fixture.detectChanges();

    expect(fixture.componentInstance.vm().kind).toBe('neutral');
    expect(fixture.componentInstance.vm().reason).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      fixture.componentInstance.lang.t('payment.enrollment.result.neutral_title'),
    );
  });
});
