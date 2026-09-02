import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
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
import { DateTime } from 'luxon';

/**
 * Integration tests for the calendar-navigation flow inside FullCalendarComponent.
 * Uses the REAL CalendarNavigationService + BookingStore with mocked API services,
 * so the transactional one-shot consumption and the store filter sync are exercised
 * end-to-end at the component layer. The FullCalendar instance is not part of the
 * assertions — the loadLocations/loadProviders data flow is what these tests verify.
 */

// Browser APIs not implemented in jsdom — stubbed so PrimeNG/dialog/scroll
// components used by FullCalendarComponent can be instantiated under test.
beforeAll(() => {
  (window as any).matchMedia ??= (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
  (globalThis as any).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (globalThis as any).IntersectionObserver ??= class {
    root = null;
    rootMargin = '';
    thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

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
  let mockHttpError: { handle: ReturnType<typeof vi.fn>; toToastConfig: ReturnType<typeof vi.fn> };

  /**
   * The FullCalendar instance is created in ngAfterViewInit/initCalendar, which
   * does not run in this test environment (no rendered view). Stub the instance
   * so applyPendingView() can exercise its changeView call — the data flow under
   * test, not FullCalendar internals.
   */
  function stubCalendar(): { changeView: ReturnType<typeof vi.fn> } {
    const calendarMock = { changeView: vi.fn(), refetchEvents: vi.fn(), destroy: vi.fn() };
    (component as unknown as { calendar: unknown }).calendar = calendarMock as never;
    return calendarMock;
  }

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
    mockRouter = { navigate: vi.fn(() => Promise.resolve(true)) };
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
    mockHttpError = { handle: vi.fn(), toToastConfig: vi.fn() };

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
        { provide: HttpErrorService, useValue: mockHttpError },
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
      calNav.navigateToCalendar(2, 7, [], mockRouter as unknown as Router);
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
      expect(calNav.consumePending()).toEqual({ locationId: null, providerId: null, statusIds: [], view: null, gotoDate: null, rangeEnd: null });
    });

    it('syncs the pre-selected filters into the BookingStore', () => {
      calNav.navigateToCalendar(2, 7, [], mockRouter as unknown as Router);

      component.loadLocations();

      expect(store.filters().selectedLocationId).toBe(2);
      expect(store.filters().selectedProviderId).toBe(7);
    });

    it('shows the welcome toast with provider and location names', () => {
      calNav.navigateToCalendar(2, 7, [], mockRouter as unknown as Router);

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
      calNav.navigateToCalendar(2, 999, [], mockRouter as unknown as Router);

      component.loadLocations();

      expect(component.selectedProviderId).toBe(999);
      expect(mockMessageService.add).not.toHaveBeenCalled();
    });

    it('applies a status-only pending navigation (e.g. dashboard pending card) to the status filter', () => {
      // location/provider null — only statusIds pending (dashboard pending card path).
      calNav.navigateToCalendar(null, null, [5], mockRouter as unknown as Router);
      expect(calNav.hasPendingNavigation()).toBe(true);

      component.loadLocations();

      // Status filter applied even though the calendar used the default first location
      expect(component.selectedStatusIds).toEqual([5]);
      expect(component.selectedLocationId).toBe(1);
      expect(store.filters().selectedStatusIds).toEqual([5]);
      expect(store.filters().selectedLocationId).toBe(1);
      // Transactional: pending state consumed and cleared in the same flow
      expect(calNav.hasPendingNavigation()).toBe(false);
      expect(calNav.consumePending()).toEqual({ locationId: null, providerId: null, statusIds: [], view: null, gotoDate: null, rangeEnd: null });
    });

    it('shows the pending-context info toast on a status-only pending navigation', () => {
      // Dashboard "Pending appointments" card path: statusIds only, no location/provider.
      calNav.navigateToCalendar(null, null, [5], mockRouter as unknown as Router);

      component.loadLocations();

      // Default location loaded with the Pending filter applied
      expect(component.selectedLocationId).toBe(1);
      expect(component.selectedStatusIds).toEqual([5]);
      // Exactly one toast: the pending-context toast (no provider welcome toast)
      expect(mockMessageService.add).toHaveBeenCalledTimes(1);
      const toast = mockMessageService.add.mock.calls[0][0] as {
        key: string;
        severity: string;
        summary: string;
        detail: string;
        life: number;
      };
      expect(toast.key).toBe('global');
      expect(toast.severity).toBe('info');
      expect(toast.life).toBe(6000);
      expect(toast.summary).toBe(component.lang.t('cal.pending_title'));
      // No view context carried → the default (current week) fallback message
      expect(toast.detail).toBe(component.lang.t('cal.pending_context_toast'));
    });

    it('applies a month view context via changeView and explains the month in the toast', () => {
      // Dashboard "Pending appointments" card in 'mes' range mode: month view
      // (dayGridMonth) positioned on the first day of the selected month.
      const calendarMock = stubCalendar();

      calNav.navigateToCalendar(null, null, [5], mockRouter as unknown as Router, {
        view: 'dayGridMonth',
        gotoDate: '2026-09-01',
      });

      component.loadLocations();

      expect(component.selectedLocationId).toBe(1);
      expect(component.selectedStatusIds).toEqual([5]);
      // The pending view request is applied one-shot on the calendar instance
      expect(calendarMock.changeView).toHaveBeenCalledTimes(1);
      expect(calendarMock.changeView).toHaveBeenCalledWith('dayGridMonth', '2026-09-01');

      expect(mockMessageService.add).toHaveBeenCalledTimes(1);
      const toast = mockMessageService.add.mock.calls[0][0] as { summary: string; detail: string };
      expect(toast.summary).toBe(component.lang.t('cal.pending_title'));
      const monthLabel = DateTime.fromISO('2026-09-01').setLocale('es').toFormat("LLLL 'de' yyyy");
      expect(toast.detail).toBe(component.lang.t('cal.pending_context_mes', { month: monthLabel }));
    });

    it('applies a week view context and explains the week range in the toast', () => {
      // Dashboard "Pending appointments" card in 'semana' range mode.
      const calendarMock = stubCalendar();

      calNav.navigateToCalendar(null, null, [5], mockRouter as unknown as Router, {
        view: 'timeGridWeek',
        gotoDate: '2026-08-31',
        rangeEnd: '2026-09-06',
      });

      component.loadLocations();

      expect(calendarMock.changeView).toHaveBeenCalledTimes(1);
      expect(calendarMock.changeView).toHaveBeenCalledWith('timeGridWeek', '2026-08-31');

      const toast = mockMessageService.add.mock.calls[0][0] as { detail: string };
      expect(toast.detail).toBe(
        component.lang.t('cal.pending_context_semana', {
          start: '31/08/2026',
          end: '06/09/2026',
        }),
      );
    });

    it('falls back to a week view for a custom (libre) range and explains the period', () => {
      // Dashboard "Pending appointments" card in 'libre' range mode: a custom
      // range may span two months — the calendar must NOT try to render both,
      // it opens the week of the range start and describes the selected period.
      const calendarMock = stubCalendar();

      calNav.navigateToCalendar(null, null, [5], mockRouter as unknown as Router, {
        view: 'timeGridWeek',
        gotoDate: '2026-08-15',
        rangeEnd: '2026-09-30',
      });

      component.loadLocations();

      expect(calendarMock.changeView).toHaveBeenCalledTimes(1);
      expect(calendarMock.changeView).toHaveBeenCalledWith('timeGridWeek', '2026-08-15');

      const toast = mockMessageService.add.mock.calls[0][0] as { detail: string };
      expect(toast.detail).toBe(
        component.lang.t('cal.pending_context_libre', {
          start: '15/08/2026',
          end: '30/09/2026',
        }),
      );
    });
  });

  describe('pending navigation edge cases', () => {
    it('consumes and clears pending navigation when the locations API returns an empty list', () => {
      mockLocationsApi.getLocations.mockReturnValue(of([]));
      calNav.navigateToCalendar(2, 7, [], mockRouter as unknown as Router);
      expect(calNav.hasPendingNavigation()).toBe(true);

      component.loadLocations();

      expect(calNav.hasPendingNavigation()).toBe(false);
      expect(calNav.consumePending()).toEqual({ locationId: null, providerId: null, statusIds: [], view: null, gotoDate: null, rangeEnd: null });
    });

    it('applies the pending provider filter and surfaces a toast when loading providers fails', () => {
      mockProvidersApi.getProviders.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
      );
      calNav.navigateToCalendar(2, 7, [], mockRouter as unknown as Router);

      component.loadLocations();

      // Filter intent is applied to the store even though the providers list failed
      expect(component.selectedProviderId).toBe(7);
      expect(store.filters().selectedProviderId).toBe(7);
      expect(mockHttpError.handle).toHaveBeenCalledTimes(1);
    });

    it('clears unconsumed pending navigation when the component is destroyed', () => {
      calNav.navigateToCalendar(2, 7, [], mockRouter as unknown as Router);
      expect(calNav.hasPendingNavigation()).toBe(true);

      fixture.destroy();

      expect(calNav.hasPendingNavigation()).toBe(false);
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
