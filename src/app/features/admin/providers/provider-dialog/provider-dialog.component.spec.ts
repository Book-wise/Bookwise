import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { ProviderDialogComponent } from './provider-dialog.component';
import { ReferenceStore } from '@core/stores/reference.store';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
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
  { id: 1, name: 'admin_general', label: 'Admin General' },
  { id: 2, name: 'admin_local', label: 'Admin Local' },
  { id: 3, name: 'recepcionista', label: 'Recepcionista' },
  { id: 4, name: 'recepcionista_readonly', label: 'Recepcionista (solo lectura)' },
  { id: 5, name: 'staff', label: 'Staff' },
  { id: 6, name: 'staff_readonly', label: 'Staff (solo lectura)' },
];

const role = (name: string): Role => allRoles.find((r) => r.name === name)!;

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

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [ProviderDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
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
        { label: 'roles.role.admin_general', value: 'admin_general', disabled: true },
        { label: 'roles.role.admin_local', value: 'admin_local', disabled: false },
        { label: 'roles.role.recepcionista', value: 'recepcionista', disabled: false },
      ]);
    });

    it('pre-selects the current provider roles when editing', () => {
      open('edit', makeProvider({ roles: [role('staff')] }));

      expect(component.form.controls.roleNames.value).toEqual(['staff']);
    });

    it('starts with an empty roles selection when creating', () => {
      open('create', null);

      expect(component.form.controls.roleNames.value).toEqual([]);
    });
  });

  // ── admin_general guard ─────────────────────────────────────────────

  describe('admin_general guard', () => {
    beforeEach(async () => {
      await setup();
    });

    it('re-adds admin_general when its holder tries to remove it (onRolesChange)', () => {
      open('edit', makeProvider({ roles: [role('admin_general'), role('staff')] }));
      const control = component.form.controls.roleNames;

      control.setValue(['staff']);
      component.onRolesChange();

      expect(control.value).toContain('admin_general');
    });

    it('never saves a set without admin_general for its holder', () => {
      rolesApi.assignProviderRoles.mockReturnValue(of({ data: [] }));
      open('edit', makeProvider({ roles: [role('admin_general')] }));
      const control = component.form.controls.roleNames;

      // Intento de quitar admin_general pasando por alto el sanitizador.
      control.setValue(['staff']);
      component.onSave();

      expect(rolesApi.assignProviderRoles).toHaveBeenCalledWith(1, ['staff', 'admin_general']);
    });

    it('drops admin_general when a non-holder tries to save it', () => {
      rolesApi.assignProviderRoles.mockReturnValue(of({ data: [] }));
      open('edit', makeProvider({ roles: [role('staff')] }));
      const control = component.form.controls.roleNames;

      control.setValue(['staff', 'admin_general']);
      component.onSave();

      expect(rolesApi.assignProviderRoles).toHaveBeenCalledWith(1, ['staff']);
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
      const control = component.form.controls.roleNames;

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

    it('shows save_roles_failed toast and does NOT emit saved when roles fail', () => {
      const provider = makeProvider({ roles: [role('staff')] });
      rolesApi.assignProviderRoles.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      open('edit', provider);
      const savedSpy = vi.spyOn(component.saved, 'emit');

      component.onSave();

      expect(savedSpy).not.toHaveBeenCalled();
      expect(component.saving()).toBe(false);
      expect(messageAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: 'providers.save_roles_failed' }),
      );
    });

    it('blocks saving when the roles set is empty (no requests)', () => {
      const provider = makeProvider({ roles: [role('staff')] });
      open('edit', provider);
      const control = component.form.controls.roleNames;

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
      component.onSave();

      expect(providersApi.createProvider).toHaveBeenCalledWith({
        first_name: 'Bruno',
        last_name: 'Díaz',
        email: 'bruno@test.com',
        phone: null,
        active: true,
      });
      expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
      expect(savedSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── View mode ───────────────────────────────────────────────────────

  describe('view mode', () => {
    beforeEach(async () => {
      await setup();
    });

    it('disables the roles control and pre-selects the current roles', () => {
      open('view', makeProvider({ roles: [role('staff'), role('staff_readonly')] }));

      expect(component.form.controls.roleNames.disabled).toBe(true);
      expect(component.form.controls.roleNames.value).toEqual(['staff', 'staff_readonly']);
    });
  });
});
