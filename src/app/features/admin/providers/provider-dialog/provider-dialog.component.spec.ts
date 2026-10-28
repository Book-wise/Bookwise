import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { ProviderDialogComponent } from './provider-dialog.component';
import { ReferenceStore } from '@core/stores/reference.store';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { AuthService } from '@services/auth.service';
import { ABILITIES } from '@shared/config/abilities.config';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { RolesApiService } from '@services/api/roles-api.service';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import type { Provider, Role } from '@models';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const allRoles: Role[] = [
  { id: 1, slug: 'admin_general', name: 'Admin General', permissions: [] },
  { id: 2, slug: 'admin_local', name: 'Admin Local', permissions: [] },
  { id: 3, slug: 'recepcionista', name: 'Recepcionista', permissions: [] },
  { id: 4, slug: 'recepcionista_readonly', name: 'Recepcionista (solo lectura)', permissions: [] },
  { id: 5, slug: 'staff', name: 'Staff', permissions: [] },
  { id: 6, slug: 'staff_readonly', name: 'Staff (solo lectura)', permissions: [] },
];

const role = (slug: string): Role => allRoles.find((r) => r.slug === slug)!;

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 1,
    first_name: 'Ana',
    last_name: 'García',
    email: 'ana@test.com',
    phone: '+56912345678',
    active: true,
    ...overrides,
  };
}

describe('ProviderDialogComponent', () => {
  let store: InstanceType<typeof ReferenceStore>;
  let fixture: ReturnType<typeof TestBed.createComponent<ProviderDialogComponent>>;
  let component: ProviderDialogComponent;
  let providersApi: {
    getProviders: ReturnType<typeof vi.fn>;
    createProvider: ReturnType<typeof vi.fn>;
    updateProvider: ReturnType<typeof vi.fn>;
  };
  let rolesApi: {
    getRoles: ReturnType<typeof vi.fn>;
    assignProviderRoles: ReturnType<typeof vi.fn>;
  };
  let messageAdd: ReturnType<typeof vi.fn>;

  async function setup(
    grantedKeys: string[] = [ABILITIES.providersManage, ABILITIES.providersRoles],
  ) {
    await TestBed.configureTestingModule({
      imports: [ProviderDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: AuthService,
          useValue: {
            hasPermission: (key: string) => grantedKeys.includes(key),
            hasAnyPermission: (...keys: string[]) => keys.some((k) => grantedKeys.includes(k)),
          },
        },
        { provide: ClientsApiService, useValue: { getClients: vi.fn(() => of([])) } },
        {
          provide: LocationsApiService,
          useValue: {
            getLocations: vi.fn(() => of([])),
            getRegions: vi.fn(() => of({ data: [] })),
            getComunas: vi.fn(() => of({ data: [] })),
            getAllComunas: vi.fn(() => of({ data: [] })),
          },
        },
        { provide: ProvidersApiService, useValue: providersApi },
        {
          provide: ServicesApiService,
          useValue: { getServices: vi.fn(() => of([])), getPacks: vi.fn(() => of({ data: [] })) },
        },
        { provide: RolesApiService, useValue: rolesApi },
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
        { provide: MessageService, useValue: { add: messageAdd } },
        {
          provide: LanguageService,
          useValue: { t: (key: string) => key, has: () => true, lang: () => 'es' },
        },
      ],
    }).compileComponents();

    store = TestBed.inject(ReferenceStore);
    fixture = TestBed.createComponent(ProviderDialogComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    messageAdd = vi.fn();
    providersApi = {
      getProviders: vi.fn(() => of([])),
      createProvider: vi.fn(() => of({ message: 'ok', data: makeProvider() })),
      updateProvider: vi.fn(() => of({ message: 'ok', data: makeProvider() })),
    };
    rolesApi = {
      getRoles: vi.fn(() => of(allRoles)),
      assignProviderRoles: vi.fn(() => of({ data: [] })),
    };
  });

  /** Opens the dialog in the given mode for the given provider. */
  function open(mode: 'create' | 'edit' | 'view', provider: Provider | null, catalog = allRoles) {
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('provider', provider);
    fixture.componentRef.setInput('catalogRoles', catalog);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  const payloadFor = (p: Provider) => ({
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    phone: p.phone ?? null,
    active: p.active,
  });

  // ── Catalog + pre-selection ────────────────────────────────────────

  describe('roles catalog and pre-selection', () => {
    beforeEach(async () => {
      await setup();
    });

    it('builds roleOptions from the catalog input', () => {
      open('edit', makeProvider({ roles: [role('staff')] }), allRoles.slice(0, 3));

      expect(component.roleOptions()).toEqual([
        { label: 'roles.role.admin_general', value: 'admin_general', disabled: true, professional: false },
        { label: 'roles.role.admin_local', value: 'admin_local', disabled: false, professional: false },
        { label: 'roles.role.recepcionista', value: 'recepcionista', disabled: false, professional: false },
      ]);
    });

    it('marks staff/staff_readonly as professional', () => {
      open('edit', makeProvider({ roles: [role('staff')] }), [role('staff'), role('recepcionista')]);

      const opts = component.roleOptions();
      expect(opts.find((o) => o.value === 'staff')?.professional).toBe(true);
      expect(opts.find((o) => o.value === 'recepcionista')?.professional).toBe(false);
    });

    it('warns when the role set has roles but no attention role', () => {
      open('edit', makeProvider({ roles: [role('recepcionista')] }), [role('staff'), role('recepcionista')]);

      component.form.controls.roleSlugs.setValue(['recepcionista']);
      expect(component.showNoProfessionalRoleWarning()).toBe(true);

      component.form.controls.roleSlugs.setValue(['staff']);
      expect(component.showNoProfessionalRoleWarning()).toBe(false);
    });

    it('pre-selects the current provider roles when editing', () => {
      open('edit', makeProvider({ roles: [role('staff')] }));

      expect(component.form.controls.roleSlugs.value).toEqual(['staff']);
    });

    it('starts with an empty roles selection when creating', () => {
      open('create', null);

      expect(component.form.controls.roleSlugs.value).toEqual([]);
    });
  });

  // ── admin_general guard ─────────────────────────────────────────────

  describe('admin_general guard', () => {
    beforeEach(async () => {
      await setup();
    });

    it('re-adds admin_general when its holder tries to remove it (onRolesChange)', () => {
      open('edit', makeProvider({ roles: [role('admin_general'), role('staff')] }));
      const control = component.form.controls.roleSlugs;

      control.setValue(['staff']);
      component.onRolesChange();

      expect(control.value).toContain('admin_general');
    });

    it('never saves a set without admin_general for its holder', () => {
      rolesApi.assignProviderRoles.mockReturnValue(of({ data: [] }));
      open('edit', makeProvider({ roles: [role('admin_general')] }));
      const control = component.form.controls.roleSlugs;

      // Intento de quitar admin_general pasando por alto el sanitizador.
      control.setValue(['staff']);
      component.onSave();

      expect(rolesApi.assignProviderRoles).toHaveBeenCalledWith(1, ['staff', 'admin_general']);
    });

    it('drops admin_general when a non-holder tries to save it', () => {
      rolesApi.assignProviderRoles.mockReturnValue(of({ data: [] }));
      open('edit', makeProvider({ roles: [role('staff')] }));
      const control = component.form.controls.roleSlugs;

      control.setValue(['staff', 'admin_general']);
      component.onSave();

      expect(rolesApi.assignProviderRoles).toHaveBeenCalledWith(1, ['staff']);
    });
  });

  // ── RBAC por sección: providers.manage vs providers.roles ──────────

  describe('RBAC por sección', () => {
    it('con solo providers.roles reasigna roles sin tocar los datos', async () => {
      await setup([ABILITIES.providersRoles]);
      rolesApi.assignProviderRoles.mockReturnValue(of({ data: [role('staff')] }));
      open('edit', makeProvider({ roles: [role('staff')] }));
      const savedSpy = vi.spyOn(component.saved, 'emit');

      component.onSave();

      // Comportamiento observable: no se toca el endpoint de datos, sí el de
      // roles, y el diálogo se cierra.
      expect(providersApi.updateProvider).not.toHaveBeenCalled();
      expect(rolesApi.assignProviderRoles).toHaveBeenCalledTimes(1);
      expect(savedSpy).toHaveBeenCalledTimes(1);
    });

    it('con solo providers.roles, un fallo de roles es total (no hubo escritura parcial)', async () => {
      await setup([ABILITIES.providersRoles]);
      rolesApi.assignProviderRoles.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      open('edit', makeProvider({ roles: [role('staff')] }));

      component.onSave();

      expect(messageAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: 'providers.save_roles_failed' }),
      );
    });

    it('sin providers.roles guarda los datos pero no reasigna roles', async () => {
      await setup([ABILITIES.providersManage]);
      open('edit', makeProvider({ roles: [role('staff')] }));
      const savedSpy = vi.spyOn(component.saved, 'emit');

      component.onSave();

      // Comportamiento observable: se patchean los datos, no se tocan los roles
      // y el diálogo se cierra.
      expect(providersApi.updateProvider).toHaveBeenCalled();
      expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
      expect(savedSpy).toHaveBeenCalledTimes(1);
    });

    it('avisa con un error en vez de no hacer nada cuando no tiene ninguna de las dos keys', async () => {
      await setup([]);
      open('edit', makeProvider({ roles: [role('staff')] }));
      const savedSpy = vi.spyOn(component.saved, 'emit');

      component.onSave();

      expect(providersApi.updateProvider).not.toHaveBeenCalled();
      expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
      expect(savedSpy).not.toHaveBeenCalled();
      expect(messageAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: 'providers.save_not_permitted' }),
      );
      expect(component.saving()).toBe(false);
    });
  });

  // ── Edit save: basics → roles (sequential, store-routed) ────────────

  describe('edit save', () => {
    beforeEach(async () => {
      await setup();
    });

    it('saves basics first, then assigns the full roles set via the store', () => {
      const provider = makeProvider({ roles: [role('staff')] });
      rolesApi.assignProviderRoles.mockReturnValue(of({ data: [role('staff'), role('staff_readonly')] }));
      // Preload the store so the canonical-merge assertions have a target.
      providersApi.getProviders.mockReturnValue(of([provider]));
      store.invalidateProviders();
      open('edit', provider);
      const control = component.form.controls.roleSlugs;

      const savedSpy = vi.spyOn(component.saved, 'emit');
      control.setValue(['staff', 'staff_readonly']);
      component.onSave();

      expect(providersApi.updateProvider).toHaveBeenCalledWith(1, payloadFor(provider));
      expect(rolesApi.assignProviderRoles).toHaveBeenCalledWith(1, ['staff', 'staff_readonly']);
      // Basics PATCH completes before the roles PATCH starts.
      const basicsOrder = providersApi.updateProvider.mock.invocationCallOrder[0];
      const rolesOrder = rolesApi.assignProviderRoles.mock.invocationCallOrder[0];
      expect(basicsOrder).toBeLessThan(rolesOrder);
      // Store owns the write: canonical roles land in the store state.
      expect(store.providers()[0].roles).toEqual([role('staff'), role('staff_readonly')]);
      expect(savedSpy).toHaveBeenCalledTimes(1);
      expect(messageAdd).toHaveBeenCalled();
    });

    it('aborts before roles when basics fail (httpError)', () => {
      providersApi.updateProvider.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      open('edit', makeProvider({ roles: [role('staff')] }));
      const savedSpy = vi.spyOn(component.saved, 'emit');

      component.onSave();

      expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
      expect(savedSpy).not.toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });

    it('informa escritura parcial cuando los datos se guardaron y los roles fallaron', () => {
      const provider = makeProvider({ roles: [role('staff')] });
      rolesApi.assignProviderRoles.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      open('edit', provider);
      const savedSpy = vi.spyOn(component.saved, 'emit');

      component.onSave();

      expect(providersApi.updateProvider).toHaveBeenCalled();
      expect(savedSpy).not.toHaveBeenCalled();
      expect(component.saving()).toBe(false);
      expect(messageAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'providers.save_roles_failed_partial',
        }),
      );
    });

    it('blocks saving when the roles set is empty (no requests)', () => {
      const provider = makeProvider({ roles: [role('staff')] });
      open('edit', provider);
      const control = component.form.controls.roleSlugs;

      control.setValue([]);
      fixture.detectChanges(); // flush the form-status signal before asserting
      component.onSave();

      expect(component.showRolesEmptyError()).toBe(true);
      expect(providersApi.updateProvider).not.toHaveBeenCalled();
      expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
    });
  });

  // ── Create save ─────────────────────────────────────────────────────

  describe('create save', () => {
    beforeEach(async () => {
      await setup();
    });

    it('creates via the store without a roles call', () => {
      open('create', null);
      const created = makeProvider({ id: 9 });
      providersApi.createProvider.mockReturnValue(of({ message: 'ok', data: created }));
      const savedSpy = vi.spyOn(component.saved, 'emit');

      component.form.controls.firstName.setValue('Bruno');
      component.form.controls.lastName.setValue('Díaz');
      component.form.controls.email.setValue('bruno@test.com');
      component.form.controls.locationId.setValue(1);
      component.onSave();

      expect(providersApi.createProvider).toHaveBeenCalledWith({
        first_name: 'Bruno',
        last_name: 'Díaz',
        email: 'bruno@test.com',
        phone: null,
        active: true,
        location_id: 1,
      });
      expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
      expect(savedSpy).toHaveBeenCalledTimes(1);
    });

    it('blocks the create when no location is selected (backend requires it)', () => {
      open('create', null);

      component.form.controls.firstName.setValue('Bruno');
      component.form.controls.lastName.setValue('Díaz');
      component.form.controls.email.setValue('bruno@test.com');
      component.onSave();

      expect(component.form.controls.locationId.hasError('required')).toBe(true);
      expect(providersApi.createProvider).not.toHaveBeenCalled();
    });

    it('does not force a location when editing a provider that has none', () => {
      open('edit', makeProvider({ roles: [role('staff')] }));

      expect(component.form.controls.locationId.hasError('required')).toBe(false);
    });
  });

  // ── View mode ───────────────────────────────────────────────────────

  describe('view mode', () => {
    beforeEach(async () => {
      await setup();
    });

    it('disables the roles control and pre-selects the current roles', () => {
      open('view', makeProvider({ roles: [role('staff'), role('staff_readonly')] }));

      expect(component.form.controls.roleSlugs.disabled).toBe(true);
      expect(component.form.controls.roleSlugs.value).toEqual(['staff', 'staff_readonly']);
    });
  });

  // ── Cuota agotada: el CTA de upgrade no queda pegado ────────────────

  describe('capacity limit CTA', () => {
    beforeEach(async () => {
      await setup();
    });

    const quotaError = () =>
      new HttpErrorResponse({
        status: 403,
        error: { error: 'tenant_professional_limit_reached', detail: 'sin cupo' },
      });

    /** Completa el alta mínima válida y dispara el guardado. */
    function submitCreate(): void {
      component.form.controls.firstName.setValue('Bruno');
      component.form.controls.lastName.setValue('Díaz');
      component.form.controls.email.setValue('bruno@test.com');
      component.form.controls.locationId.setValue(1);
      fixture.detectChanges();
      component.onSave();
    }

    it('muestra el CTA y no emite saved cuando el backend rechaza el alta por cuota', () => {
      open('create', null);
      providersApi.createProvider.mockReturnValue(throwError(() => quotaError()));
      const savedSpy = vi.spyOn(component.saved, 'emit');

      submitCreate();

      expect(component.capacityError()).toBe(true);
      expect(savedSpy).not.toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });

    it('limpia el CTA al reabrir el diálogo', () => {
      open('create', null);
      providersApi.createProvider.mockReturnValue(throwError(() => quotaError()));
      submitCreate();
      expect(component.capacityError()).toBe(true);

      fixture.componentRef.setInput('visible', false);
      fixture.detectChanges();
      open('create', null);

      expect(component.capacityError()).toBe(false);
    });

    it('limpia el CTA cuando el reintento sale bien', () => {
      open('create', null);
      providersApi.createProvider.mockReturnValue(throwError(() => quotaError()));
      submitCreate();
      expect(component.capacityError()).toBe(true);

      providersApi.createProvider.mockReturnValue(
        of({ message: 'ok', data: makeProvider({ id: 9 }) }),
      );
      submitCreate();

      expect(component.capacityError()).toBe(false);
    });
  });
});
