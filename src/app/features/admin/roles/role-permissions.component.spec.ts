import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NgModel } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { RolePermissionsComponent } from './role-permissions.component';
import { RolesStore } from './roles.store';
import { HttpErrorService } from '@services/http-error.service';
import type { PermissionGroup, Role } from '@models';

const allRoles: Role[] = [
  { id: 1, slug: 'admin_general', name: 'Admin General', permissions: ['roles.view'] },
  {
    id: 2,
    slug: 'admin_local',
    name: 'Admin Local',
    permissions: ['bookings.view', 'clients.view'],
  },
  { id: 5, slug: 'staff', name: 'Staff', permissions: ['bookings.view'] },
];

const catalog: PermissionGroup[] = [
  {
    group: 'bookings',
    items: [
      { key: 'bookings.view', label: 'Ver turnos' },
      { key: 'bookings.create', label: 'Crear turnos' },
    ],
  },
  {
    group: 'clients',
    items: [{ key: 'clients.view', label: 'Ver clientes' }],
  },
];

describe('RolePermissionsComponent', () => {
  let rolesSig: ReturnType<typeof signal<Role[]>>;
  let catalogSig: ReturnType<typeof signal<PermissionGroup[]>>;
  let catalogLoadingSig: ReturnType<typeof signal<boolean>>;
  let catalogErrorSig: ReturnType<typeof signal<string | null>>;
  let loadCatalog: ReturnType<typeof vi.fn>;
  let loadRoles: ReturnType<typeof vi.fn>;
  let updateRolePermissions: ReturnType<typeof vi.fn>;
  let confirmation: {
    confirm: ReturnType<typeof vi.fn>;
    requireConfirmation$: Subject<unknown>;
    close: ReturnType<typeof vi.fn>;
  };
  let httpError: { handle: ReturnType<typeof vi.fn> };
  let messageService: { add: ReturnType<typeof vi.fn> };

  let fixture: ComponentFixture<RolePermissionsComponent>;
  let component: RolePermissionsComponent;

  beforeEach(async () => {
    rolesSig = signal<Role[]>(allRoles);
    catalogSig = signal<PermissionGroup[]>(catalog);
    catalogLoadingSig = signal(false);
    catalogErrorSig = signal<string | null>(null);
    loadCatalog = vi.fn();
    loadRoles = vi.fn();
    updateRolePermissions = vi.fn();
    confirmation = {
      confirm: vi.fn(),
      requireConfirmation$: new Subject<unknown>(),
      close: vi.fn(),
    };
    httpError = { handle: vi.fn() };
    messageService = { add: vi.fn() };

    const fakeStore = {
      roles: rolesSig,
      catalog: catalogSig,
      catalogLoading: catalogLoadingSig,
      catalogError: catalogErrorSig,
      loadCatalog,
      loadRoles,
      updateRolePermissions,
    };

    await TestBed.configureTestingModule({
      imports: [RolePermissionsComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: RolesStore, useValue: fakeStore },
        { provide: HttpErrorService, useValue: httpError },
        { provide: MessageService, useValue: messageService },
      ],
    })
      .overrideComponent(RolePermissionsComponent, {
        set: { providers: [{ provide: ConfirmationService, useValue: confirmation }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RolePermissionsComponent);
    component = fixture.componentInstance;
  });

  /** The `NgModel` bound to the mobile role select. */
  function selectNgModel(): NgModel {
    const select = fixture.debugElement.query(By.css('p-select.role-select'));
    return select.injector.get(NgModel);
  }

  it('requests the catalog on init', () => {
    fixture.detectChanges();

    expect(loadCatalog).toHaveBeenCalledTimes(1);
  });

  it('renders the catalog groups and items dynamically (no hardcoded values)', () => {
    fixture.detectChanges();
    const nativeEl = fixture.nativeElement as HTMLElement;

    expect(nativeEl.querySelectorAll('.permission-group')).toHaveLength(catalog.length);
    expect(nativeEl.querySelectorAll('.permission-item')).toHaveLength(3);
    const text = nativeEl.textContent ?? '';
    expect(text).toContain('Turnos');
    expect(text).toContain('Clientes');
  });

  it('preselects the first role permissions by default', () => {
    fixture.detectChanges();

    expect(component.selectedRole()?.slug).toBe('admin_general');
    expect(component.draft()).toEqual(['roles.view']);
    expect(component.isSelected('roles.view')).toBe(true);
    expect(component.isSelected('bookings.view')).toBe(false);
  });

  it('reselects the draft when another role is chosen', () => {
    fixture.detectChanges();

    component.selectRole(allRoles[2]);
    fixture.detectChanges();

    expect(component.selectedRole()?.slug).toBe('staff');
    expect(component.draft()).toEqual(['bookings.view']);
  });

  it('renders the mobile role select with the role options and reflects the active role', () => {
    fixture.detectChanges();
    const nativeEl = fixture.nativeElement as HTMLElement;

    expect(nativeEl.querySelector('p-select.role-select')).toBeTruthy();
    expect(component.roleOptions()).toEqual([
      { slug: 'admin_general', label: component.roleLabel(allRoles[0]), icon: 'pi-shield' },
      { slug: 'admin_local', label: component.roleLabel(allRoles[1]), icon: 'pi-building' },
      { slug: 'staff', label: component.roleLabel(allRoles[2]), icon: 'pi-users' },
    ]);
    expect(selectNgModel().model).toBe('admin_general');

    component.selectRoleBySlug('staff');
    fixture.detectChanges();

    expect(selectNgModel().model).toBe('staff');
  });

  it('switches the active role and detail when another role is chosen in the select', () => {
    fixture.detectChanges();
    const nativeEl = fixture.nativeElement as HTMLElement;

    // Emulates the user picking "Staff" in the p-select (ngModelChange output).
    selectNgModel().update.emit('staff');
    fixture.detectChanges();

    expect(component.selectedRole()?.slug).toBe('staff');
    expect(component.draft()).toEqual(['bookings.view']);
    expect(component.isAdminGeneralLocked()).toBe(false);
    expect(nativeEl.querySelector('.permissions-lock')).toBeNull();
  });

  it('resolves permission labels via i18n with backend label and raw-key fallbacks', () => {
    const unknown = { key: 'custom.thing', label: 'Custom Thing' };
    const emptyLabel = { key: 'custom.empty', label: '' };

    expect(component.permissionLabel({ key: 'bookings.view', label: 'Ver turnos' })).toBe(
      'Ver turnos',
    );
    expect(component.permissionLabel(unknown)).toBe('Custom Thing');
    expect(component.permissionLabel(emptyLabel)).toBe('custom.empty');
  });

  it('resolves group labels via i18n with a raw-slug fallback', () => {
    expect(component.permissionGroupLabel('bookings')).toBe('Turnos');
    expect(component.permissionGroupLabel('unknown_group')).toBe('unknown_group');
  });

  it('dedupes keys before sending the PATCH', () => {
    updateRolePermissions.mockReturnValue(
      of({ data: { role_id: 5, slug: 'staff', permissions: ['bookings.view'] } }),
    );
    fixture.detectChanges();
    component.selectRole(allRoles[2]);

    component.draft.set(['bookings.view', 'bookings.view', 'roles.view']);
    component.save();

    expect(updateRolePermissions).toHaveBeenCalledWith(5, ['bookings.view', 'roles.view']);
  });

  it('emits the success toast on the global key so the app shell renders it', () => {
    updateRolePermissions.mockReturnValue(
      of({ data: { role_id: 5, slug: 'staff', permissions: ['bookings.view'] } }),
    );
    fixture.detectChanges();
    component.selectRole(allRoles[2]);

    component.draft.set(['bookings.view']);
    component.save();

    // Without `key: 'global'` PrimeNG routes the toast to the keyless toast,
    // which the admin layout does not render, so the message is silently lost.
    expect(messageService.add).toHaveBeenCalledTimes(1);
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', key: 'global' }),
    );
  });

  it('requires confirmation before clearing all permissions', () => {
    updateRolePermissions.mockReturnValue(
      of({ data: { role_id: 5, slug: 'staff', permissions: [] } }),
    );
    fixture.detectChanges();
    component.selectRole(allRoles[2]);

    component.draft.set([]);
    component.save();

    expect(updateRolePermissions).not.toHaveBeenCalled();
    expect(confirmation.confirm).toHaveBeenCalledTimes(1);

    const config = confirmation.confirm.mock.calls[0][0] as { accept: () => void };
    config.accept();

    expect(updateRolePermissions).toHaveBeenCalledWith(5, []);
  });

  it('reverts the draft and refetches roles on 422', () => {
    updateRolePermissions.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { error: 'validation_error' } }),
      ),
    );
    fixture.detectChanges();
    component.selectRole(allRoles[2]);

    component.draft.set(['bookings.view', 'clients.view']);
    component.save();

    // The role was never patched optimistically: the draft reverts to the store values.
    expect(component.draft()).toEqual(['bookings.view']);
    expect(loadRoles).toHaveBeenCalledTimes(1);
    expect(httpError.handle).toHaveBeenCalled();
    expect(component.saving()).toBe(false);
  });

  it('locks the admin_general matrix: toggles are a no-op', () => {
    fixture.detectChanges();

    expect(component.selectedRole()?.slug).toBe('admin_general');
    expect(component.isAdminGeneralLocked()).toBe(true);

    component.togglePermission('bookings.view', true);
    component.togglePermission('roles.view', false);

    expect(component.draft()).toEqual(['roles.view']);
  });

  it('never calls the store when saving the locked admin_general role', () => {
    fixture.detectChanges();

    component.save();

    expect(updateRolePermissions).not.toHaveBeenCalled();
    expect(confirmation.confirm).not.toHaveBeenCalled();
  });

  it('still toggles and saves a non-locked role normally', () => {
    updateRolePermissions.mockReturnValue(
      of({ data: { role_id: 5, slug: 'staff', permissions: ['bookings.view', 'clients.view'] } }),
    );
    fixture.detectChanges();

    component.selectRole(allRoles[2]);
    fixture.detectChanges();
    expect(component.isAdminGeneralLocked()).toBe(false);

    component.togglePermission('clients.view', true);
    expect(component.draft()).toEqual(['bookings.view', 'clients.view']);

    component.save();

    expect(updateRolePermissions).toHaveBeenCalledWith(5, ['bookings.view', 'clients.view']);
  });

  it('renders the lock indicator only for the locked role', () => {
    fixture.detectChanges();
    const nativeEl = fixture.nativeElement as HTMLElement;

    expect(nativeEl.querySelector('.permissions-lock')).toBeTruthy();
    expect(nativeEl.querySelector('.permissions-lock .pi-lock')).toBeTruthy();
    expect(nativeEl.textContent ?? '').toContain(
      component.lang.t('roles.permissions.admin_general_locked'),
    );

    component.selectRole(allRoles[2]);
    fixture.detectChanges();

    expect(nativeEl.querySelector('.permissions-lock')).toBeNull();
  });

  it('shows the persistent deferred-enforcement warning and no restore control', () => {
    fixture.detectChanges();
    const nativeEl = fixture.nativeElement as HTMLElement;
    const text = nativeEl.textContent ?? '';

    expect(text).toContain(component.lang.t('roles.permissions.warning'));
    expect(text).not.toMatch(/restaurar|restore/i);
    expect(nativeEl.querySelector('.restore-baseline')).toBeNull();
  });

  it('renders an error state with retry and hides the matrix when the catalog errors', () => {
    catalogSig.set([]);
    catalogErrorSig.set('roles.permissions.catalog_error');
    fixture.detectChanges();
    const nativeEl = fixture.nativeElement as HTMLElement;

    expect(nativeEl.querySelector('.catalog-state')).toBeTruthy();
    expect(nativeEl.querySelector('.matrix')).toBeNull();
    expect(nativeEl.querySelector('.save-btn')).toBeNull();

    const retry = nativeEl.querySelector('.catalog-state button') as HTMLButtonElement | null;
    expect(retry?.textContent).toContain('Reintentar');
    retry?.click();

    expect(loadCatalog).toHaveBeenCalledTimes(2);
  });

  it('renders an empty state and hides the matrix when the catalog has zero groups', () => {
    catalogSig.set([]);
    fixture.detectChanges();
    const nativeEl = fixture.nativeElement as HTMLElement;

    expect(nativeEl.querySelector('.catalog-state')).toBeTruthy();
    expect(nativeEl.querySelector('.matrix')).toBeNull();
    expect(nativeEl.textContent ?? '').toContain(
      component.lang.t('roles.permissions.catalog_empty'),
    );
  });
});
