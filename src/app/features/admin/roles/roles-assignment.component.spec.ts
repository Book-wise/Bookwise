import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { RolesAssignmentComponent } from './roles-assignment.component';
import { RolesStore } from './roles.store';
import { RolesApiService } from '@services/api/roles-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { ReferenceStore } from '@core/stores/reference.store';
import type { Provider, Role } from '@models';

const allRoles: Role[] = [
  { id: 1, slug: 'admin_general', name: 'Admin General', permissions: [] },
  { id: 2, slug: 'admin_local', name: 'Admin Local', permissions: [] },
  { id: 3, slug: 'recepcionista', name: 'Recepcionista', permissions: [] },
  { id: 4, slug: 'recepcionista_readonly', name: 'Recepcionista (solo lectura)', permissions: [] },
  { id: 5, slug: 'staff', name: 'Staff', permissions: [] },
  { id: 6, slug: 'staff_readonly', name: 'Staff (solo lectura)', permissions: [] },
];

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 1,
    first_name: 'Ana',
    last_name: 'García',
    email: 'ana@test.com',
    active: true,
    ...overrides,
  };
}

describe('RolesAssignmentComponent', () => {
  let rolesApi: {
    getRoles: ReturnType<typeof vi.fn>;
    assignProviderRoles: ReturnType<typeof vi.fn>;
  };
  let providersApi: { getProviders: ReturnType<typeof vi.fn> };
  let httpError: { handle: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof ReferenceStore>;
  let fixture: ComponentFixture<RolesAssignmentComponent>;
  let component: RolesAssignmentComponent;

  beforeEach(async () => {
    rolesApi = {
      getRoles: vi.fn(() => of(allRoles)),
      assignProviderRoles: vi.fn(),
    };
    providersApi = { getProviders: vi.fn(() => of([])) };
    httpError = { handle: vi.fn() };

    const fakeRolesStore = {
      roles: signal<Role[]>(allRoles),
      rolesLoading: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [RolesAssignmentComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: RolesStore, useValue: fakeRolesStore },
        { provide: RolesApiService, useValue: rolesApi },
        { provide: ProvidersApiService, useValue: providersApi },
        {
          provide: LocationsApiService,
          useValue: {
            getLocations: vi.fn(() => of([])),
            getRegions: vi.fn(() => of({ data: [] })),
            getAllComunas: vi.fn(() => of({ data: [] })),
          },
        },
        {
          provide: ServicesApiService,
          useValue: { getServices: vi.fn(() => of([])), getPacks: vi.fn(() => of({ data: [] })) },
        },
        { provide: ClientsApiService, useValue: { getClients: vi.fn(() => of([])) } },
        { provide: HttpErrorService, useValue: httpError },
      ],
    }).compileComponents();

    store = TestBed.inject(ReferenceStore);
    fixture = TestBed.createComponent(RolesAssignmentComponent);
    component = fixture.componentInstance;
  });

  /** Seeds providers in the real ReferenceStore (canonical source for this screen). */
  function seedProviders(providers: Provider[]): void {
    providersApi.getProviders.mockReturnValue(of(providers));
    store.invalidateProviders();
  }

  it('renders the six business roles keyed by slug', () => {
    fixture.detectChanges();

    expect(component.roles().length).toBe(6);
    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.role-label'),
    ).map((el) => el.textContent?.trim());
    expect(labels).toHaveLength(6);
  });

  it('renders the role cards reference section with resolved descriptions', () => {
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const cards = Array.from(nativeEl.querySelectorAll('.role-card'));
    expect(cards).toHaveLength(6);

    const descs = Array.from(nativeEl.querySelectorAll('.role-card__desc')).map((el) =>
      el.textContent?.trim(),
    );
    expect(descs).toHaveLength(6);
    expect(descs[0]).toBeTruthy();
    expect(descs[0]).not.toBe(component.roleLabel(allRoles[0]));

    // The first card (admin_general) renders a colored circular badge holding a
    // Lucide glyph. `stroke="currentColor"` is what lets the white badge color
    // paint the icon.
    const badge = nativeEl.querySelector<HTMLElement>('.role-card bw-role-badge');
    expect(badge?.style.background).toBe('rgb(11, 61, 149)');
    const glyph = badge?.querySelector('lucide-icon svg');
    expect(glyph).toBeTruthy();
    expect(glyph?.getAttribute('stroke')).toBe('currentColor');
  });

  it('renders a single-select radio (not a checkbox) beside every role badge', () => {
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    expect(nativeEl.querySelectorAll('.role-item p-radiobutton')).toHaveLength(6);
    expect(nativeEl.querySelectorAll('.role-item p-checkbox')).toHaveLength(0);
    expect(nativeEl.querySelectorAll('.role-item bw-role-badge')).toHaveLength(6);
  });

  it('falls back to the backend name when the slug has no i18n key', () => {
    const unknownRole: Role = {
      id: 99,
      slug: 'custom_role',
      name: 'Custom Role',
      permissions: [],
    };

    expect(component.roleLabel(unknownRole)).toBe('Custom Role');
  });

  it('reads providers from ReferenceStore (no local providersApi load)', () => {
    seedProviders([makeProvider({ id: 7 })]);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.providers()).toEqual([makeProvider({ id: 7 })]);
    expect(providersApi.getProviders).toHaveBeenCalled();
  });

  it('blocks saving an empty selection (no PATCH)', () => {
    seedProviders([makeProvider()]);
    fixture.detectChanges();

    component.onProviderChange(1);
    component.selectedRoleSlug.set(null);
    component.save();

    expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
    expect(component.error()).toBeTruthy();
  });

  it('seeds the radio selection from the provider current role', () => {
    const provider = makeProvider({ roles: [allRoles[2]] });
    seedProviders([provider]);
    fixture.detectChanges();

    component.onProviderChange(1);

    expect(component.selectedRoleSlug()).toBe('recepcionista');
    expect(component.isRoleSelected('recepcionista')).toBe(true);
    expect(component.isRoleSelected('admin_local')).toBe(false);
  });

  it('locks a provider that holds admin_general to that role (cannot move)', () => {
    const owner = makeProvider({ roles: [allRoles[0]] });
    seedProviders([owner]);
    fixture.detectChanges();

    component.onProviderChange(1);
    expect(component.selectedRoleSlug()).toBe('admin_general');
    expect(component.isRoleLocked('admin_general')).toBe(false);
    expect(component.isRoleLocked('admin_local')).toBe(true);

    // The handler is a no-op for every other role.
    component.onRoleChange('admin_local');
    expect(component.selectedRoleSlug()).toBe('admin_general');

    // Even a forced selection is rejected by the save-time invariant.
    component.selectedRoleSlug.set('admin_local');
    component.save();

    expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
    expect(component.error()).toBeTruthy();
  });

  it('blocks selecting admin_general for a provider that does not hold it', () => {
    const provider = makeProvider({ roles: [allRoles[1]] });
    seedProviders([provider]);
    fixture.detectChanges();

    component.onProviderChange(1);
    expect(component.isRoleLocked('admin_general')).toBe(true);
    expect(component.isRoleLocked('admin_local')).toBe(false);

    component.onRoleChange('admin_general');
    expect(component.selectedRoleSlug()).toBe('admin_local');

    // Even a forced selection is rejected by the save-time invariant.
    component.selectedRoleSlug.set('admin_general');
    component.save();
    expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
    expect(component.error()).toBeTruthy();
  });

  it('sends a one-element array for the selected role', () => {
    seedProviders([makeProvider()]);
    rolesApi.assignProviderRoles.mockReturnValue(of({ data: [allRoles[1]] }));
    fixture.detectChanges();

    component.onProviderChange(1);
    component.selectedRoleSlug.set('admin_local');
    component.save();

    expect(rolesApi.assignProviderRoles).toHaveBeenCalledWith(1, ['admin_local']);
  });

  it('assigns a single role via the store and updates the canonical store state', () => {
    const provider = makeProvider({ roles: [allRoles[1]] });
    seedProviders([provider]);
    rolesApi.assignProviderRoles.mockReturnValue(of({ data: [allRoles[2]] }));
    fixture.detectChanges();

    component.onProviderChange(1);
    component.onRoleChange('recepcionista');
    component.save();

    expect(rolesApi.assignProviderRoles).toHaveBeenCalledWith(1, ['recepcionista']);
    expect(store.providers()[0].roles).toEqual([allRoles[2]]);
    expect(component.saving()).toBe(false);
  });

  it('reverts the selection and refetches providers on 422', () => {
    const owner = makeProvider({ roles: [allRoles[1]] });
    seedProviders([owner]);
    rolesApi.assignProviderRoles.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { error: 'invalid_input' } })),
    );
    fixture.detectChanges();

    component.onProviderChange(1);
    component.selectedRoleSlug.set('recepcionista');
    const callsBefore = providersApi.getProviders.mock.calls.length;

    component.save();

    // Local selection reverts to the current server state.
    expect(component.selectedRoleSlug()).toBe('admin_local');
    // Providers are refetched.
    expect(providersApi.getProviders.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(httpError.handle).toHaveBeenCalled();
    expect(component.saving()).toBe(false);
  });

  it('builds providerOptions with a searchable name + role label and numeric ids', () => {
    const provider = makeProvider({ id: 7, roles: [allRoles[0], allRoles[1]] });
    seedProviders([provider]);
    fixture.detectChanges();
    fixture.detectChanges();

    const opts = component.providerOptions();
    expect(opts).toHaveLength(1);
    expect(opts[0].id).toBe(7);
    expect(opts[0].name).toBe('Ana García');
    expect(opts[0].email).toBe('ana@test.com');
    expect(opts[0].label).toBe(
      `Ana García · ${component.roleLabel(allRoles[0])}, ${component.roleLabel(allRoles[1])}`,
    );
  });

  it('renders a role chip row under the selected provider with its current roles', () => {
    const provider = makeProvider({ roles: [allRoles[0], allRoles[1]] });
    seedProviders([provider]);
    fixture.detectChanges();

    component.onProviderChange(1);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const chips = Array.from(nativeEl.querySelectorAll('.provider-summary .role-chip'));
    expect(chips).toHaveLength(2);
    const texts = chips.map((el) => el.textContent?.trim());
    expect(texts).toContain(component.roleLabel(allRoles[0]));
    expect(texts).toContain(component.roleLabel(allRoles[1]));

    // Each chip identifies the role with the shared badge, not a plain dot.
    expect(nativeEl.querySelectorAll('.provider-summary .role-chip bw-role-badge')).toHaveLength(2);
  });
});
