import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { HttpErrorService } from '@services/http-error.service';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { RolesApiService } from '@services/api/roles-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { LocationDialogComponent } from './location-dialog.component';
import type { Location } from '@models';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseLocation = (overrides: Partial<Location> = {}): Location => ({
  id: 1,
  name: 'Sucursal Centro',
  address: 'Av. Siempre Viva 123',
  city: 'Santiago',
  timezone: 'America/Santiago',
  region_id: 7,
  comuna_id: 86,
  active: true,
  ...overrides,
});

describe('LocationDialogComponent', () => {
  let store: InstanceType<typeof ReferenceStore>;
  let fixture: ReturnType<typeof TestBed.createComponent<LocationDialogComponent>>;
  let component: LocationDialogComponent;
  let locationsApi: {
    getLocations: ReturnType<typeof vi.fn>;
    createLocation: ReturnType<typeof vi.fn>;
    updateLocation: ReturnType<typeof vi.fn>;
    getRegions: ReturnType<typeof vi.fn>;
    getAllComunas: ReturnType<typeof vi.fn>;
  };
  let messageAdd: ReturnType<typeof vi.fn>;
  let httpErrorHandle: ReturnType<typeof vi.fn>;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [LocationDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: LocationsApiService, useValue: locationsApi },
        { provide: ProvidersApiService, useValue: { getProviders: vi.fn(() => of([])) } },
        { provide: RolesApiService, useValue: { getRoles: vi.fn(() => of([])) } },
        {
          provide: ServicesApiService,
          useValue: { getServices: vi.fn(() => of([])), getPacks: vi.fn(() => of({ data: [] })) },
        },
        { provide: ClientsApiService, useValue: { getClients: vi.fn(() => of([])) } },
        { provide: HttpErrorService, useValue: { handle: httpErrorHandle } },
        { provide: MessageService, useValue: { add: messageAdd } },
      ],
    }).compileComponents();

    store = TestBed.inject(ReferenceStore);
    fixture = TestBed.createComponent(LocationDialogComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    messageAdd = vi.fn();
    httpErrorHandle = vi.fn();
    locationsApi = {
      getLocations: vi.fn(() => of([])),
      createLocation: vi.fn(() => of({ message: 'ok', data: baseLocation() })),
      updateLocation: vi.fn(() => of({ message: 'ok', data: baseLocation() })),
      getRegions: vi.fn(() => of({ data: [] })),
      getAllComunas: vi.fn(() => of({ data: [] })),
    };
  });

  /** Opens the dialog in the given mode for the given location. */
  function open(mode: 'create' | 'edit' | 'view', location: Location | null) {
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('location', location);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  const required = { name: 'Sucursal Norte', address: 'Av. Norte 1', city: 'Santiago', regionId: 7 };

  // ── Save via store (U6 migration: create/update store-routed) ────────

  describe('save via ReferenceStore', () => {
    beforeEach(async () => {
      await setup();
    });

    it('create mode calls refStore.createLocation (POST through the store) and emits saved', () => {
      open('create', null);
      const savedSpy = vi.spyOn(component.saved, 'emit');

      component.form.controls.name.setValue(required.name);
      component.form.controls.address.setValue(required.address);
      component.form.controls.city.setValue(required.city);
      component.form.controls.regionId.setValue(required.regionId);
      component.onSave();

      expect(locationsApi.createLocation).toHaveBeenCalledWith(
        expect.objectContaining({ name: required.name, city: required.city, region_id: 7, active: true }),
      );
      expect(savedSpy).toHaveBeenCalledTimes(1);
      expect(messageAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'ok' }),
      );
      expect(component.saving()).toBe(false);
    });

    it('edit mode calls refStore.updateLocation with the location id (PATCH through the store)', () => {
      open('edit', baseLocation());
      const savedSpy = vi.spyOn(component.saved, 'emit');

      component.form.controls.name.setValue('Sucursal Renombrada');
      component.onSave();

      expect(locationsApi.updateLocation).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: 'Sucursal Renombrada', region_id: 7, active: true }),
      );
      expect(savedSpy).toHaveBeenCalledTimes(1);
    });

    it('re-throws the error via httpError and does NOT emit saved when the store call fails', () => {
      open('create', null);
      locationsApi.createLocation.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      const savedSpy = vi.spyOn(component.saved, 'emit');

      component.form.controls.name.setValue(required.name);
      component.form.controls.address.setValue(required.address);
      component.form.controls.city.setValue(required.city);
      component.form.controls.regionId.setValue(required.regionId);
      component.onSave();

      expect(savedSpy).not.toHaveBeenCalled();
      expect(httpErrorHandle).toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });
  });
});
