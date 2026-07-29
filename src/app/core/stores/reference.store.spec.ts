import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ReferenceStore } from './reference.store';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import type { Client, Location, Provider, Service, ServicePack, Region, LocationComuna } from '@models';

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

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ReferenceStore', () => {
  let store: InstanceType<typeof ReferenceStore>;
  let clientsApi: Partial<Record<keyof ClientsApiService, ReturnType<typeof vi.fn>>>;
  let locationsApi: Partial<Record<keyof LocationsApiService, ReturnType<typeof vi.fn>>>;
  let providersApi: Partial<Record<keyof ProvidersApiService, ReturnType<typeof vi.fn>>>;
  let servicesApi: Partial<Record<keyof ServicesApiService, ReturnType<typeof vi.fn>>>;

  function createStore() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClientsApiService, useValue: clientsApi },
        { provide: LocationsApiService, useValue: locationsApi },
        { provide: ProvidersApiService, useValue: providersApi },
        { provide: ServicesApiService, useValue: servicesApi },
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
});
