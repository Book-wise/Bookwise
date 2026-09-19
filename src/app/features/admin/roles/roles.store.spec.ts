import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { RolesStore } from './roles.store';
import { RolesApiService } from '@services/api/roles-api.service';
import type { PermissionGroup, Role } from '@models';

const allRoles: Role[] = [
  { id: 1, slug: 'admin_general', name: 'Admin General', permissions: ['roles.view'] },
  { id: 2, slug: 'admin_local', name: 'Admin Local', permissions: ['bookings.view'] },
  { id: 5, slug: 'staff', name: 'Staff', permissions: ['bookings.view', 'clients.view'] },
];

const catalog: PermissionGroup[] = [
  {
    group: 'bookings',
    items: [
      { key: 'bookings.view', label: 'Ver turnos' },
      { key: 'bookings.create', label: 'Crear turnos' },
    ],
  },
  { group: 'clients', items: [{ key: 'clients.view', label: 'Ver clientes' }] },
];

describe('RolesStore', () => {
  let rolesApi: {
    getRoles: ReturnType<typeof vi.fn>;
    getPermissionCatalog: ReturnType<typeof vi.fn>;
    updateRolePermissions: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof RolesStore>;

  beforeEach(() => {
    rolesApi = {
      getRoles: vi.fn(() => of(allRoles)),
      getPermissionCatalog: vi.fn(() => of(catalog)),
      updateRolePermissions: vi.fn(),
    };
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        RolesStore,
        { provide: RolesApiService, useValue: rolesApi },
        { provide: Router, useValue: router },
      ],
    });

    store = TestBed.inject(RolesStore);
  });

  describe('loadRoles', () => {
    it('loads the role list and marks it loaded', () => {
      store.loadRoles();

      expect(rolesApi.getRoles).toHaveBeenCalledTimes(1);
      expect(store.roles()).toEqual(allRoles);
      expect(store.rolesLoaded()).toBe(true);
      expect(store.rolesLoading()).toBe(false);
      expect(store.rolesError()).toBeNull();
    });

    it('redirects to onboarding on 409 onboarding_required (no generic error)', () => {
      rolesApi.getRoles.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 409, error: { error: 'onboarding_required' } }),
        ),
      );

      store.loadRoles();

      expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
      expect(store.rolesError()).toBeNull();
      expect(store.rolesLoaded()).toBe(false);
    });

    it('exposes an i18n error key for any other failure', () => {
      rolesApi.getRoles.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'boom' } })),
      );

      store.loadRoles();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(store.rolesError()).toBe('roles.load_error');
      expect(store.rolesLoading()).toBe(false);
    });
  });

  describe('loadCatalog', () => {
    it('fetches the catalog once and caches it', () => {
      store.loadCatalog();
      store.loadCatalog();

      expect(rolesApi.getPermissionCatalog).toHaveBeenCalledTimes(1);
      expect(store.catalog()).toEqual(catalog);
      expect(store.catalogLoaded()).toBe(true);
      expect(store.catalogLoading()).toBe(false);
    });

    it('stays retryable after a catalog failure', () => {
      rolesApi.getPermissionCatalog.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 500, error: {} })),
      );

      store.loadCatalog();

      expect(store.catalogError()).toBe('roles.permissions.catalog_error');
      expect(store.catalogLoaded()).toBe(false);

      store.loadCatalog();

      expect(rolesApi.getPermissionCatalog).toHaveBeenCalledTimes(2);
      expect(store.catalog()).toEqual(catalog);
      expect(store.catalogLoaded()).toBe(true);
      expect(store.catalogError()).toBeNull();
    });
  });

  describe('updateRolePermissions', () => {
    it('patches the role from res.data.permissions on success', () => {
      store.loadRoles();
      const updated = ['bookings.view', 'bookings.create'];
      rolesApi.updateRolePermissions.mockReturnValue(
        of({ data: { role_id: 5, slug: 'staff', permissions: updated } }),
      );

      let emitted: unknown;
      store.updateRolePermissions(5, updated).subscribe((res) => (emitted = res));

      expect(rolesApi.updateRolePermissions).toHaveBeenCalledWith(5, updated);
      expect(emitted).toBeTruthy();
      expect(store.roles().find((r) => r.id === 5)?.permissions).toEqual(updated);
      // Untouched roles keep their permissions.
      expect(store.roles().find((r) => r.id === 2)?.permissions).toEqual(['bookings.view']);
    });

    it('re-throws the raw HttpErrorResponse (e.g. 422) without touching state', () => {
      store.loadRoles();
      const before = store.roles();
      const error = new HttpErrorResponse({ status: 422, error: { error: 'validation_error' } });
      rolesApi.updateRolePermissions.mockReturnValue(throwError(() => error));

      let caught: unknown;
      store.updateRolePermissions(5, ['unknown.key']).subscribe({ error: (err) => (caught = err) });

      expect(caught).toBe(error);
      expect(store.roles()).toEqual(before);
    });
  });
});
