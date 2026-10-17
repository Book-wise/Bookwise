import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { UsageData } from '@models';

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
}
