import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env/environment';
import { PermissionGroup, Role, RolePermissionsResponse } from '@models';

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

  /**
   * GET /roles/permissions (Bearer) → global permission catalog grouped by
   * group, unwrap { data: PermissionGroup[] }. Tenantless: the catalog is CORE.
   */
  getPermissionCatalog(): Observable<PermissionGroup[]> {
    return this.http
      .get<{ data: PermissionGroup[] }>(`${this.baseUrl}/roles/permissions`)
      .pipe(map((r) => r.data));
  }

  /**
   * PATCH /roles/{id}/permissions { permissions: [key] } → replace semantics.
   * An empty array clears every permission for the role.
   */
  updateRolePermissions(
    roleId: number,
    permissions: string[],
  ): Observable<RolePermissionsResponse> {
    return this.http.patch<RolePermissionsResponse>(
      `${this.baseUrl}/roles/${roleId}/permissions`,
      { permissions },
    );
  }
}
