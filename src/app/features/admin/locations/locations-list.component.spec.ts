import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { LocationsListComponent } from './locations-list.component';
import { MessageService } from 'primeng/api';
import { HttpErrorService } from '@services/http-error.service';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { RolesApiService } from '@services/api/roles-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { ReferenceStore } from '@core/stores/reference.store';
import type { Location } from '@models';

describe('LocationsListComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<LocationsListComponent>>;
  let component: LocationsListComponent;
  let store: InstanceType<typeof ReferenceStore>;
  let mockLocationsApi: {
    getLocations: ReturnType<typeof vi.fn>;
    updateLocation: ReturnType<typeof vi.fn>;
    getRegions: ReturnType<typeof vi.fn>;
    getAllComunas: ReturnType<typeof vi.fn>;
  };
  let mockProvidersApi: { getProviders: ReturnType<typeof vi.fn> };
  let mockRolesApi: { getRoles: ReturnType<typeof vi.fn>; assignProviderRoles: ReturnType<typeof vi.fn> };
  let mockServicesApi: { getServices: ReturnType<typeof vi.fn>; getPacks: ReturnType<typeof vi.fn> };
  let mockClientsApi: { getClients: ReturnType<typeof vi.fn> };
  let mockHttpError: { handle: ReturnType<typeof vi.fn> };
  let messageAdd: ReturnType<typeof vi.fn>;

  const baseLocation = (overrides: Partial<Location> = {}): Location => ({
    id: 1,
    name: 'Sucursal Centro',
    address: 'Av. Siempre Viva 123',
    city: 'Santiago',
    timezone: 'America/Santiago',
    active: true,
    ...overrides,
  });

  beforeEach(async () => {
    mockLocationsApi = {
      getLocations: vi.fn(() => of([])),
      updateLocation: vi.fn(() => of({ message: 'ok', data: baseLocation() })),
      getRegions: vi.fn(() => of({ data: [] })),
      getAllComunas: vi.fn(() => of({ data: [] })),
    };
    mockProvidersApi = { getProviders: vi.fn(() => of([])) };
    mockRolesApi = { getRoles: vi.fn(() => of([])), assignProviderRoles: vi.fn(() => of({ data: [] })) };
    mockServicesApi = { getServices: vi.fn(() => of([])), getPacks: vi.fn(() => of({ data: [] })) };
    mockClientsApi = { getClients: vi.fn(() => of([])) };
    mockHttpError = { handle: vi.fn() };
    messageAdd = vi.fn();

    await TestBed.configureTestingModule({
      imports: [LocationsListComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: LocationsApiService, useValue: mockLocationsApi },
        { provide: ProvidersApiService, useValue: mockProvidersApi },
        { provide: RolesApiService, useValue: mockRolesApi },
        { provide: ServicesApiService, useValue: mockServicesApi },
        { provide: ClientsApiService, useValue: mockClientsApi },
        { provide: HttpErrorService, useValue: mockHttpError },
        { provide: MessageService, useValue: { add: messageAdd } },
      ],
    }).compileComponents();

    store = TestBed.inject(ReferenceStore);
    fixture = TestBed.createComponent(LocationsListComponent);
    component = fixture.componentInstance;
  });

  /** Seeds `locations` in the real ReferenceStore (canonical source in U6). */
  function seedLocations(locations: Location[]): void {
    mockLocationsApi.getLocations.mockReturnValue(of(locations));
    store.invalidateLocations();
  }

  // ── Store-backed list (U6: reads refStore.locations) ─────────────────

  describe('store-backed list', () => {
    it('reads locations from ReferenceStore', () => {
      seedLocations([baseLocation()]);
      fixture.detectChanges();
      fixture.detectChanges();

      expect(component.locations()).toEqual([baseLocation()]);
      // The component never fetches locations on its own: only the store loader ran
      expect(mockLocationsApi.getLocations).toHaveBeenCalled();
    });

    it('renders the table after loading (skeleton gone)', () => {
      seedLocations([baseLocation()]);
      fixture.detectChanges();
      fixture.detectChanges();

      const nativeEl = fixture.nativeElement as HTMLElement;
      const skeleton = nativeEl.querySelector('.list-skeleton');
      expect(skeleton).toBeFalsy();
    });
  });

  // ── Toggle + force flow via store (U6, flujo locations behavior-preserving) ─

  describe('toggleActive + force flow (store-routed)', () => {
    beforeEach(() => {
      seedLocations([baseLocation()]);
      fixture.detectChanges();
    });

    it('flips optimistically through the store, emits the PATCH and merges the canonical response', () => {
      const pending = new Subject<{ message: string; data: Location }>();
      mockLocationsApi.updateLocation.mockReturnValue(pending.asObservable());
      const location = store.locations()[0];

      component.toggleActive(location);

      // Optimistic: the store already flipped before the PATCH resolves
      expect(store.locations()[0].active).toBe(false);
      expect(component.locations()[0].active).toBe(false);
      expect(mockLocationsApi.updateLocation).toHaveBeenCalledWith(1, { active: false });
      expect(component.toggling().has(1)).toBe(true);

      pending.next({ message: 'ok', data: baseLocation({ active: false }) });
      pending.complete();

      expect(component.toggling().has(1)).toBe(false);
      expect(store.locations()[0].active).toBe(false);
      expect(messageAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'ok' }),
      );
    });

    it('rolls back and shows a generic error toast when the PATCH fails with a non-409 error', () => {
      mockLocationsApi.updateLocation.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      const location = store.locations()[0];

      component.toggleActive(location);

      // Rollback happened inside the store: the location stays active
      expect(store.locations()[0].active).toBe(true);
      expect(component.toggling().has(1)).toBe(false);
      expect(mockHttpError.handle).toHaveBeenCalled();
      expect(component.conflictDialogVisible()).toBe(false);
    });

    it('opens the force dialog on 409 and keeps the location active (store rollback)', () => {
      const conflictBody = {
        message: 'La sucursal tiene reservas futuras',
        requires_confirmation: true,
        affects: {
          bookings: [
            { id: 11, date: '2026-09-10', time: '10:00', provider_name: 'Ana García' },
          ],
        },
      };
      mockLocationsApi.updateLocation.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: conflictBody })),
      );
      const location = store.locations()[0];

      component.toggleActive(location);

      expect(store.locations()[0].active).toBe(true);
      expect(component.conflictDialogVisible()).toBe(true);
      expect(component.conflictData()?.message).toBe(conflictBody.message);
      expect(component.conflictData()?.affects.bookings).toHaveLength(1);
      expect(component['pendingToggleLocation']()?.id).toBe(1);
    });

    it('confirm force emits updateLocation(id, {active:false, force:true}) and deactivates via the store', () => {
      mockLocationsApi.updateLocation.mockReturnValue(
        throwError(() => new HttpErrorResponse({
          status: 409,
          error: { message: 'conflicto', requires_confirmation: true, affects: { bookings: [] } },
        })),
      );
      component.toggleActive(store.locations()[0]);
      expect(component.conflictDialogVisible()).toBe(true);

      mockLocationsApi.updateLocation.mockReturnValue(
        of({ message: 'ok', data: baseLocation({ active: false }) }),
      );
      component.confirmDeactivate();

      expect(mockLocationsApi.updateLocation).toHaveBeenCalledWith(1, { active: false, force: true });
      expect(store.locations()[0].active).toBe(false);
      expect(component.conflictDialogVisible()).toBe(false);
      expect(component['pendingToggleLocation']()).toBeNull();
      expect(messageAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'ok' }),
      );
    });

    it('cancel emits no extra request and the location remains active', () => {
      mockLocationsApi.updateLocation.mockReturnValue(
        throwError(() => new HttpErrorResponse({
          status: 409,
          error: { message: 'conflicto', requires_confirmation: true, affects: { bookings: [] } },
        })),
      );
      component.toggleActive(store.locations()[0]);
      expect(component.conflictDialogVisible()).toBe(true);

      component.cancelDeactivate();

      expect(component.conflictDialogVisible()).toBe(false);
      // Only the initial toggle PATCH was emitted — no request on cancel
      expect(mockLocationsApi.updateLocation).toHaveBeenCalledTimes(1);
      expect(store.locations()[0].active).toBe(true);
    });
  });
});
