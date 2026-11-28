import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { BillingPaymentsQuery, BillingPaymentsResponse } from '@models';

/**
 * Historial de cargos de la cuenta activa (GET /v1/payments).
 *
 * Owner|billing, Sanctum. Paginado server-side (25 por página, más nuevos
 * primero) con filtros opcionales de estado y rango de fechas. El recurso
 * expone `failure_code` del proveedor, así que la UI puede mostrar el motivo
 * de un cobro rechazado sin pedir nada extra a la suscripción.
 */
@Injectable({ providedIn: 'root' })
export class BillingPaymentsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * GET /payments?page=&status=&from=&to= → paginator `{ data, meta }`.
   * Errores normalizados del BE `{ error, detail }`: 402 subscription_inactive,
   * 403 sin membresía/rol, 422 filtro inválido.
   */
  getPayments(query: BillingPaymentsQuery = {}): Observable<BillingPaymentsResponse> {
    let params = new HttpParams();
    if (query.page) params = params.set('page', String(query.page));
    if (query.status) params = params.set('status', query.status);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);

    return this.http.get<BillingPaymentsResponse>(`${this.baseUrl}/payments`, { params });
  }
}
