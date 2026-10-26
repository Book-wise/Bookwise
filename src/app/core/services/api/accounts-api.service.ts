import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { AccountSummary, UpdateAccountBillingData } from '@models';

/**
 * Cuentas del usuario y su perfil fiscal (datos de facturación).
 *
 * El bloque fiscal vive en la CUENTA, no en el tenant: una cuenta puede tener N
 * negocios y la suscripción que se factura es la de la cuenta.
 */
@Injectable({ providedIn: 'root' })
export class AccountsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * PATCH /accounts/{id} (Bearer, rol de cuenta `owner`|`billing` con membership
   * activa) → { message, data: AccountSummary }.
   *
   * Update parcial: se manda solo lo que cambia; un campo ausente no se toca y
   * un `null` lo limpia. Se envía `sii_activity_id` (id del catálogo), nunca el
   * objeto desnormalizado.
   *
   * `data` trae el summary completo de la cuenta: reemplazalo en el store en vez
   * de refetchear.
   */
  updateBillingData(
    accountId: number,
    data: UpdateAccountBillingData,
  ): Observable<{ message: string; data: AccountSummary }> {
    return this.http.patch<{ message: string; data: AccountSummary }>(
      `${this.baseUrl}/accounts/${accountId}`,
      data,
    );
  }
}
