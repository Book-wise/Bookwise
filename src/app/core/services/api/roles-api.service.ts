import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Role } from '@models';

@Injectable({ providedIn: 'root' })
export class RolesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** GET /roles (Bearer) → lista de roles de negocio, unwrap { data: Role[] } */
  getRoles(): Observable<Role[]> {
    return this.http.get<{ data: Role[] }>(`${this.baseUrl}/roles`).pipe(map((r) => r.data));
  }

  /**
   * PATCH /providers/{id}/roles { roles: [slug] } → replaces the professional's
   * role set. The request always carries slugs, never display names.
   */
  assignProviderRoles(providerId: number, slugs: string[]): Observable<{ data: Role[] }> {
    return this.http.patch<{ data: Role[] }>(
      `${this.baseUrl}/providers/${providerId}/roles`,
      { roles: slugs },
    );
  }
}
