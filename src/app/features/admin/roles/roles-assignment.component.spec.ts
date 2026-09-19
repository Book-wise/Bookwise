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
    component.selectedRoleSlugs.set([]);
    component.save();

    expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
    expect(component.error()).toBeTruthy();
  });

  it('blocks removing admin_general (no PATCH)', () => {
    const owner = makeProvider({ roles: [allRoles[0]] });
    seedProviders([owner]);
    fixture.detectChanges();

    component.onProviderChange(1);
    component.selectedRoleSlugs.set(['admin_local']);
    component.save();

    expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
    expect(component.error()).toBeTruthy();
  });

  it('dedupes slugs before sending the PATCH', () => {
    seedProviders([makeProvider()]);
    rolesApi.assignProviderRoles.mockReturnValue(of({ data: [allRoles[1]] }));
    fixture.detectChanges();

    component.onProviderChange(1);
    component.selectedRoleSlugs.set(['admin_local', 'admin_local', 'admin_local']);
    component.save();

    expect(rolesApi.assignProviderRoles).toHaveBeenCalledWith(1, ['admin_local']);
  });

  it('assigns roles via the store and updates the canonical store state', () => {
    const owner = makeProvider({ roles: [allRoles[0]] });
    seedProviders([owner]);
    rolesApi.assignProviderRoles.mockReturnValue(of({ data: [allRoles[0], allRoles[1]] }));
    fixture.detectChanges();

    component.onProviderChange(1);
    component.selectedRoleSlugs.set(['admin_general', 'admin_local']);
    component.save();

    expect(rolesApi.assignProviderRoles).toHaveBeenCalledWith(1, ['admin_general', 'admin_local']);
    expect(store.providers()[0].roles).toEqual([allRoles[0], allRoles[1]]);
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
    component.selectedRoleSlugs.set(['admin_local', 'recepcionista']);
    const callsBefore = providersApi.getProviders.mock.calls.length;

    component.save();

    // Local selection reverts to the current server state.
    expect(component.selectedRoleSlugs()).toEqual(['admin_local']);
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

    const chips = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.provider-summary .role-chip'),
    );
    expect(chips).toHaveLength(2);
    const texts = chips.map((el) => el.textContent?.trim());
    expect(texts).toContain(component.roleLabel(allRoles[0]));
    expect(texts).toContain(component.roleLabel(allRoles[1]));
  });
});
