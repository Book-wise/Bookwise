import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { RolesComponent } from './roles.component';
import { RolesApiService } from '@services/api/roles-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { ReferenceStore } from '@core/stores/reference.store';
import type { Provider, Role } from '@models';

const allRoles: Role[] = [
  { id: 1, name: 'admin_general', label: 'Admin General' },
  { id: 2, name: 'admin_local', label: 'Admin Local' },
  { id: 3, name: 'recepcionista', label: 'Recepcionista' },
  { id: 4, name: 'recepcionista_readonly', label: 'Recepcionista (solo lectura)' },
  { id: 5, name: 'staff', label: 'Staff' },
  { id: 6, name: 'staff_readonly', label: 'Staff (solo lectura)' },
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

describe('RolesComponent', () => {
  let rolesApi: {
    getRoles: ReturnType<typeof vi.fn>;
    assignProviderRoles: ReturnType<typeof vi.fn>;
  };
  let providersApi: { getProviders: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof ReferenceStore>;
  let fixture: ReturnType<typeof TestBed.createComponent<RolesComponent>>;
  let component: RolesComponent;

  beforeEach(async () => {
    rolesApi = {
      getRoles: vi.fn(() => of(allRoles)),
      assignProviderRoles: vi.fn(),
    };
    providersApi = { getProviders: vi.fn(() => of([])) };

    await TestBed.configureTestingModule({
      imports: [RolesComponent],
      providers: [
        provideZonelessChangeDetection(),
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
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
      ],
    }).compileComponents();

    store = TestBed.inject(ReferenceStore);
    fixture = TestBed.createComponent(RolesComponent);
    component = fixture.componentInstance;
  });

  /**
   * Seeds providers in the real ReferenceStore (U6: canonical source for this
   * screen — the component no longer fetches providers on its own).
   */
  function seedProviders(providers: Provider[]): void {
    providersApi.getProviders.mockReturnValue(of(providers));
    store.invalidateProviders();
  }

  it('renders the six business roles', () => {
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
    // Las descripciones provienen de i18n (`roles.card.desc.<name>`), nunca del label.
    expect(descs[0]).toBeTruthy();
    expect(descs[0]).not.toBe(component.roleLabel(allRoles[0].name));
  });

  it('reads providers from ReferenceStore (no local providersApi load)', () => {
    seedProviders([makeProvider({ id: 7 })]);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.providers()).toEqual([makeProvider({ id: 7 })]);
    // Only the store loader called the API — the component never fetched on its own.
    expect(providersApi.getProviders).toHaveBeenCalled();
  });

  it('blocks saving an empty selection (no PATCH)', () => {
    seedProviders([makeProvider()]);
    fixture.detectChanges();

    component.onProviderChange(1);
    component.selectedRoleNames.set([]);
    component.save();

    expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
    expect(component.error()).toBeTruthy();
  });

  it('blocks removing admin_general (no PATCH)', () => {
    const owner = makeProvider({ roles: [allRoles[0]] });
    seedProviders([owner]);
    fixture.detectChanges();

    component.onProviderChange(1);
    // Intento de quitar admin_general del set seleccionado.
    component.selectedRoleNames.set(['admin_local']);
    component.save();

    expect(rolesApi.assignProviderRoles).not.toHaveBeenCalled();
    expect(component.error()).toBeTruthy();
  });

  it('assigns roles via the store and updates the canonical store state', () => {
    const owner = makeProvider({ roles: [allRoles[0]] });
    seedProviders([owner]);
    rolesApi.assignProviderRoles.mockReturnValue(of({ data: [allRoles[0], allRoles[1]] }));
    fixture.detectChanges();

    component.onProviderChange(1);
    component.selectedRoleNames.set(['admin_general', 'admin_local']);
    component.save();

    expect(rolesApi.assignProviderRoles).toHaveBeenCalledWith(1, ['admin_general', 'admin_local']);
    // El store patcha `providers` con el set canónico del server (sin patch manual).
    expect(store.providers()[0].roles).toEqual([allRoles[0], allRoles[1]]);
    expect(component.saving()).toBe(false);
  });
});
