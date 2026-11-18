import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { ServicesStore } from './services.store';
import { ServicesApiService } from '@services/api/services-api.service';
import type { Service, ServicePack } from '@models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(overrides: Partial<Service> = {}): Service {
  return { id: 1, name: 'Consulta', price: 30000, duration_minutes: 45, ...overrides } as Service;
}

function makePack(overrides: Partial<ServicePack> = {}): ServicePack {
  return { id: 1, name: 'Pack 10 sesiones', price: 200000, total_sessions: 10, ...overrides } as ServicePack;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ServicesStore', () => {
  let store: InstanceType<typeof ServicesStore>;
  let servicesApi: {
    getServices: ReturnType<typeof vi.fn>;
    getPacks: ReturnType<typeof vi.fn>;
  };

  function createStore() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ServicesApiService, useValue: servicesApi },
      ],
    });
    store = TestBed.inject(ServicesStore);
  }

  beforeEach(() => {
    servicesApi = {
      getServices: vi.fn().mockReturnValue(of([])),
      getPacks: vi.fn().mockReturnValue(of({ data: [] })),
    };
  });

  describe('initial state', () => {
    it('starts empty with per-entity meta-state reset', () => {
      createStore();

      expect(store.services()).toEqual([]);
      expect(store.packs()).toEqual([]);
      expect(store.loading()).toEqual({ services: false, packs: false });
      expect(store.loaded()).toEqual({ services: false, packs: false });
      expect(store.error()).toEqual({ services: null, packs: null });
    });
  });

  describe('loadServices', () => {
    it('loads services only and flags loaded.services', () => {
      servicesApi.getServices.mockReturnValue(of([makeService()]));
      createStore();

      store.loadServices();

      expect(servicesApi.getServices).toHaveBeenCalledTimes(1);
      expect(servicesApi.getPacks).not.toHaveBeenCalled();
      expect(store.services()).toHaveLength(1);
      expect(store.loaded().services).toBe(true);
      expect(store.loading().services).toBe(false);
      expect(store.loaded().packs).toBe(false);
    });
  });

  describe('loadPacks', () => {
    it('loads packs only, unwraps .data and flags loaded.packs', () => {
      servicesApi.getPacks.mockReturnValue(of({ data: [makePack()] }));
      createStore();

      store.loadPacks();

      expect(servicesApi.getPacks).toHaveBeenCalledTimes(1);
      expect(servicesApi.getServices).not.toHaveBeenCalled();
      expect(store.packs()).toHaveLength(1);
      expect(store.loaded().packs).toBe(true);
      expect(store.loading().packs).toBe(false);
      expect(store.loaded().services).toBe(false);
    });
  });

  describe('invalidateServices', () => {
    it('refetches and replaces services', () => {
      servicesApi.getServices.mockReturnValue(of([makeService({ id: 1 })]));
      createStore();
      store.loadServices();
      expect(servicesApi.getServices).toHaveBeenCalledTimes(1);

      servicesApi.getServices.mockReturnValue(of([makeService({ id: 2 })]));
      store.invalidateServices();

      expect(servicesApi.getServices).toHaveBeenCalledTimes(2);
      expect(store.services()).toHaveLength(1);
      expect(store.services()[0].id).toBe(2);
      expect(store.loaded().services).toBe(true);
    });
  });

  describe('error handling', () => {
    it('leaves error.services set and loaded.services false on failure', () => {
      servicesApi.getServices.mockReturnValue(throwError(() => new Error('boom')));
      createStore();

      store.loadServices();

      expect(store.error().services).toBe('boom');
      expect(store.loaded().services).toBe(false);
      expect(store.loading().services).toBe(false);
      expect(store.services()).toEqual([]);
    });
  });

  describe('per-entity loading isolation', () => {
    it('does not let one entity overwrite the other loading flag', () => {
      const services$ = new Subject<Service[]>();
      servicesApi.getServices.mockReturnValue(services$.asObservable());
      servicesApi.getPacks.mockReturnValue(of({ data: [makePack()] }));
      createStore();

      store.loadServices();
      store.loadPacks();

      expect(store.loading().services).toBe(true);
      expect(store.loaded().services).toBe(false);

      // packs resolved independently while services is still in flight
      expect(store.loading().packs).toBe(false);
      expect(store.loaded().packs).toBe(true);
      expect(store.packs()).toHaveLength(1);

      services$.next([makeService()]);
      services$.complete();

      expect(store.services()).toHaveLength(1);
      expect(store.loading().services).toBe(false);
      expect(store.loaded().services).toBe(true);
    });
  });
});
