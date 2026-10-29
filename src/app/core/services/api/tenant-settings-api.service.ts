import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TenantSettings } from '@models';

/**
 * Subconjunto mutable de la configuración del tenant. El PATCH es parcial
 * (solo se mandan las claves que cambian); `business_rut`/`business_email` son
 * inmutables en el backend, por eso no forman parte de este tipo.
 */
export type TenantSettingsPatch = { block_bookings_on_holidays?: boolean };

/**
 * Configuración global del tenant (`GET`/`PATCH /tenant/settings`).
 * Respuesta plana (sin envelope `data`).
 */
@Injectable({ providedIn: 'root' })
export class TenantSettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getSettings(): Observable<TenantSettings> {
    return this.http.get<TenantSettings>(`${this.baseUrl}/tenant/settings`);
  }

  /** PATCH parcial: manda solo lo que cambia (no pisa el resto). */
  updateSettings(patch: TenantSettingsPatch): Observable<TenantSettings> {
    return this.http.patch<TenantSettings>(`${this.baseUrl}/tenant/settings`, patch);
  }
}
