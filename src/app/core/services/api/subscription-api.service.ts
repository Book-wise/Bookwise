import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { PlansCatalogResponse, Subscription, SubscriptionResponse, UsageData } from '@models';

@Injectable({ providedIn: 'root' })
export class SubscriptionApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * GET /subscription/usage (Bearer) → { data: UsageData }.
   * Sin suscripción viva → 402 subscription_inactive. Sin membership activa → 403.
   */
  getUsage(): Observable<{ data: UsageData }> {
    return this.http.get<{ data: UsageData }>(`${this.baseUrl}/subscription/usage`);
  }

  /**
   * GET /subscription (Bearer) → { data: Subscription | null }.
   * Suscripción de la cuenta activa (plan + período + estado + scheduled_plan).
   */
  getSubscription(): Observable<SubscriptionResponse> {
    return this.http.get<SubscriptionResponse>(`${this.baseUrl}/subscription`);
  }

  /**
   * GET /plans (público, sin auth) → { data: PlanCatalogGroup[] }.
   * Catálogo de planes activo agrupado por slug (month/year).
   */
  getPlans(): Observable<PlansCatalogResponse> {
    return this.http.get<PlansCatalogResponse>(`${this.baseUrl}/plans`);
  }

  /**
   * PUT /subscription/addons (Bearer, owner|billing) → subscription actualizada.
   * Upsert de la cantidad de packs por canal; `quantity: 0` quita el add-on.
   */
  updateAddons(type: 'email' | 'whatsapp', quantity: number): Observable<{ message?: string; data: Subscription }> {
    return this.http.put<{ message?: string; data: Subscription }>(
      `${this.baseUrl}/subscription/addons`,
      { type, quantity },
    );
  }
}
