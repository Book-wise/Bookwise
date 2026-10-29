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

  // ── Cuota agotada: el CTA de upgrade no queda pegado ────────────────

  describe('capacity limit CTA', () => {
    beforeEach(async () => {
      await setup();
    });

    const quotaError = () =>
      new HttpErrorResponse({
        status: 403,
        error: { error: 'tenant_location_limit_reached', detail: 'sin cupo' },
      });

    /** Completa el alta mínima válida y dispara el guardado. */
    function submitCreate(): void {
      component.form.controls.name.setValue(required.name);
      component.form.controls.address.setValue(required.address);
      component.form.controls.city.setValue(required.city);
      component.form.controls.regionId.setValue(required.regionId);
      fixture.detectChanges();
      component.onSave();
    }

    it('muestra el CTA y no emite saved cuando el backend rechaza el alta por cuota', () => {
      open('create', null);
      locationsApi.createLocation.mockReturnValue(throwError(() => quotaError()));
      const savedSpy = vi.spyOn(component.saved, 'emit');

      submitCreate();

      expect(component.capacityError()).toBe(true);
      expect(savedSpy).not.toHaveBeenCalled();
      expect(httpErrorHandle).not.toHaveBeenCalled();
    });

    it('limpia el CTA al reabrir el diálogo', () => {
      open('create', null);
      locationsApi.createLocation.mockReturnValue(throwError(() => quotaError()));
      submitCreate();
      expect(component.capacityError()).toBe(true);

      fixture.componentRef.setInput('visible', false);
      fixture.detectChanges();
      open('create', null);

      expect(component.capacityError()).toBe(false);
    });

    it('limpia el CTA cuando el reintento sale bien', () => {
      open('create', null);
      locationsApi.createLocation.mockReturnValue(throwError(() => quotaError()));
      submitCreate();
      expect(component.capacityError()).toBe(true);

      locationsApi.createLocation.mockReturnValue(of({ message: 'ok', data: baseLocation() }));
      submitCreate();

      expect(component.capacityError()).toBe(false);
    });
  });

  // ── Días laborables + feriados (business-days) ────────────────────

  describe('working days + holidays', () => {
    beforeEach(async () => {
      await setup();
    });

    it('create mode defaults to Mon–Sat working days', () => {
      open('create', null);
      expect(component.form.controls.workingDays.value).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('sends working_days in the create payload', () => {
      open('create', null);
      component.form.controls.name.setValue(required.name);
      component.form.controls.address.setValue(required.address);
      component.form.controls.city.setValue(required.city);
      component.form.controls.regionId.setValue(required.regionId);
      component.onSave();

      expect(locationsApi.createLocation).toHaveBeenCalledWith(
        expect.objectContaining({ working_days: [1, 2, 3, 4, 5, 6] }),
      );
    });

    it('edit mode prefills working_days from the location', () => {
      open('edit', baseLocation({ working_days: [1, 2, 3, 4, 5] }));
      expect(component.form.controls.workingDays.value).toEqual([1, 2, 3, 4, 5]);
    });

    it('edit mode defaults working_days to Mon–Sat when the location has none', () => {
      open('edit', baseLocation());
      expect(component.form.controls.workingDays.value).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('prefills opening/closing time from effective_* when opening/closing are null', () => {
      open(
        'edit',
        baseLocation({
          opening_time: null,
          closing_time: null,
          effective_opening_time: '08:00:00',
          effective_closing_time: '22:00:00',
        }),
      );
      expect(component.form.controls.openingTime.value?.getHours()).toBe(8);
      expect(component.form.controls.closingTime.value?.getHours()).toBe(22);
    });

    it('toggling a day off removes it and toggling back re-adds it sorted', () => {
      open('create', null);
      const evt = (checked: boolean) => ({ target: { checked } }) as unknown as Event;
      component.toggleWorkingDay(3, evt(false));
      expect(component.form.controls.workingDays.value).toEqual([1, 2, 4, 5, 6]);
      component.toggleWorkingDay(7, evt(true));
      expect(component.form.controls.workingDays.value).toEqual([1, 2, 4, 5, 6, 7]);
    });

    it('marks the form invalid when all working days are unchecked', () => {
      open('create', null);
      component.form.controls.workingDays.setValue([]);
      expect(component.form.controls.workingDays.invalid).toBe(true);
    });
  });

  // ── Horas: no materializar el default si no se editaron (R3-002) ──

  describe('hours preservation', () => {
    beforeEach(async () => {
      await setup();
    });

    it('does not send the hours when they were not edited (null stays null)', () => {
      open(
        'edit',
        baseLocation({
          opening_time: null,
          closing_time: null,
          effective_opening_time: '08:00:00',
          effective_closing_time: '22:00:00',
        }),
      );

      component.onSave();

      const payload = locationsApi.updateLocation.mock.calls[0][1];
      expect(payload.opening_time).toBeUndefined();
      expect(payload.closing_time).toBeUndefined();
    });

    it('sends only the hour the admin edited', () => {
      open('edit', baseLocation({ opening_time: '09:00:00', closing_time: '18:00:00' }));
      const edited = new Date(0);
      edited.setHours(10, 30, 0, 0);
      component.form.controls.openingTime.setValue(edited);

      component.onSave();

      const payload = locationsApi.updateLocation.mock.calls[0][1];
      expect(payload.opening_time).toBe('10:30:00');
      expect(payload.closing_time).toBeUndefined();
    });

    it('sends explicit null when the admin clears the hour', () => {
      open('edit', baseLocation({ opening_time: '09:00:00', closing_time: '18:00:00' }));
      component.form.controls.openingTime.setValue(null);

      component.onSave();

      const payload = locationsApi.updateLocation.mock.calls[0][1];
      expect(payload.opening_time).toBeNull();
    });
  });
});
