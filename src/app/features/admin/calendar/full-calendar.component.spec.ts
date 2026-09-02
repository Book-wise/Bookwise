import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { FullCalendarComponent } from './full-calendar.component';
import { AuthService } from '@services/auth.service';
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
import { Location, Provider, User } from '@models';
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
  let mockAuthUser: ReturnType<typeof signal<User | null>>;

  /** Test admin user with a stable id — the preference key is per-user. */
  function testUser(id: number): User {
    return { id, email: 'admin@test.com', name: 'Admin', role: 'admin' };
  }

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
  const locSur: Location = {
    id: 3,
    name: 'Sucursal Sur',
    address: '',
    city: '',
    timezone: 'America/Santiago',
    active: false,
  };
  const providerAna: Provider = {
    id: 7,
    first_name: 'Ana',
    last_name: 'Torres',
    email: 'ana@test.com',
    active: true,
    location: locNorte,
    roles: [{ id: 1, name: 'staff' }],
  };
  const providerJuan: Provider = {
    id: 8,
    first_name: 'Juan',
    last_name: 'Pérez',
    email: 'juan@test.com',
    active: true,
    location: locCentro,
    roles: [{ id: 1, name: 'staff' }],
  };
  // Sólo recepcionista: activo pero SIN rol de atención → oculto (C2)
  const providerRosa: Provider = {
    id: 9,
    first_name: 'Rosa',
    last_name: 'Mesa',
    email: 'rosa@test.com',
    active: true,
    location: locCentro,
    roles: [{ id: 3, name: 'recepcionista' }],
  };
  // staff_readonly: activo y visible (C2)
  const providerLuis: Provider = {
    id: 10,
    first_name: 'Luis',
    last_name: 'Rojas',
    email: 'luis@test.com',
    active: true,
    location: locCentro,
    roles: [{ id: 4, name: 'staff_readonly' }],
  };
  // Inactivo con staff: excluido por active (C2)
  const providerSofia: Provider = {
    id: 11,
    first_name: 'Sofía',
    last_name: 'Lagos',
    email: 'sofia@test.com',
    active: false,
    location: locCentro,
    roles: [{ id: 5, name: 'staff' }],
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

    // Per-user preferences (last location) live in localStorage — cleared between
    // tests so no test inherits another one's key.
    localStorage.clear();
    mockAuthUser = signal<User | null>(testUser(5));

    await TestBed.configureTestingModule({
      imports: [FullCalendarComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: mockRouter },
        // Minimally mocked AuthService — the component and BookingStore only
        // read `user()` in these flows.
        { provide: AuthService, useValue: { user: computed(() => mockAuthUser()), userRole: computed(() => mockAuthUser()?.role ?? null) } },
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
        summary: string;
        detail: string;
        severity: string;
      };
      expect(toast.key).toBe('global');
      expect(toast.severity).toBe('success');
      expect(toast.summary).toBe('Ana Torres');
      // Detail is i18n'd and always reports the filter context ("Filtro: ..."),
      // not only the provider + location names.
      expect(toast.detail).toBe(
        component.lang.t('cal.welcome_agenda_detail', {
          provider: 'Ana Torres',
          location: 'Sucursal Norte',
          filter_label: component.lang.t('cal.toast.filter_label'),
          statuses: component.lang.t('cal.placeholder.all_statuses'),
        }),
      );
      expect(toast.detail).toContain('Sucursal Norte');
      expect(toast.detail).toContain('Filtro: Todos los estados');
    });

    it('clears a pre-selection missing from the loaded list, without toast', () => {
      calNav.navigateToCalendar(2, 999, [], mockRouter as unknown as Router);

      component.loadLocations();

      // C3: the pinned provider never existed in the list → the selection is
      // reconciled to null ("todos los profesionales") and nothing is confirmed.
      expect(component.selectedProviderId).toBeNull();
      expect(store.filters().selectedProviderId).toBeNull();
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
      // No view context carried → the default (current week) fallback message,
      // which still reports status filter + shown location + provider.
      expect(toast.detail).toBe(
        component.lang.t('cal.pending_context_toast', {
          statuses: component.lang.t('status.5'),
          location: 'Sucursal Centro',
          provider: component.lang.t('cal.placeholder.all_providers'),
          location_label: component.lang.t('cal.toast.location_label'),
          provider_label: component.lang.t('cal.toast.provider_label'),
        }),
      );
      expect(toast.detail).toContain('Sucursal Centro');
      expect(toast.detail).toContain('Todos los profesionales');
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
      expect(toast.detail).toBe(
        component.lang.t('cal.pending_context_mes', {
          month: monthLabel,
          statuses: component.lang.t('status.5'),
          location: 'Sucursal Centro',
          provider: component.lang.t('cal.placeholder.all_providers'),
          location_label: component.lang.t('cal.toast.location_label'),
          provider_label: component.lang.t('cal.toast.provider_label'),
        }),
      );
      // The composed detail also reports the shown location and provider.
      expect(toast.detail).toContain('Sucursal Centro');
      expect(toast.detail).toContain('Todos los profesionales');
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
          statuses: component.lang.t('status.5'),
          location: 'Sucursal Centro',
          provider: component.lang.t('cal.placeholder.all_providers'),
          location_label: component.lang.t('cal.toast.location_label'),
          provider_label: component.lang.t('cal.toast.provider_label'),
        }),
      );
      // The composed detail also reports the shown location and provider.
      expect(toast.detail).toContain('Sucursal Centro');
      expect(toast.detail).toContain('Todos los profesionales');
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
          statuses: component.lang.t('status.5'),
          location: 'Sucursal Centro',
          provider: component.lang.t('cal.placeholder.all_providers'),
          location_label: component.lang.t('cal.toast.location_label'),
          provider_label: component.lang.t('cal.toast.provider_label'),
        }),
      );
      // The composed detail also reports the shown location and provider.
      expect(toast.detail).toContain('Sucursal Centro');
      expect(toast.detail).toContain('Todos los profesionales');
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

    it('does not apply the provider intent when loading providers fails, and surfaces the error', () => {
      mockProvidersApi.getProviders.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
      );
      calNav.navigateToCalendar(2, 7, [], mockRouter as unknown as Router);

      component.loadLocations();

      // Drop del apply-intent-anyway en error: la pre-selección no se aplica ni
      // se sincroniza al store; solo se informa el fallo genérico.
      expect(component.selectedProviderId).toBeNull();
      expect(store.filters().selectedProviderId).toBeNull();
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

  describe('C1 — location visibility (active locations only)', () => {
    it('excludes inactive locations from locationOptions', () => {
      component.locations.set([locCentro, locNorte, locSur]);

      const values = component.locationOptions().map((o) => o.value);
      expect(values).toEqual([1, 2]);
      expect(values).not.toContain(3);
    });

    it('defaults the loaded location to the first ACTIVE location', () => {
      // Inactive branch first in the payload → never picked as default
      mockLocationsApi.getLocations.mockReturnValue(of([locSur, locCentro, locNorte]));

      component.loadLocations();

      expect(component.selectedLocationId).toBe(1);
      expect(mockProvidersApi.getProviders).toHaveBeenCalledWith({ location_id: 1 });
    });

    it('keeps an explicit navigation intent to an inactive location', () => {
      mockLocationsApi.getLocations.mockReturnValue(of([locCentro, locSur]));
      calNav.navigateToCalendar(3, null, [], mockRouter as unknown as Router);

      component.loadLocations();

      // Deliberate navigation wins over the active-only rule
      expect(component.selectedLocationId).toBe(3);
      expect(mockProvidersApi.getProviders).toHaveBeenCalledWith({ location_id: 3 });
    });
  });

  describe('C2 — provider visibility (active + attention role)', () => {
    it('shows active providers with role staff', () => {
      component.providers.set([providerAna, providerSofia]);

      const values = component.providerOptions().map((o) => o.value);
      expect(values).toContain(7); // activo + staff
      expect(values).not.toContain(11); // inactivo + staff → oculto
    });

    it('shows active providers with role staff_readonly', () => {
      component.providers.set([providerLuis]);

      expect(component.providerOptions().map((o) => o.value)).toEqual([10]);
    });

    it('hides active providers whose only role is recepcionista', () => {
      component.providers.set([providerRosa, providerJuan]);

      const values = component.providerOptions().map((o) => o.value);
      expect(values).toContain(8); // staff visible
      expect(values).not.toContain(9); // recepcionista-only → oculto
    });
  });

  describe('C3 — stale provider selection reconcile', () => {
    it('clears a stale selection when a reload hides the selected provider', () => {
      // User had Juan (active staff) selected and synced to the store
      component.selectedProviderId = 8;
      component.onFilterChange();
      expect(store.filters().selectedProviderId).toBe(8);

      // Reload returns Juan now inactive → excluded by the C2 filter
      const juanInactive: Provider = { ...providerJuan, active: false };
      mockProvidersApi.getProviders.mockReturnValue(of([providerAna, juanInactive]));

      component.loadProviders(1);

      expect(mockProvidersApi.getProviders).toHaveBeenCalledWith({ location_id: 1 });
      expect(component.selectedProviderId).toBeNull();
      expect(store.filters().selectedProviderId).toBeNull();
      expect(mockMessageService.add).not.toHaveBeenCalled();
    });

    it('keeps the selection when the provider is still visible after a reload', () => {
      component.selectedProviderId = 8;
      component.onFilterChange();
      expect(store.filters().selectedProviderId).toBe(8);

      // Default mock list still has Juan as active staff → selection survives
      component.loadProviders(1);

      expect(component.selectedProviderId).toBe(8);
      expect(store.filters().selectedProviderId).toBe(8);
    });
  });

  describe('slot duration density selector', () => {
    const setOptionStub = () => ({ setOption: vi.fn(), destroy: vi.fn() });

    it('updates the signal and the live calendar slotDuration when a duration is selected', () => {
      const calendarMock = setOptionStub();
      (component as unknown as { calendar: unknown }).calendar = calendarMock as never;

      component.applySlotDuration(40);

      expect(component.slotDurationMinutes()).toBe(40);
      expect(component.calendarOptions.slotDuration).toBe('00:40:00');
      expect(calendarMock.setOption).toHaveBeenCalledWith('slotDuration', '00:40:00');
      // Selection snap must stay fixed at 1h
      expect(component.calendarOptions.snapDuration).toBe('01:00:00');
    });

    it('formats edge durations and never touches snapDuration', () => {
      const calendarMock = setOptionStub();
      (component as unknown as { calendar: unknown }).calendar = calendarMock as never;

      component.applySlotDuration(60);
      expect(component.slotDurationMinutes()).toBe(60);
      expect(component.calendarOptions.slotDuration).toBe('01:00:00');
      expect(calendarMock.setOption).toHaveBeenCalledWith('slotDuration', '01:00:00');

      component.applySlotDuration(5);
      expect(component.slotDurationMinutes()).toBe(5);
      expect(component.calendarOptions.slotDuration).toBe('00:05:00');
      expect(calendarMock.setOption).toHaveBeenCalledWith('slotDuration', '00:05:00');
      expect(component.calendarOptions.snapDuration).toBe('01:00:00');
    });

    it('exposes the 8 duration options with localized labels', () => {
      expect(component.slotDurationOptions).toEqual([5, 10, 15, 20, 30, 40, 45, 60]);
      // Default selection matches the initial grid (30min)
      expect(component.slotDurationMinutes()).toBe(30);
      for (const m of component.slotDurationOptions) {
        expect(component.slotDurationLabel(m)).toBe(`${m} minutos`);
      }
    });
  });

  describe('remember last location (per user, localStorage)', () => {
    const keyFor = (userId: number) => `bw:lastLocationId:${userId}`;

    it('opens the stored location when it still exists and is active', () => {
      localStorage.setItem(keyFor(5), '2');

      component.loadLocations();

      expect(component.selectedLocationId).toBe(2);
      expect(mockProvidersApi.getProviders).toHaveBeenCalledWith({ location_id: 2 });
      expect(store.filters().selectedLocationId).toBe(2);
    });

    it('falls back to the first ACTIVE location when the stored one is inactive', () => {
      // Sucursal Sur (id 3) is inactive in the payload — not a valid default
      mockLocationsApi.getLocations.mockReturnValue(of([locCentro, locNorte, locSur]));
      localStorage.setItem(keyFor(5), '3');

      component.loadLocations();

      expect(component.selectedLocationId).toBe(1);
      expect(mockProvidersApi.getProviders).toHaveBeenCalledWith({ location_id: 1 });
    });

    it('does not leak the stored location across users', () => {
      localStorage.setItem(keyFor(5), '2');
      mockAuthUser.set(testUser(9));

      component.loadLocations();

      // User 9 has no stored preference → default (first active location)
      expect(component.selectedLocationId).toBe(1);
      expect(mockProvidersApi.getProviders).toHaveBeenCalledWith({ location_id: 1 });
    });

    it('persists the new location on an intentional dropdown change only', () => {
      // Simulates the user changing the sucursal dropdown: the beforeEach initial
      // load left previousLocationId = 1 (default); now the user picks location 2.
      component.selectedLocationId = 2;

      component.onLocationChange();

      expect(localStorage.getItem(keyFor(5))).toBe('2');
      expect(mockProvidersApi.getProviders).toHaveBeenCalledWith({ location_id: 2 });
    });

    it('writes nothing when the default is applied without a user change', () => {
      // ngOnInit/loadLocations already applied the default in beforeEach — without
      // onLocationChange the preference must not exist.
      expect(localStorage.getItem(keyFor(5))).toBeNull();
    });
  });

  describe('viewing-as identity', () => {
    it('exposes the authenticated user name and a localized admin role label', () => {
      mockAuthUser.set(testUser(5));

      expect(component.userName()).toBe('Admin');
      expect(component.userRoleLabel()).toBe('Administrador');
    });

    it('maps a provider session role to the Professional label', () => {
      mockAuthUser.set({ ...testUser(5), role: 'provider' });

      expect(component.userRoleLabel()).toBe('Profesional');
    });

    it('falls back to empty name/label when no user is authenticated', () => {
      mockAuthUser.set(null);

      expect(component.userName()).toBe('');
      expect(component.userRoleLabel()).toBe('');
    });
  });
});
