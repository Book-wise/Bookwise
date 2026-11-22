import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PaymentsApiService } from './payments-api.service';
import { environment } from '@env/environment';
import { PaymentMethodInfo } from '@models';

describe('PaymentsApiService', () => {
  let service: PaymentsApiService;
  let httpMock: HttpTestingController;

  const method: PaymentMethodInfo = {
    id: 7,
    provider: 'transbank_oneclick_mall',
    is_default: true,
    status: 'active',
    created_at: '2026-02-12T10:00:00.000000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PaymentsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getMethods calls GET /payment-methods and returns the full { data } payload', () => {
    service.getMethods().subscribe((res) => {
      expect(res).toEqual({ data: [method] });
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/payment-methods`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [method] });
  });

  it('startEnrollment calls POST /payment-methods/enroll and returns the redirect URL', () => {
    service.startEnrollment().subscribe((res) => {
      expect(res.data.redirect_url).toContain('webpay3gint.transbank.cl');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/payment-methods/enroll`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(
      {
        message: 'Redirigí al usuario al formulario del proveedor para inscribir la tarjeta.',
        data: { redirect_url: 'https://webpay3gint.transbank.cl/webpayserver/bp_inscription.cgi?TBK_TOKEN=abc' },
      },
      { status: 201, statusText: 'Created' },
    );
  });

  it('surfaces enrollment conflicts as Error instances carrying the backend errorCode (409)', () => {
    service.startEnrollment().subscribe({
      error: (err: { error?: { error: string } }) => {
        expect(err.error?.error).toBe('payment_enrollment_in_progress');
      },
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/payment-methods/enroll`);
    req.flush(
      {
        error: 'payment_enrollment_in_progress',
        detail: 'Ya hay una inscripción de medio de pago en curso para esta cuenta. Terminá ese flujo antes de iniciar otro.',
      },
      { status: 409, statusText: 'Conflict' },
    );
  });

  it('surfaces provider unavailability (503) without retrying', () => {
    service.startEnrollment().subscribe({
      error: (err: { error?: { error: string } }) => {
        expect(err.error?.error).toBe('payment_provider_unavailable');
      },
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/payment-methods/enroll`);
    req.flush(
      { error: 'payment_provider_unavailable', detail: 'El medio de pago no está disponible en este momento.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
  });

  it('removeMethod calls DELETE /payment-methods/{id} and expects a { message } envelope', () => {
    service.removeMethod(7).subscribe((res) => {
      expect(res.message).toBe('Tu medio de pago fue eliminado.');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/payment-methods/7`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush({ message: 'Tu medio de pago fue eliminado.' });
  });
});
