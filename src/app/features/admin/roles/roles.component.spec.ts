import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { RolesComponent } from './roles.component';
import { RolesApiService } from '@services/api/roles-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { HttpErrorService } from '@services/http-error.service';
import type { PermissionGroup, Role } from '@models';

// PrimeNG TabList binds a ResizeObserver on init; jsdom does not provide one.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {
      /* test no-op */
    }
    unobserve() {
      /* test no-op */
    }
    disconnect() {
      /* test no-op */
    }
  } as typeof ResizeObserver;
}

const allRoles: Role[] = [
  { id: 1, slug: 'admin_general', name: 'Admin General', permissions: [] },
  { id: 2, slug: 'admin_local', name: 'Admin Local', permissions: [] },
  { id: 3, slug: 'recepcionista', name: 'Recepcionista', permissions: [] },
  { id: 4, slug: 'recepcionista_readonly', name: 'Recepcionista (solo lectura)', permissions: [] },
  { id: 5, slug: 'staff', name: 'Staff', permissions: [] },
  { id: 6, slug: 'staff_readonly', name: 'Staff (solo lectura)', permissions: [] },
];

const catalog: PermissionGroup[] = [
  { group: 'bookings', items: [{ key: 'bookings.view', label: 'Ver turnos' }] },
];

describe('RolesComponent (shell)', () => {
  let rolesApi: {
    getRoles: ReturnType<typeof vi.fn>;
    getPermissionCatalog: ReturnType<typeof vi.fn>;
    updateRolePermissions: ReturnType<typeof vi.fn>;
  };
  let providersApi: { getProviders: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    rolesApi = {
      getRoles: vi.fn(() => of(allRoles)),
      getPermissionCatalog: vi.fn(() => of(catalog)),
      updateRolePermissions: vi.fn(),
    };
    providersApi = { getProviders: vi.fn(() => of([])) };
    router = { navigate: vi.fn() };

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
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });

  function createFixture(): ComponentFixture<RolesComponent> {
    const fixture = TestBed.createComponent(RolesComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('loads GET /v1/roles exactly once on init', () => {
    createFixture();

    expect(rolesApi.getRoles).toHaveBeenCalledTimes(1);
  });

  it('renders the Asignación and Permisos tabs', () => {
    const fixture = createFixture();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Asignación');
    expect(text).toContain('Permisos');
  });

  it('defaults to the assignment tab and mounts both panes', () => {
    const fixture = createFixture();
    const nativeEl = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.activeTab()).toBe('assignment');
    expect(nativeEl.querySelector('bw-roles-assignment')).toBeTruthy();
    expect(nativeEl.querySelector('bw-role-permissions')).toBeTruthy();
  });

  it('switches the active tab through onTabChange', () => {
    const fixture = createFixture();

    fixture.componentInstance.onTabChange('permissions');

    expect(fixture.componentInstance.activeTab()).toBe('permissions');
  });

  it('redirects to onboarding when GET /v1/roles responds 409 onboarding_required', () => {
    rolesApi.getRoles.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { error: 'onboarding_required' } }),
      ),
    );

    createFixture();

    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });
});
