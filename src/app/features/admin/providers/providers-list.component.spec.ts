import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { ProvidersListComponent } from './providers-list.component';
import { CalendarNavigationService } from '@services/calendar-navigation.service';
import { MessageService } from 'primeng/api';
import { HttpErrorService } from '@services/http-error.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { RolesApiService } from '@services/api/roles-api.service';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { Provider, Role } from '@models';

describe('ProvidersListComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ProvidersListComponent>>;
  let component: ProvidersListComponent;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockCalNav: {
    navigateToCalendar: ReturnType<typeof vi.fn>;
    hasPendingNavigation: ReturnType<typeof vi.fn>;
    consumePending: ReturnType<typeof vi.fn>;
  };
  let mockProvidersApi: { getProviders: ReturnType<typeof vi.fn> };
  let mockRolesApi: { getRoles: ReturnType<typeof vi.fn> };
  let mockLocationsApi: { getLocations: ReturnType<typeof vi.fn>; getRegions: ReturnType<typeof vi.fn>; getAllComunas: ReturnType<typeof vi.fn> };
  let mockServicesApi: { getServices: ReturnType<typeof vi.fn>; getPacks: ReturnType<typeof vi.fn> };
  let mockClientsApi: { getClients: ReturnType<typeof vi.fn> };
  let mockHttpError: { handle: ReturnType<typeof vi.fn> };

  const baseProvider = (overrides: Partial<Provider> = {}): Provider => ({
    id: 1,
    first_name: 'Juan',
    last_name: 'Pérez',
    email: 'juan@test.com',
    phone: null,
    active: true,
    location: { id: 5, name: 'Sucursal Centro', address: '', city: '', timezone: 'America/Santiago', active: true },
    ...overrides,
  });

  beforeEach(async () => {
    const allRoles: Role[] = [
      { id: 1, name: 'admin_local', label: 'Admin Local' },
      { id: 2, name: 'recepcionista', label: 'Recepcionista' },
      { id: 3, name: 'staff', label: 'Staff' },
    ];

    mockRouter = { navigate: vi.fn() };
    mockCalNav = {
      navigateToCalendar: vi.fn(),
      hasPendingNavigation: vi.fn(() => false),
      consumePending: vi.fn(() => ({ locationId: null, providerId: null })),
    };
    mockProvidersApi = { getProviders: vi.fn(() => of([])) };
    mockRolesApi = { getRoles: vi.fn(() => of(allRoles)) };
    mockLocationsApi = { getLocations: vi.fn(() => of([])), getRegions: vi.fn(() => of({ data: [] })), getAllComunas: vi.fn(() => of({ data: [] })) };
    mockServicesApi = { getServices: vi.fn(() => of([])), getPacks: vi.fn(() => of({ data: [] })) };
    mockClientsApi = { getClients: vi.fn(() => of([])) };
    mockHttpError = { handle: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ProvidersListComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: mockRouter },
        { provide: CalendarNavigationService, useValue: mockCalNav },
        { provide: ProvidersApiService, useValue: mockProvidersApi },
        { provide: RolesApiService, useValue: mockRolesApi },
        { provide: LocationsApiService, useValue: mockLocationsApi },
        { provide: ServicesApiService, useValue: mockServicesApi },
        { provide: ClientsApiService, useValue: mockClientsApi },
        { provide: HttpErrorService, useValue: mockHttpError },
        { provide: MessageService, useValue: { add: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProvidersListComponent);
    component = fixture.componentInstance;
  });

  // ── goToAgenda (unit behavior) ──────────────────────────────────

  describe('goToAgenda', () => {
    it('calls navigateToCalendar with location.id and provider.id', () => {
      const provider = baseProvider();
      component.goToAgenda(provider);

      expect(mockCalNav.navigateToCalendar).toHaveBeenCalledTimes(1);
      expect(mockCalNav.navigateToCalendar).toHaveBeenCalledWith(5, 1, [], mockRouter);
    });

    it('does nothing when provider has no location', () => {
      const provider = baseProvider({ location: null });
      component.goToAgenda(provider);

      expect(mockCalNav.navigateToCalendar).not.toHaveBeenCalled();
    });
  });

  // ── Component state after loading ────────────────────────────────

  describe('component state', () => {
    it('resolves loading=false after detectChanges with synchronous mock', () => {
      fixture.detectChanges();
      fixture.detectChanges();
      expect(component['loading']()).toBe(false);
    });

    it('renders the main card layout after loading', () => {
      component.providers.set([baseProvider()]);
      component['loading'].set(false);
      fixture.detectChanges();

      const nativeEl = fixture.nativeElement as HTMLElement;
      const skeleton = nativeEl.querySelector('.list-skeleton');

      // Should not show loading skeleton
      expect(skeleton).toBeFalsy();
      // Should show the p-card content (loading state is false)
      const pCard = nativeEl.querySelector('p-card') ?? nativeEl.querySelector('[ng-version]');
      expect(pCard).toBeTruthy();
    });
  });

  // ── Role filter ─────────────────────────────────────────────────

  describe('role filter', () => {
    const r1 = { id: 1, name: 'admin_local', label: 'Admin Local' };
    const r2 = { id: 2, name: 'recepcionista', label: 'Recepcionista' };

    it('keeps only providers that have at least one selected role', () => {
      component.providers.set([
        baseProvider({ id: 1, roles: [r1] }),
        baseProvider({ id: 2, roles: [r2] }),
        baseProvider({ id: 3, roles: [] }),
        baseProvider({ id: 4, roles: undefined }),
      ]);

      component.selectedRoleNames.set(['admin_local']);

      const names = component['filteredProviders']().map((p) => p.id);
      expect(names).toEqual([1]);
    });

    it('excludes a provider that does not match any selected role', () => {
      component.providers.set([
        baseProvider({ id: 1, roles: [r1] }),
        baseProvider({ id: 2, roles: [r2] }),
      ]);

      component.selectedRoleNames.set(['admin_local']);

      const names = component['filteredProviders']().map((p) => p.id);
      expect(names).not.toContain(2);
      expect(names).toEqual([1]);
    });

    it('returns all providers when no role is selected', () => {
      component.providers.set([
        baseProvider({ id: 1, roles: [r1] }),
        baseProvider({ id: 2, roles: [] }),
      ]);

      component.selectedRoleNames.set([]);

      expect(component['filteredProviders']().length).toBe(2);
    });
  });

  // ── Agenda button render (desktop table + mobile cards) ────────────

  describe('agenda button rendering', () => {
    function agendaButtons(nativeEl: HTMLElement): HTMLElement[] {
      // Agenda buttons render in both the desktop table (icon-only) and the
      // mobile cards (icon + label). Match by rendered content, not by input
      // attributes (component inputs are not reflected to the host DOM).
      return Array.from(nativeEl.querySelectorAll<HTMLElement>('p-button')).filter(
        (btn) => btn.querySelector('i.pi-calendar') !== null || btn.textContent?.includes('Agenda'),
      );
    }

    function renderWith(provider: Provider): HTMLElement {
      // Load the data through the API mock so ngOnInit's loadProviders() yields
      // the fixture instead of the beforeEach empty-list default.
      mockProvidersApi.getProviders.mockReturnValue(of([provider]));
      fixture.detectChanges();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('enables the Agenda button with "Ver Agenda" tooltip when the provider has a location', () => {
      const nativeEl = renderWith(baseProvider());

      const buttons = agendaButtons(nativeEl);
      expect(buttons.length).toBeGreaterThan(0);
      for (const btn of buttons) {
        const inner = btn.querySelector('button');
        expect(inner).toBeTruthy();
        expect(inner!.disabled).toBe(false);
      }

      buttons[0].dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      const tooltip = document.body.querySelector('.p-tooltip .p-tooltip-text');
      expect(tooltip?.textContent?.trim()).toBe('Ver Agenda');
    });

    it('disables the Agenda button with "Sin sucursal asignada" tooltip when the provider has no location', () => {
      const nativeEl = renderWith(baseProvider({ location: null }));

      const buttons = agendaButtons(nativeEl);
      expect(buttons.length).toBeGreaterThan(0);
      for (const btn of buttons) {
        const inner = btn.querySelector('button');
        expect(inner).toBeTruthy();
        expect(inner!.disabled).toBe(true);
      }

      buttons[0].dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      const tooltip = document.body.querySelector('.p-tooltip .p-tooltip-text');
      expect(tooltip?.textContent?.trim()).toBe('Sin sucursal asignada');
    });
  });
});
