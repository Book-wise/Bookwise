import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { signalStore, withMethods, withState, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, of, pipe, switchMap, tap } from 'rxjs';
import { RolesApiService } from '@services/api/roles-api.service';
import { isOnboardingRequired } from '@services/http-error.service';
import { PermissionGroup, Role } from '@models';

interface RolesState {
  /** Tenant role list with its current permission keys. */
  roles: Role[];
  rolesLoading: boolean;
  rolesError: string | null;
  rolesLoaded: boolean;
  /** Tenantless permission catalog (groups + items), cached for the store lifetime. */
  catalog: PermissionGroup[];
  catalogLoading: boolean;
  catalogError: string | null;
  catalogLoaded: boolean;
}

const initialState: RolesState = {
  roles: [],
  rolesLoading: false,
  rolesError: null,
  rolesLoaded: false,
  catalog: [],
  catalogLoading: false,
  catalogError: null,
  catalogLoaded: false,
};

/**
 * Feature-scoped store for `/admin/roles` (provided on the shell component).
 *
 * Owns the tenant role list and the tenantless permission catalog. It is not
 * root-scoped: only the roles screen reads this data, so a root store would add
 * invalidation policy for no benefit. The catalog (~13 static items) is cached
 * for the store's lifetime and refetched on the next visit.
 *
 * Mutations are never optimistic: `updateRolePermissions` patches `roles` only
 * from the server response and re-throws errors so the subscriber decides the
 * UI reaction (toast + revert + refetch).
 */
export const RolesStore = signalStore(
  withState(initialState),

  withMethods((store, rolesApi = inject(RolesApiService), router = inject(Router)) => {
    /**
     * GET /v1/roles. A 409 `onboarding_required` redirects to onboarding instead
     * of surfacing a generic conflict; any other failure is exposed through
     * `rolesError` as an i18n key.
     */
    const loadRoles = rxMethod<void>(
      pipe(
        tap(() => patchState(store, { rolesLoading: true, rolesError: null })),
        switchMap(() =>
          rolesApi.getRoles().pipe(
            tap({
              next: (roles) => patchState(store, { roles, rolesLoading: false, rolesLoaded: true }),
              error: (err: HttpErrorResponse) => {
                patchState(store, { rolesLoading: false, rolesLoaded: false });
                if (isOnboardingRequired(err)) {
                  router.navigate(['/onboarding']);
                } else {
                  patchState(store, { rolesError: 'roles.load_error' });
                }
              },
            }),
            catchError(() => of(undefined)),
          ),
        ),
      ),
    );

    /**
     * GET /v1/roles/permissions — lazy and cached. No-op once loaded; after a
     * failure `catalogLoaded` stays false so a retry refetches.
     */
    const loadCatalog = rxMethod<void>(
      pipe(
        switchMap(() => {
          if (store.catalogLoaded() || store.catalogLoading()) return EMPTY;
          patchState(store, { catalogLoading: true, catalogError: null });
          return rolesApi.getPermissionCatalog().pipe(
            tap({
              next: (catalog) =>
                patchState(store, { catalog, catalogLoading: false, catalogLoaded: true }),
              error: () =>
                patchState(store, {
                  catalogLoading: false,
                  catalogError: 'roles.permissions.catalog_error',
                }),
            }),
            catchError(() => of(undefined)),
          );
        }),
      ),
    );

    /**
     * PATCH /roles/{id}/permissions. Returns the Observable untouched (errors
     * propagate) and patches the role from `res.data.permissions` on success.
     */
    const updateRolePermissions = (roleId: number, permissions: string[]) =>
      rolesApi.updateRolePermissions(roleId, permissions).pipe(
        tap((res) =>
          patchState(store, {
            roles: store
              .roles()
              .map((role) =>
                role.id === roleId ? { ...role, permissions: res.data.permissions } : role,
              ),
          }),
        ),
      );

    return { loadRoles, loadCatalog, updateRolePermissions };
  }),
);
