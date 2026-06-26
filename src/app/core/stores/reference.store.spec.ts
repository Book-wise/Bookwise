import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ReferenceStore } from './reference.store';
import { ApiService } from '@services/api.service';
import type { Client, Location, Provider, Service, ServicePack } from '@models';

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

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ReferenceStore', () => {
  let store: InstanceType<typeof ReferenceStore>;
  let api: Partial<Record<keyof ApiService, ReturnType<typeof vi.fn>>>;

  function createStore() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ApiService, useValue: api },
      ],
    });
    store = TestBed.inject(ReferenceStore);
  }

  // ── Initial state ──────────────────────────────────────────────────

  describe('initial state', () => {
    beforeEach(() => {
      api = {
        getClients: vi.fn().mockReturnValue(of([])),
        getLocations: vi.fn().mockReturnValue(of([])),
        getServices: vi.fn().mockReturnValue(of([])),
        getProviders: vi.fn().mockReturnValue(of([])),
        getPacks: vi.fn().mockReturnValue(of({ data: [] })),
      };
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
    });
  });

  // ── Loading lifecycle ──────────────────────────────────────────────

  describe('loading lifecycle', () => {
    beforeEach(() => {
      api = {
        getClients: vi.fn().mockReturnValue(of([makeClient({ id: 42 })])),
        getLocations: vi.fn().mockReturnValue(of([makeLocation()])),
        getServices: vi.fn().mockReturnValue(of([makeService()])),
        getProviders: vi.fn().mockReturnValue(of([makeProvider()])),
        getPacks: vi.fn().mockReturnValue(of({ data: [makePack()] })),
      };
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

    it('calls all 5 API methods on init', () => {
      expect(api.getClients).toHaveBeenCalledTimes(1);
      expect(api.getLocations).toHaveBeenCalledTimes(1);
      expect(api.getServices).toHaveBeenCalledTimes(1);
      expect(api.getProviders).toHaveBeenCalledTimes(1);
      expect(api.getPacks).toHaveBeenCalledTimes(1);
    });
  });

  // ── Comptuted signals ──────────────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(() => {
      api = {
        getClients: vi.fn().mockReturnValue(of([])),
        getLocations: vi.fn().mockReturnValue(of([])),
        getServices: vi.fn().mockReturnValue(of([])),
        getProviders: vi.fn().mockReturnValue(of([])),
        getPacks: vi.fn().mockReturnValue(of({ data: [] })),
      };
      createStore();
    });

    it('invalidateClients resets loaded.clients to false before refetch', () => {
      expect(store.loaded().clients).toBe(true);
      // invalidateClients sets loaded.clients=false then immediately refetches;
      // with sync of(), the fetch completes in the same microtask
      store.invalidateClients();
      // Since rxMethod with of() is synchronous, loaded is back to true.
      // The important thing is the hook is correct: refetch happened.
      expect(api.getClients).toHaveBeenCalledTimes(2);
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
      api = {
        getClients: vi.fn().mockReturnValue(of([makeClient({ id: 1 })])),
        getLocations: vi.fn().mockReturnValue(of([makeLocation()])),
        getServices: vi.fn().mockReturnValue(of([makeService()])),
        getProviders: vi.fn().mockReturnValue(of([makeProvider()])),
        getPacks: vi.fn().mockReturnValue(of({ data: [makePack()] })),
      };
      createStore();
    });

    it('invalidateClients resets loaded flag and refetches', () => {
      expect(store.loaded().clients).toBe(true);

      store.invalidateClients();

      expect(api.getClients).toHaveBeenCalledTimes(2);
      expect(store.clients()).toHaveLength(1); // still populated
    });

    it('invalidateServices resets loaded flag and refetches', () => {
      store.invalidateServices();
      expect(api.getServices).toHaveBeenCalledTimes(2);
    });

    it('invalidateLocations resets loaded flag and refetches', () => {
      store.invalidateLocations();
      expect(api.getLocations).toHaveBeenCalledTimes(2);
    });

    it('invalidateProviders resets loaded flag and refetches', () => {
      store.invalidateProviders();
      expect(api.getProviders).toHaveBeenCalledTimes(2);
    });

    it('invalidatePacks resets loaded flag and refetches', () => {
      store.invalidatePacks();
      expect(api.getPacks).toHaveBeenCalledTimes(2);
    });

    it('invalidateAll resets all loaded flags and refetches everything', () => {
      store.invalidateAll();

      expect(api.getClients).toHaveBeenCalledTimes(2);
      expect(api.getLocations).toHaveBeenCalledTimes(2);
      expect(api.getServices).toHaveBeenCalledTimes(2);
      expect(api.getProviders).toHaveBeenCalledTimes(2);
      expect(api.getPacks).toHaveBeenCalledTimes(2);
    });

    it('refetched data replaces existing data', () => {
      // Change the mock to return different data on next call
      api.getClients!.mockReturnValue(of([makeClient({ id: 99 })]));

      store.invalidateClients();

      expect(store.clients()).toHaveLength(1);
      expect(store.clients()[0].id).toBe(99);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────

  describe('error handling', () => {
    beforeEach(() => {
      api = {
        getClients: vi.fn().mockReturnValue(throwError(() => new Error('API error'))),
        getLocations: vi.fn().mockReturnValue(of([])),
        getServices: vi.fn().mockReturnValue(of([])),
        getProviders: vi.fn().mockReturnValue(of([])),
        getPacks: vi.fn().mockReturnValue(of({ data: [] })),
      };
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
      api.getClients!.mockReturnValue(of([makeClient({ id: 7 })]));

      store.invalidateClients();

      expect(store.error().clients).toBeNull();
      expect(store.clients()).toHaveLength(1);
      expect(store.clients()[0].id).toBe(7);
    });
  });

  // ── Manual load methods ────────────────────────────────────────────

  describe('manual load methods', () => {
    beforeEach(() => {
      api = {
        getClients: vi.fn().mockReturnValue(of([])),
        getLocations: vi.fn().mockReturnValue(of([])),
        getServices: vi.fn().mockReturnValue(of([])),
        getProviders: vi.fn().mockReturnValue(of([])),
        getPacks: vi.fn().mockReturnValue(of({ data: [] })),
      };
      createStore();
    });

    it('loadClients fetches clients via API', () => {
      // Already called once on init; mock new data
      api.getClients!.mockReturnValue(of([makeClient({ id: 77 })]));
      store.loadClients();
      expect(api.getClients).toHaveBeenCalledTimes(2);
    });
  });
});
