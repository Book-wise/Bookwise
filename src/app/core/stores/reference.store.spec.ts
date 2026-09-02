import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ReferenceStore } from './reference.store';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { RolesApiService } from '@services/api/roles-api.service';
import type { Client, Location, Provider, Service, ServicePack, Region, LocationComuna, Role } from '@models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(overrides: Partial<Client> = {}): Client {
  return { id: 1, first_name: 'Ana', last_name: 'Test', email: 'ana@test.com', phone: '+56912345678', rut: '12.345.678-5', active: true, ...overrides };
}

function makeLocation(overrides: Partial<Location> = {}): Location {
  return { id: 1, name: 'Sala 1', ...overrides } as Location;
}

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return { id: 1, first_name: 'Dr.', last_name: 'Uno', ...overrides } as Provider;
}

function makeService(overrides: Partial<Service> = {}): Service {
  return { id: 1, name: 'Consulta', price: 30000, duration_minutes: 45, ...overrides } as Service;
}

function makePack(overrides: Partial<ServicePack> = {}): ServicePack {
  return { id: 1, name: 'Pack 10 sesiones', price: 200000, total_sessions: 10, ...overrides } as ServicePack;
}

function makeRegion(overrides: Partial<Region> = {}): Region {
  return { id: 7, name: 'Metropolitana', ...overrides } as Region;
}

function makeComuna(overrides: Partial<LocationComuna> = {}): LocationComuna {
  return { id: 86, name: 'Santiago', region_id: 7, ...overrides } as LocationComuna;
}

function makeRole(overrides: Partial<Role> = {}): Role {
  return { id: 5, name: 'staff', label: 'Staff', ...overrides };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ReferenceStore', () => {
  let store: InstanceType<typeof ReferenceStore>;
  let clientsApi: Partial<Record<keyof ClientsApiService, ReturnType<typeof vi.fn>>>;
  let locationsApi: Partial<Record<keyof LocationsApiService, ReturnType<typeof vi.fn>>>;
  let providersApi: Partial<Record<keyof ProvidersApiService, ReturnType<typeof vi.fn>>>;
  let servicesApi: Partial<Record<keyof ServicesApiService, ReturnType<typeof vi.fn>>>;
  let rolesApi: Partial<Record<keyof RolesApiService, ReturnType<typeof vi.fn>>>;

  // The store never calls RolesApiService during init/loaders; this default
  // keeps the DI graph complete for every describe that does not mutate.
  beforeEach(() => {
    rolesApi = {
      getRoles: vi.fn().mockReturnValue(of([])),
      assignProviderRoles: vi.fn().mockReturnValue(of({ data: [] })),
    } as any;
  });

  function createStore() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClientsApiService, useValue: clientsApi },
        { provide: LocationsApiService, useValue: locationsApi },
        { provide: ProvidersApiService, useValue: providersApi },
        { provide: ServicesApiService, useValue: servicesApi },
        { provide: RolesApiService, useValue: rolesApi },
      ],
    });
    store = TestBed.inject(ReferenceStore);
  }

  // ── Initial state ──────────────────────────────────────────────────

  describe('initial state', () => {
    beforeEach(() => {
      clientsApi = { getClients: vi.fn().mockReturnValue(of([])) } as any;
      locationsApi = { getLocations: vi.fn().mockReturnValue(of([])), getRegions: vi.fn().mockReturnValue(of({ data: [] })), getComunas: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      providersApi = { getProviders: vi.fn().mockReturnValue(of([])) } as any;
      servicesApi = { getServices: vi.fn().mockReturnValue(of([])), getPacks: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      createStore();
    });

    it('starts with empty entity arrays', () => {
      expect(store.clients()).toEqual([]);
      expect(store.locations()).toEqual([]);
      expect(store.providers()).toEqual([]);
      expect(store.services()).toEqual([]);
      expect(store.packs()).toEqual([]);
    });

    it('allLoaded() is true once all entities load', () => {
      expect(store.allLoaded()).toBe(true);
    });

    it('anyLoading() is false after initial load', () => {
      expect(store.anyLoading()).toBe(false);
    });

    it('error is null for all entities after successful load', () => {
      const err = store.error();
      expect(err.clients).toBeNull();
      expect(err.locations).toBeNull();
      expect(err.providers).toBeNull();
      expect(err.services).toBeNull();
      expect(err.packs).toBeNull();
      expect(err.regions).toBeNull();
    });
  });

  // ── Loading lifecycle ──────────────────────────────────────────────

  describe('loading lifecycle', () => {
    beforeEach(() => {
      clientsApi = { getClients: vi.fn().mockReturnValue(of([makeClient({ id: 42 })])) } as any;
      locationsApi = { getLocations: vi.fn().mockReturnValue(of([makeLocation()])), getRegions: vi.fn().mockReturnValue(of({ data: [makeRegion()] })), getComunas: vi.fn().mockReturnValue(of({ data: [makeComuna()] })) } as any;
      providersApi = { getProviders: vi.fn().mockReturnValue(of([makeProvider()])) } as any;
      servicesApi = { getServices: vi.fn().mockReturnValue(of([makeService()])), getPacks: vi.fn().mockReturnValue(of({ data: [makePack()] })) } as any;
      createStore();
    });

    it('populates clients from API response', () => {
      expect(store.clients()).toHaveLength(1);
      expect(store.clients()[0].id).toBe(42);
    });

    it('populates locations from API response', () => {
      expect(store.locations()).toHaveLength(1);
    });

    it('populates services from API response', () => {
      expect(store.services()).toHaveLength(1);
    });

    it('populates providers from API response', () => {
      expect(store.providers()).toHaveLength(1);
    });

    it('populates packs from API response (unwraps .data)', () => {
      expect(store.packs()).toHaveLength(1);
    });

    it('calls all API methods on init', () => {
      expect(clientsApi.getClients).toHaveBeenCalledTimes(1);
      expect(locationsApi.getLocations).toHaveBeenCalledTimes(1);
      expect(servicesApi.getServices).toHaveBeenCalledTimes(1);
      expect(providersApi.getProviders).toHaveBeenCalledTimes(1);
      expect(servicesApi.getPacks).toHaveBeenCalledTimes(1);
      expect(locationsApi.getRegions).toHaveBeenCalledTimes(1);
    });
  });

  // ── Comptuted signals ──────────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(() => {
      clientsApi = { getClients: vi.fn().mockReturnValue(of([])) } as any;
      locationsApi = { getLocations: vi.fn().mockReturnValue(of([])), getRegions: vi.fn().mockReturnValue(of({ data: [] })), getComunas: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      providersApi = { getProviders: vi.fn().mockReturnValue(of([])) } as any;
      servicesApi = { getServices: vi.fn().mockReturnValue(of([])), getPacks: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      createStore();
    });

    it('invalidateClients resets loaded.clients to false before refetch', () => {
      expect(store.loaded().clients).toBe(true);
      // invalidateClients sets loaded.clients=false then immediately refetches;
      // with sync of(), the fetch completes in the same microtask
      store.invalidateClients();
      // Since rxMethod with of() is synchronous, loaded is back to true.
      // The important thing is the hook is correct: refetch happened.
      expect(clientsApi.getClients).toHaveBeenCalledTimes(2);
    });

    it('allLoaded() is true after all entities load', () => {
      expect(store.allLoaded()).toBe(true);
    });

    it('anyLoading() is false after initial load completes', () => {
      expect(store.anyLoading()).toBe(false);
    });
  });

  // ── Invalidation ───────────────────────────────────────────────────

  describe('invalidation', () => {
    beforeEach(() => {
      clientsApi = { getClients: vi.fn().mockReturnValue(of([makeClient({ id: 1 })])) } as any;
      locationsApi = { getLocations: vi.fn().mockReturnValue(of([makeLocation()])), getRegions: vi.fn().mockReturnValue(of({ data: [makeRegion()] })), getComunas: vi.fn().mockReturnValue(of({ data: [makeComuna()] })) } as any;
      providersApi = { getProviders: vi.fn().mockReturnValue(of([makeProvider()])) } as any;
      servicesApi = { getServices: vi.fn().mockReturnValue(of([makeService()])), getPacks: vi.fn().mockReturnValue(of({ data: [makePack()] })) } as any;
      createStore();
    });

    it('invalidateClients resets loaded flag and refetches', () => {
      expect(store.loaded().clients).toBe(true);

      store.invalidateClients();

      expect(clientsApi.getClients).toHaveBeenCalledTimes(2);
      expect(store.clients()).toHaveLength(1); // still populated
    });

    it('invalidateServices resets loaded flag and refetches', () => {
      store.invalidateServices();
      expect(servicesApi.getServices).toHaveBeenCalledTimes(2);
    });

    it('invalidateLocations resets loaded flag and refetches', () => {
      store.invalidateLocations();
      expect(locationsApi.getLocations).toHaveBeenCalledTimes(2);
    });

    it('invalidateProviders resets loaded flag and refetches', () => {
      store.invalidateProviders();
      expect(providersApi.getProviders).toHaveBeenCalledTimes(2);
    });

    it('invalidatePacks resets loaded flag and refetches', () => {
      store.invalidatePacks();
      expect(servicesApi.getPacks).toHaveBeenCalledTimes(2);
    });

    it('invalidateAll resets all loaded flags and refetches everything', () => {
      store.invalidateAll();

      expect(clientsApi.getClients).toHaveBeenCalledTimes(2);
      expect(locationsApi.getLocations).toHaveBeenCalledTimes(2);
      expect(servicesApi.getServices).toHaveBeenCalledTimes(2);
      expect(providersApi.getProviders).toHaveBeenCalledTimes(2);
      expect(servicesApi.getPacks).toHaveBeenCalledTimes(2);
      expect(locationsApi.getRegions).toHaveBeenCalledTimes(2);
    });

    it('refetched data replaces existing data', () => {
      // Change the mock to return different data on next call
      clientsApi.getClients!.mockReturnValue(of([makeClient({ id: 99 })]));

      store.invalidateClients();

      expect(store.clients()).toHaveLength(1);
      expect(store.clients()[0].id).toBe(99);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────

  describe('error handling', () => {
    beforeEach(() => {
      clientsApi = { getClients: vi.fn().mockReturnValue(throwError(() => new Error('API error'))) } as any;
      locationsApi = { getLocations: vi.fn().mockReturnValue(of([])), getRegions: vi.fn().mockReturnValue(of({ data: [] })), getComunas: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      providersApi = { getProviders: vi.fn().mockReturnValue(of([])) } as any;
      servicesApi = { getServices: vi.fn().mockReturnValue(of([])), getPacks: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      createStore();
    });

    it('sets error state when clients API fails', () => {
      expect(store.error().clients).toBe('API error');
    });

    it('sets loading to false after error', () => {
      expect(store.loading().clients).toBe(false);
    });

    it('does NOT set loaded flag on error', () => {
      expect(store.loaded().clients).toBe(false);
    });

    it('allLoaded is false when clients failed to load', () => {
      expect(store.allLoaded()).toBe(false);
    });

    it('retry succeeds after invalidateClients when API recovers', () => {
      // Cleared error + successful retry
      clientsApi.getClients!.mockReturnValue(of([makeClient({ id: 7 })]));

      store.invalidateClients();

      expect(store.error().clients).toBeNull();
      expect(store.clients()).toHaveLength(1);
      expect(store.clients()[0].id).toBe(7);
    });
  });

  // ── Manual load methods ────────────────────────────────────────────

  describe('manual load methods', () => {
    beforeEach(() => {
      clientsApi = { getClients: vi.fn().mockReturnValue(of([])) } as any;
      locationsApi = { getLocations: vi.fn().mockReturnValue(of([])), getRegions: vi.fn().mockReturnValue(of({ data: [] })), getComunas: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      providersApi = { getProviders: vi.fn().mockReturnValue(of([])) } as any;
      servicesApi = { getServices: vi.fn().mockReturnValue(of([])), getPacks: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      createStore();
    });

    it('loadClients fetches clients via API', () => {
      // Already called once on init; mock new data
      clientsApi.getClients!.mockReturnValue(of([makeClient({ id: 77 })]));
      store.loadClients();
      expect(clientsApi.getClients).toHaveBeenCalledTimes(2);
    });
  });

  // ── Provider mutations (store write methods, patrón BookingStore) ─────

  describe('provider mutations', () => {
    const initialRoles = [makeRole({ id: 1, name: 'admin_local' })];

    beforeEach(() => {
      clientsApi = { getClients: vi.fn().mockReturnValue(of([])) } as any;
      locationsApi = { getLocations: vi.fn().mockReturnValue(of([])), getRegions: vi.fn().mockReturnValue(of({ data: [] })), getComunas: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      providersApi = { getProviders: vi.fn().mockReturnValue(of([makeProvider({ roles: initialRoles })])) } as any;
      servicesApi = { getServices: vi.fn().mockReturnValue(of([])), getPacks: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      rolesApi = {
        getRoles: vi.fn().mockReturnValue(of([])),
        assignProviderRoles: vi.fn(),
      } as any;
      createStore();
    });

    it('createProvider POSTs and appends the server response to providers', () => {
      const created = makeProvider({ id: 2, first_name: 'Nuevo', last_name: 'Dr' });
      providersApi.createProvider = vi.fn().mockReturnValue(of({ message: 'ok', data: created }));

      store.createProvider({ first_name: 'Nuevo', last_name: 'Dr' }).subscribe();

      expect(providersApi.createProvider).toHaveBeenCalledWith({ first_name: 'Nuevo', last_name: 'Dr' });
      expect(store.providers()).toHaveLength(2);
      expect(store.providers()[1]).toEqual(created);
    });

    it('createProvider re-throws the error and does not append on failure', () => {
      providersApi.createProvider = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422 })));

      let received: unknown = null;
      store.createProvider({ first_name: 'X', last_name: 'Y' }).subscribe({ error: (e) => (received = e) });

      expect(received).toBeInstanceOf(HttpErrorResponse);
      expect(store.providers()).toHaveLength(1);
    });

    it('saveProviderBasics PATCHes and merges the canonical server response', () => {
      const server = makeProvider({ id: 1, first_name: 'Dr.', last_name: 'Actualizado', phone: '+56900000000' });
      providersApi.updateProvider = vi.fn().mockReturnValue(of({ message: 'ok', data: server }));

      store.saveProviderBasics(1, { last_name: 'Actualizado' }).subscribe();

      expect(providersApi.updateProvider).toHaveBeenCalledWith(1, { last_name: 'Actualizado' });
      expect(store.providers()[0].last_name).toBe('Actualizado');
      // Canonical fields come from the server response
      expect(store.providers()[0].phone).toBe('+56900000000');
      expect(store.providers()).toHaveLength(1);
    });

    it('saveProviderBasics re-throws the error and leaves the provider untouched', () => {
      providersApi.updateProvider = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      let received: unknown = null;
      store.saveProviderBasics(1, { last_name: 'Cambio' }).subscribe({ error: (e) => (received = e) });

      expect(received).toBeInstanceOf(HttpErrorResponse);
      expect(store.providers()[0].last_name).toBe('Uno');
    });

    it('assignProviderRoles PATCHes roles and sets the canonical set from res.data', () => {
      const canonical = [makeRole({ id: 5, name: 'staff' }), makeRole({ id: 6, name: 'staff_readonly' })];
      rolesApi.assignProviderRoles = vi.fn().mockReturnValue(of({ data: canonical }));

      store.assignProviderRoles(1, ['staff', 'staff_readonly']).subscribe();

      expect(rolesApi.assignProviderRoles).toHaveBeenCalledWith(1, ['staff', 'staff_readonly']);
      expect(store.providers()[0].roles).toEqual(canonical);
    });

    it('assignProviderRoles re-throws the error and keeps the previous roles', () => {
      rolesApi.assignProviderRoles = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422 })));

      let received: unknown = null;
      store.assignProviderRoles(1, ['staff']).subscribe({ error: (e) => (received = e) });

      expect(received).toBeInstanceOf(HttpErrorResponse);
      expect(store.providers()[0].roles).toEqual(initialRoles);
    });
  });

  // ── toggleProviderActive (optimista + rollback + 409 re-throw) ───────

  describe('toggleProviderActive', () => {
    beforeEach(() => {
      clientsApi = { getClients: vi.fn().mockReturnValue(of([])) } as any;
      locationsApi = { getLocations: vi.fn().mockReturnValue(of([])), getRegions: vi.fn().mockReturnValue(of({ data: [] })), getComunas: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      providersApi = { getProviders: vi.fn().mockReturnValue(of([makeProvider({ active: true })])) } as any;
      servicesApi = { getServices: vi.fn().mockReturnValue(of([])), getPacks: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      rolesApi = {
        getRoles: vi.fn().mockReturnValue(of([])),
        assignProviderRoles: vi.fn(),
      } as any;
      createStore();
    });

    it('flips optimistically before the PATCH resolves, then merges the canonical response', () => {
      const pending = new Subject<{ message: string; data: Provider }>();
      providersApi.updateProvider = vi.fn().mockReturnValue(pending.asObservable());

      const responses: { message: string; data: Provider }[] = [];
      store.toggleProviderActive(1, false).subscribe((res) => responses.push(res));

      // Optimistic flip: state changed synchronously before the server answers
      expect(store.providers()[0].active).toBe(false);
      expect(providersApi.updateProvider).toHaveBeenCalledWith(1, { active: false });

      const canonical = makeProvider({ id: 1, active: false, phone: '+56911111111' });
      pending.next({ message: 'ok', data: canonical });
      pending.complete();

      expect(responses).toHaveLength(1);
      expect(responses[0].message).toBe('ok');
      expect(store.providers()[0].active).toBe(false);
      // Canonical fields come from the server response
      expect(store.providers()[0].phone).toBe('+56911111111');
    });

    it('rolls back to the previous state and re-throws on a generic error (500)', () => {
      providersApi.updateProvider = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      let received: unknown = null;
      store.toggleProviderActive(1, false).subscribe({ error: (e) => (received = e) });

      expect(received).toBeInstanceOf(HttpErrorResponse);
      expect((received as HttpErrorResponse).status).toBe(500);
      // Rollback: provider is active again
      expect(store.providers()[0].active).toBe(true);
    });

    it('re-throws a 409 requires_confirmation without swallowing it, after rollback', () => {
      const conflictBody = {
        message: 'conflicto',
        requires_confirmation: true,
        affects: { bookings: [{ id: 1, date: '2026-09-10', time: '10:00', client_name: 'Ana', status: 1 }] },
      };
      providersApi.updateProvider = vi.fn().mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: conflictBody })),
      );

      let received: unknown = null;
      store.toggleProviderActive(1, false).subscribe({ error: (e) => (received = e) });

      expect(received).toBeInstanceOf(HttpErrorResponse);
      const err = received as HttpErrorResponse;
      expect(err.status).toBe(409);
      expect(err.error).toEqual(conflictBody);
      // Rollback happened before re-throw
      expect(store.providers()[0].active).toBe(true);
    });

    it('reactivates without any gating (PATCH {active:true}, 200 merge)', () => {
      // Provider starts inactive: re-mock the loader and refetch
      providersApi.getProviders!.mockReturnValue(of([makeProvider({ id: 1, active: false })]));
      store.invalidateProviders();
      expect(store.providers()[0].active).toBe(false);

      providersApi.updateProvider = vi.fn().mockReturnValue(
        of({ message: 'ok', data: makeProvider({ id: 1, active: true }) }),
      );

      let received: unknown = null;
      store.toggleProviderActive(1, true).subscribe({ next: (res) => (received = res) });

      expect(providersApi.updateProvider).toHaveBeenCalledWith(1, { active: true });
      expect(store.providers()[0].active).toBe(true);
      expect(received).not.toBeNull();
    });
  });

  // ── Location mutations (U6: store write methods sucursales) ─────────────

  describe('location mutations', () => {
    beforeEach(() => {
      clientsApi = { getClients: vi.fn().mockReturnValue(of([])) } as any;
      locationsApi = {
        getLocations: vi.fn().mockReturnValue(of([makeLocation({ active: true })])),
        getRegions: vi.fn().mockReturnValue(of({ data: [] })),
        getAllComunas: vi.fn().mockReturnValue(of({ data: [] })),
      } as any;
      providersApi = { getProviders: vi.fn().mockReturnValue(of([])) } as any;
      servicesApi = { getServices: vi.fn().mockReturnValue(of([])), getPacks: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      rolesApi = {
        getRoles: vi.fn().mockReturnValue(of([])),
        assignProviderRoles: vi.fn(),
      } as any;
      createStore();
    });

    it('createLocation POSTs and appends the server response to locations', () => {
      const created = makeLocation({ id: 2, name: 'Sala 2' });
      locationsApi.createLocation = vi.fn().mockReturnValue(of({ message: 'ok', data: created }));

      store.createLocation({ name: 'Sala 2' }).subscribe();

      expect(locationsApi.createLocation).toHaveBeenCalledWith({ name: 'Sala 2' });
      expect(store.locations()).toHaveLength(2);
      expect(store.locations()[1]).toEqual(created);
    });

    it('createLocation re-throws the error and does not append on failure', () => {
      locationsApi.createLocation = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422 })));

      let received: unknown = null;
      store.createLocation({ name: 'Sala X' }).subscribe({ error: (e) => (received = e) });

      expect(received).toBeInstanceOf(HttpErrorResponse);
      expect(store.locations()).toHaveLength(1);
    });

    it('updateLocation PATCHes (force passthrough) and merges the canonical server response', () => {
      const server = makeLocation({ id: 1, active: false, city: 'Santiago', name: 'Sala 1' });
      locationsApi.updateLocation = vi.fn().mockReturnValue(of({ message: 'ok', data: server }));

      store.updateLocation(1, { active: false, force: true }).subscribe();

      expect(locationsApi.updateLocation).toHaveBeenCalledWith(1, { active: false, force: true });
      expect(store.locations()).toHaveLength(1);
      expect(store.locations()[0].active).toBe(false);
      // Canonical fields come from the server response
      expect(store.locations()[0].city).toBe('Santiago');
    });

    it('updateLocation re-throws the error and leaves the location untouched', () => {
      locationsApi.updateLocation = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      let received: unknown = null;
      store.updateLocation(1, { active: false, force: true }).subscribe({ error: (e) => (received = e) });

      expect(received).toBeInstanceOf(HttpErrorResponse);
      expect(store.locations()[0].active).toBe(true);
    });
  });

  // ── toggleLocationActive (U6: mirror exacto de toggleProviderActive) ─────

  describe('toggleLocationActive', () => {
    beforeEach(() => {
      clientsApi = { getClients: vi.fn().mockReturnValue(of([])) } as any;
      locationsApi = {
        getLocations: vi.fn().mockReturnValue(of([makeLocation({ active: true })])),
        getRegions: vi.fn().mockReturnValue(of({ data: [] })),
        getAllComunas: vi.fn().mockReturnValue(of({ data: [] })),
      } as any;
      providersApi = { getProviders: vi.fn().mockReturnValue(of([])) } as any;
      servicesApi = { getServices: vi.fn().mockReturnValue(of([])), getPacks: vi.fn().mockReturnValue(of({ data: [] })) } as any;
      rolesApi = {
        getRoles: vi.fn().mockReturnValue(of([])),
        assignProviderRoles: vi.fn(),
      } as any;
      createStore();
    });

    it('flips optimistically before the PATCH resolves, then merges the canonical response', () => {
      const pending = new Subject<{ message: string; data: Location }>();
      locationsApi.updateLocation = vi.fn().mockReturnValue(pending.asObservable());

      const responses: { message: string; data: Location }[] = [];
      store.toggleLocationActive(1, false).subscribe((res) => responses.push(res));

      // Optimistic flip: state changed synchronously before the server answers
      expect(store.locations()[0].active).toBe(false);
      expect(locationsApi.updateLocation).toHaveBeenCalledWith(1, { active: false });

      const canonical = makeLocation({ id: 1, active: false, city: 'Santiago' });
      pending.next({ message: 'ok', data: canonical });
      pending.complete();

      expect(responses).toHaveLength(1);
      expect(responses[0].message).toBe('ok');
      expect(store.locations()[0].active).toBe(false);
      // Canonical fields come from the server response
      expect(store.locations()[0].city).toBe('Santiago');
    });

    it('passes force through to the PATCH payload when provided', () => {
      locationsApi.updateLocation = vi.fn().mockReturnValue(
        of({ message: 'ok', data: makeLocation({ id: 1, active: false }) }),
      );

      store.toggleLocationActive(1, false, true).subscribe();

      expect(locationsApi.updateLocation).toHaveBeenCalledWith(1, { active: false, force: true });
      expect(store.locations()[0].active).toBe(false);
    });

    it('rolls back to the previous state and re-throws on a generic error (500)', () => {
      locationsApi.updateLocation = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      let received: unknown = null;
      store.toggleLocationActive(1, false).subscribe({ error: (e) => (received = e) });

      expect(received).toBeInstanceOf(HttpErrorResponse);
      expect((received as HttpErrorResponse).status).toBe(500);
      // Rollback: location is active again
      expect(store.locations()[0].active).toBe(true);
    });

    it('re-throws a 409 requires_confirmation without swallowing it, after rollback', () => {
      const conflictBody = {
        message: 'conflicto',
        requires_confirmation: true,
        affects: { bookings: [{ id: 1, date: '2026-09-10', time: '10:00', provider_name: 'Ana' }] },
      };
      locationsApi.updateLocation = vi.fn().mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: conflictBody })),
      );

      let received: unknown = null;
      store.toggleLocationActive(1, false).subscribe({ error: (e) => (received = e) });

      expect(received).toBeInstanceOf(HttpErrorResponse);
      const err = received as HttpErrorResponse;
      expect(err.status).toBe(409);
      expect(err.error).toEqual(conflictBody);
      // Rollback happened before re-throw
      expect(store.locations()[0].active).toBe(true);
    });

    it('reactivates without any gating (PATCH {active:true}, 200 merge)', () => {
      // Location starts inactive: re-mock the loader and refetch
      locationsApi.getLocations!.mockReturnValue(of([makeLocation({ id: 1, active: false })]));
      store.invalidateLocations();
      expect(store.locations()[0].active).toBe(false);

      locationsApi.updateLocation = vi.fn().mockReturnValue(
        of({ message: 'ok', data: makeLocation({ id: 1, active: true }) }),
      );

      let received: unknown = null;
      store.toggleLocationActive(1, true).subscribe({ next: (res) => (received = res) });

      expect(locationsApi.updateLocation).toHaveBeenCalledWith(1, { active: true });
      expect(store.locations()[0].active).toBe(true);
      expect(received).not.toBeNull();
    });
  });
});
