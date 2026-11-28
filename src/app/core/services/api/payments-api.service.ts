import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { EnrollmentResultResponse, EnrollmentStartResponse, PaymentMethodInfo, PaymentMethodsResponse } from '@models';

/**
 * Medios de pago de la cuenta activa (P1 Transbank Oneclick Mall, BE feat/transbank-p1).
 *
 * Token-only: el FE nunca ve PAN/CVV ni el token transitorio del proveedor.
 * `startEnrollment` devuelve la URL del formulario de Webpay tal cual la
 * entrega el backend — el FE solo navega el browser ahí (redirect_url ya
 * lleva el TBK_TOKEN embebido por el SDK del BE).
 */
@Injectable({ providedIn: 'root' })
export class PaymentsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * GET /payment-methods (Bearer, owner|billing) → { data: PaymentMethodInfo[] }.
   * Sin campos card_*: proveedor, estado, default y fecha; nada de datos de tarjeta.
   */
  getMethods(): Observable<PaymentMethodsResponse> {
    return this.http.get<PaymentMethodsResponse>(`${this.baseUrl}/payment-methods`);
  }

  /**
   * POST /payment-methods/enroll (Bearer, owner|billing, throttle payments) → 201
   * { message, data: { redirect_url } }. Errores normalizados del BE: 409
   * payment_enrollment_in_progress | payment_method_already_enrolled; 502/503 provider.
   */
  startEnrollment(): Observable<EnrollmentStartResponse> {
    return this.http.post<EnrollmentStartResponse>(`${this.baseUrl}/payment-methods/enroll`, {});
  }

  /**
   * DELETE /payment-methods/{id} (Bearer, owner|billing) → { message }.
   * Baja lógica del lado BE (status disabled) + baja de la inscripción del proveedor.
   */
  removeMethod(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/payment-methods/${id}`);
  }

  /**
   * GET /payment-methods/enrollment-result?n=<nonce> (Bearer, Sanctum).
   * Verdad única del resultado de inscripción (P2). 410 Gone = nonce gastado/
   * expirado/inexistente/otra cuenta; 200 { status: processing } = en vuelo;
   * 200 { status: ok|failure, reason, payment_method } = asentado (consume el nonce).
   */
  getEnrollmentResult(nonce: string): Observable<EnrollmentResultResponse> {
    return this.http.get<EnrollmentResultResponse>(
      `${this.baseUrl}/payment-methods/enrollment-result`,
      { params: { n: nonce } },
    );
  }
}
