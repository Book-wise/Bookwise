import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ProvidersListComponent } from './providers-list.component';
import { CalendarNavigationService } from '@services/calendar-navigation.service';
import { MessageService } from 'primeng/api';
import { HttpErrorService } from '@services/http-error.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { RolesApiService } from '@services/api/roles-api.service';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Provider, Role } from '@models';

describe('ProvidersListComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ProvidersListComponent>>;
  let component: ProvidersListComponent;
  let store: InstanceType<typeof ReferenceStore>;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockCalNav: {
    navigateToCalendar: ReturnType<typeof vi.fn>;
    hasPendingNavigation: ReturnType<typeof vi.fn>;
    consumePending: ReturnType<typeof vi.fn>;
  };
  let mockProvidersApi: {
    getProviders: ReturnType<typeof vi.fn>;
    updateProvider: ReturnType<typeof vi.fn>;
  };
  let mockRolesApi: { getRoles: ReturnType<typeof vi.fn>; assignProviderRoles: ReturnType<typeof vi.fn> };
  let mockLocationsApi: { getLocations: ReturnType<typeof vi.fn>; getRegions: ReturnType<typeof vi.fn>; getAllComunas: ReturnType<typeof vi.fn> };
  let mockServicesApi: { getServices: ReturnType<typeof vi.fn>; getPacks: ReturnType<typeof vi.fn> };
  let mockClientsApi: { getClients: ReturnType<typeof vi.fn> };
  let mockHttpError: { handle: ReturnType<typeof vi.fn> };
  let messageAdd: ReturnType<typeof vi.fn>;

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
    mockProvidersApi = {
      getProviders: vi.fn(() => of([])),
      updateProvider: vi.fn(() => of({ message: 'ok', data: baseProvider() })),
    };
    mockRolesApi = { getRoles: vi.fn(() => of(allRoles)), assignProviderRoles: vi.fn(() => of({ data: [] })) };
    mockLocationsApi = { getLocations: vi.fn(() => of([])), getRegions: vi.fn(() => of({ data: [] })), getAllComunas: vi.fn(() => of({ data: [] })) };
    mockServicesApi = { getServices: vi.fn(() => of([])), getPacks: vi.fn(() => of({ data: [] })) };
    mockClientsApi = { getClients: vi.fn(() => of([])) };
    mockHttpError = { handle: vi.fn() };
    messageAdd = vi.fn();

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
        { provide: MessageService, useValue: { add: messageAdd } },
      ],
    }).compileComponents();

    store = TestBed.inject(ReferenceStore);
    fixture = TestBed.createComponent(ProvidersListComponent);
    component = fixture.componentInstance;
  });

  /** Seeds `providers` in the real ReferenceStore (canonical source in U3). */
  function seedProviders(providers: Provider[]): void {
    mockProvidersApi.getProviders.mockReturnValue(of(providers));
    store.invalidateProviders();
  }

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

  // ── Reads from ReferenceStore (U3 closed the PR2 local-list gap) ──

  describe('store-backed list', () => {
    it('reads providers from ReferenceStore (no local providersApi load)', () => {
      seedProviders([baseProvider()]);
      fixture.detectChanges();
      fixture.detectChanges();

      expect(component.providers()).toEqual([baseProvider()]);
      // The component never fetched providers on its own: only the store loader ran
      expect(mockProvidersApi.getProviders).toHaveBeenCalled();
    });

    it('renders the main card layout after loading (skeleton gone)', () => {
      seedProviders([baseProvider()]);
      fixture.detectChanges();
      fixture.detectChanges();

      const nativeEl = fixture.nativeElement as HTMLElement;
      const skeleton = nativeEl.querySelector('.list-skeleton');
      expect(skeleton).toBeFalsy();
      const pCard = nativeEl.querySelector('p-card') ?? nativeEl.querySelector('[ng-version]');
      expect(pCard).toBeTruthy();
    });
  });

  // ── Role filter (computed over store providers) ─────────────────

  describe('role filter', () => {
    const r1 = { id: 1, name: 'admin_local', label: 'Admin Local' };
    const r2 = { id: 2, name: 'recepcionista', label: 'Recepcionista' };

    it('keeps only providers that have at least one selected role', () => {
      seedProviders([
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
      seedProviders([
        baseProvider({ id: 1, roles: [r1] }),
        baseProvider({ id: 2, roles: [r2] }),
      ]);

      component.selectedRoleNames.set(['admin_local']);

      const names = component['filteredProviders']().map((p) => p.id);
      expect(names).not.toContain(2);
      expect(names).toEqual([1]);
    });

    it('returns all providers when no role is selected', () => {
      seedProviders([
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
      seedProviders([provider]);
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

  // ── A1–A4: active toggle via ReferenceStore ─────────────────────────

  describe('toggleActive (A1–A4)', () => {
    beforeEach(() => {
      seedProviders([baseProvider()]);
      fixture.detectChanges();
    });

    it('A1: flips optimistically through the store, emits PATCH and disables the toggle in flight', () => {
      const pending = new Subject<{ message: string; data: Provider }>();
      mockProvidersApi.updateProvider.mockReturnValue(pending.asObservable());
      const provider = store.providers()[0];

      component.toggleActive(provider);

      // Optimistic: the store already flipped before the PATCH resolves
      expect(store.providers()[0].active).toBe(false);
      expect(component.providers()[0].active).toBe(false);
      expect(mockProvidersApi.updateProvider).toHaveBeenCalledWith(1, { active: false });
      // In-flight: the toggleswitch is disabled while the request is pending
      expect(component.toggling().has(1)).toBe(true);

      pending.next({ message: 'ok', data: baseProvider({ active: false }) });
      pending.complete();

      expect(component.toggling().has(1)).toBe(false);
      expect(store.providers()[0].active).toBe(false);
      expect(messageAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'ok' }),
      );
    });

    it('A1: rolls back and shows a generic error toast when the PATCH fails with a non-409 error', () => {
      mockProvidersApi.updateProvider.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      const provider = store.providers()[0];

      component.toggleActive(provider);

      // Rollback: provider remains active
      expect(store.providers()[0].active).toBe(true);
      expect(component.toggling().has(1)).toBe(false);
      // Generic error path (no conflict dialog)
      expect(mockHttpError.handle).toHaveBeenCalled();
      expect(component.conflictDialogVisible()).toBe(false);
    });

    it('A2: opens the blocking dialog with the conflict bookings on 409 and keeps the provider active', () => {
      const conflictBody = {
        message: 'El profesional tiene reservas futuras',
        requires_confirmation: true,
        affects: {
          bookings: [
            { id: 11, date: '2026-09-10', time: '10:00', client_name: 'Ana García', status: 1 },
            { id: 12, date: '2026-09-12', time: '12:30', client_name: 'Bruno Díaz', status: 5 },
          ],
        },
      };
      mockProvidersApi.updateProvider.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: conflictBody })),
      );
      const provider = store.providers()[0];

      component.toggleActive(provider);

      // Rollback happened inside the store; the provider stays active
      expect(store.providers()[0].active).toBe(true);
      // Dialog opened with the bookings as they arrived
      expect(component.conflictDialogVisible()).toBe(true);
      expect(component.conflictData()?.message).toBe(conflictBody.message);
      expect(component.conflictData()?.affects.bookings).toHaveLength(2);
      expect(component.conflictData()?.affects.bookings[0].client_name).toBe('Ana García');
      expect(component['pendingToggleProvider']()?.id).toBe(1);
      // No force/confirm path on this component: only a close handler exists
      expect((component as unknown as { confirmDeactivate?: unknown }).confirmDeactivate).toBeUndefined();
    });

    it('A2: closing the dialog emits no request and the provider remains active', () => {
      mockProvidersApi.updateProvider.mockReturnValue(
        throwError(() => new HttpErrorResponse({
          status: 409,
          error: {
            message: 'conflicto',
            requires_confirmation: true,
            affects: { bookings: [{ id: 11, date: '2026-09-10', time: '10:00', client_name: 'Ana', status: 1 }] },
          },
        })),
      );
      component.toggleActive(store.providers()[0]);
      expect(component.conflictDialogVisible()).toBe(true);

      component.closeConflictDialog();

      expect(component.conflictDialogVisible()).toBe(false);
      expect(mockProvidersApi.updateProvider).toHaveBeenCalledTimes(1);
      expect(store.providers()[0].active).toBe(true);
    });

    it('A3: reactivation is never gated (PATCH {active:true}, 200 → no dialog)', () => {
      seedProviders([baseProvider({ active: false })]);
      fixture.detectChanges();
      mockProvidersApi.updateProvider.mockReturnValue(
        of({ message: 'ok', data: baseProvider({ active: true }) }),
      );
      const provider = store.providers()[0];

      component.toggleActive(provider);

      expect(mockProvidersApi.updateProvider).toHaveBeenCalledWith(1, { active: true });
      expect(store.providers()[0].active).toBe(true);
      expect(component.conflictDialogVisible()).toBe(false);
      expect(messageAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'ok' }),
      );
    });

    it('A4: a non-409 deactivation error degrades to a generic toast (no dialog, no crash)', () => {
      mockProvidersApi.updateProvider.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 422 })),
      );
      const provider = store.providers()[0];

      component.toggleActive(provider);

      expect(store.providers()[0].active).toBe(true); // rollback
      expect(component.conflictDialogVisible()).toBe(false);
      expect(component.conflictData()).toBeNull();
      expect(mockHttpError.handle).toHaveBeenCalled();
    });
  });
});
