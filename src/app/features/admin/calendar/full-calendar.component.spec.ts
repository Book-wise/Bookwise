import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { FullCalendarComponent } from './full-calendar.component';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { BlockedSlotsApiService } from '@services/api/blocked-slots-api.service';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { MessageService } from 'primeng/api';
import { HttpErrorService } from '@services/http-error.service';
import { CalendarNavigationService } from '@services/calendar-navigation.service';
import { BookingStore } from '@core/stores/booking.store';
import { Location, Provider } from '@models';

/**
 * Integration tests for the calendar-navigation flow inside FullCalendarComponent.
 * Uses the REAL CalendarNavigationService + BookingStore with mocked API services,
 * so the transactional one-shot consumption and the store filter sync are exercised
 * end-to-end at the component layer. The FullCalendar instance is not part of the
 * assertions — the loadLocations/loadProviders data flow is what these tests verify.
 */
describe('FullCalendarComponent — calendar navigation integration', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<FullCalendarComponent>>;
  let component: FullCalendarComponent;
  let calNav: CalendarNavigationService;
  let store: InstanceType<typeof BookingStore>;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockLocationsApi: {
    getLocations: ReturnType<typeof vi.fn>;
    getRegions: ReturnType<typeof vi.fn>;
    getAllComunas: ReturnType<typeof vi.fn>;
  };
  let mockProvidersApi: { getProviders: ReturnType<typeof vi.fn> };
  let mockBookingsApi: { getBookings: ReturnType<typeof vi.fn> };
  let mockBlockedSlotsApi: { getBlockedSlots: ReturnType<typeof vi.fn> };
  let mockServicesApi: { getServices: ReturnType<typeof vi.fn>; getPacks: ReturnType<typeof vi.fn> };
  let mockClientsApi: { getClients: ReturnType<typeof vi.fn> };
  let mockMessageService: { add: ReturnType<typeof vi.fn> };

  const locCentro: Location = {
    id: 1,
    name: 'Sucursal Centro',
    address: '',
    city: '',
    timezone: 'America/Santiago',
    active: true,
  };
  const locNorte: Location = {
    id: 2,
    name: 'Sucursal Norte',
    address: '',
    city: '',
    timezone: 'America/Santiago',
    active: true,
  };
  const providerAna: Provider = {
    id: 7,
    first_name: 'Ana',
    last_name: 'Torres',
    email: 'ana@test.com',
    active: true,
    location: locNorte,
  };
  const providerJuan: Provider = {
    id: 8,
    first_name: 'Juan',
    last_name: 'Pérez',
    email: 'juan@test.com',
    active: true,
    location: locCentro,
  };

  beforeEach(async () => {
    mockRouter = { navigate: vi.fn() };
    mockLocationsApi = {
      getLocations: vi.fn(() => of([locCentro, locNorte])),
      getRegions: vi.fn(() => of({ data: [] })),
      getAllComunas: vi.fn(() => of({ data: [] })),
    };
    mockProvidersApi = { getProviders: vi.fn(() => of([providerAna, providerJuan])) };
    mockBookingsApi = { getBookings: vi.fn(() => of({ data: [], meta: {} })) };
    mockBlockedSlotsApi = { getBlockedSlots: vi.fn(() => of({ data: [] })) };
    mockServicesApi = { getServices: vi.fn(() => of([])), getPacks: vi.fn(() => of({ data: [] })) };
    mockClientsApi = { getClients: vi.fn(() => of([])) };
    mockMessageService = { add: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [FullCalendarComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: mockRouter },
        { provide: LocationsApiService, useValue: mockLocationsApi },
        { provide: ProvidersApiService, useValue: mockProvidersApi },
        { provide: BlockedSlotsApiService, useValue: mockBlockedSlotsApi },
        { provide: BookingsApiService, useValue: mockBookingsApi },
        { provide: ServicesApiService, useValue: mockServicesApi },
        { provide: ClientsApiService, useValue: mockClientsApi },
        { provide: MessageService, useValue: mockMessageService },
        { provide: HttpErrorService, useValue: { handle: vi.fn(), toToastConfig: vi.fn() } },
        // REAL service — the transactional consumption is the behavior under test
        CalendarNavigationService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FullCalendarComponent);
    component = fixture.componentInstance;
    calNav = TestBed.inject(CalendarNavigationService);
    store = TestBed.inject(BookingStore);

    // createComponent already runs ngOnInit (initial default load); reset the
    // providers spy so each test can assert its OWN loadLocations() call.
    mockProvidersApi.getProviders.mockClear();
  });

  describe('pending navigation consumption', () => {
    it('pre-selects pending location and provider and clears pending state transactionally', () => {
      calNav.navigateToCalendar(2, 7, mockRouter as unknown as Router);
      expect(calNav.hasPendingNavigation()).toBe(true);

      component.loadLocations();

      // Pending filters applied to the local filter state
      expect(component.selectedLocationId).toBe(2);
      expect(component.selectedProviderId).toBe(7);
      // Providers fetched for the pending location only (no default fallback)
      expect(mockProvidersApi.getProviders).toHaveBeenCalledTimes(1);
      expect(mockProvidersApi.getProviders).toHaveBeenCalledWith({ location_id: 2 });
      // Transactional: pending state consumed and cleared in the same flow
      expect(calNav.hasPendingNavigation()).toBe(false);
      expect(calNav.consumePending()).toEqual({ locationId: null, providerId: null });
    });

    it('syncs the pre-selected filters into the BookingStore', () => {
      calNav.navigateToCalendar(2, 7, mockRouter as unknown as Router);

      component.loadLocations();

      expect(store.filters().selectedLocationId).toBe(2);
      expect(store.filters().selectedProviderId).toBe(7);
    });

    it('shows the welcome toast with provider and location names', () => {
      calNav.navigateToCalendar(2, 7, mockRouter as unknown as Router);

      component.loadLocations();

      expect(mockMessageService.add).toHaveBeenCalledTimes(1);
      const toast = mockMessageService.add.mock.calls[0][0] as {
        key: string;
        detail: string;
        severity: string;
      };
      expect(toast.key).toBe('global');
      expect(toast.severity).toBe('success');
      expect(toast.detail).toBe('Mostrando agenda de Ana Torres en Sucursal Norte');
    });

    it('pre-selects the provider even when it is missing from the loaded list, without toast', () => {
      calNav.navigateToCalendar(2, 999, mockRouter as unknown as Router);

      component.loadLocations();

      expect(component.selectedProviderId).toBe(999);
      expect(mockMessageService.add).not.toHaveBeenCalled();
    });
  });

  describe('page refresh (no pending navigation)', () => {
    it('falls back to the first location, no provider and no toast', () => {
      // Fresh component + fresh service in this test: nothing pending
      component.loadLocations();

      expect(component.selectedLocationId).toBe(1);
      expect(component.selectedProviderId).toBeNull();
      expect(calNav.hasPendingNavigation()).toBe(false);
      expect(mockProvidersApi.getProviders).toHaveBeenCalledWith({ location_id: 1 });
      expect(store.filters().selectedLocationId).toBe(1);
      expect(store.filters().selectedProviderId).toBeNull();
      expect(mockMessageService.add).not.toHaveBeenCalled();
    });
  });
});
