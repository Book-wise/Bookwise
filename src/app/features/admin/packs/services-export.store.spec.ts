import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ServicesExportStore } from './services-export.store';
import { serviceFingerprint } from './services-export.util';
import { AuthService } from '@services/auth.service';
import type { Service, ServicePack } from '@models';

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    name: 'Kinesiología general',
    duration_minutes: 60,
    price: '25000',
    active: true,
    ...overrides,
  } as Service;
}

function makePack(overrides: Partial<ServicePack> = {}): ServicePack {
  return {
    id: 11,
    service_id: 1,
    name: 'Pack',
    total_sessions: 3,
    price: '67500',
    active: true,
    ...overrides,
  };
}

describe('ServicesExportStore', () => {
  const user = { id: 7, tenant_id: 3 };
  const KEY = 'bw:services:export:7:3';

  beforeEach(() => {
    localStorage.clear();
  });

  function createStore(): ServicesExportStore {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: { user: () => user } },
        ServicesExportStore,
      ],
    });
    return TestBed.inject(ServicesExportStore);
  }

  it('recordExport guarda timestamp y fingerprints y persiste en localStorage', () => {
    const store = createStore();
    const service = makeService();
    const terms = [makePack()];
    const fingerprint = serviceFingerprint(service, terms);

    store.recordExport([{ service, terms }]);

    expect(store.lastExportAt()).toBeTruthy();
    expect(store.fingerprints()[String(service.id)]).toBe(fingerprint);

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect(persisted.lastExportAt).toBe(store.lastExportAt());
    expect(persisted.fingerprints['1']).toBe(fingerprint);
  });

  it('stateFor devuelve new antes de exportar, synced tras exportar y changed al cambiar', () => {
    const store = createStore();
    const service = makeService();
    const terms = [makePack()];
    const fingerprint = serviceFingerprint(service, terms);

    expect(store.stateFor(service.id, fingerprint)).toBe('new');

    store.recordExport([{ service, terms }]);
    expect(store.stateFor(service.id, fingerprint)).toBe('synced');

    const changed = makeService({ price: '30000' });
    expect(store.stateFor(changed.id, serviceFingerprint(changed, terms))).toBe('changed');
  });

  it('counts separa changed y never', () => {
    const store = createStore();
    const s1 = makeService({ id: 1 });
    const s2 = makeService({ id: 2 });
    const terms = [makePack()];

    expect(
      store.counts([
        { service: s1, terms },
        { service: s2, terms },
      ]),
    ).toEqual({ changed: 0, never: 2 });

    store.recordExport([{ service: s1, terms }]);
    expect(
      store.counts([
        { service: s1, terms },
        { service: s2, terms },
      ]),
    ).toEqual({ changed: 0, never: 1 });

    const s1Changed = makeService({ id: 1, price: '40000' });
    expect(
      store.counts([
        { service: s1Changed, terms },
        { service: s2, terms },
      ]),
    ).toEqual({ changed: 1, never: 1 });
  });

  it('recordExport conserva las huellas de servicios no incluidos en el lote', () => {
    const store = createStore();
    const s1 = makeService({ id: 1 });
    const s2 = makeService({ id: 2 });
    const terms = [makePack()];

    store.recordExport([
      { service: s1, terms },
      { service: s2, terms },
    ]);
    store.recordExport([{ service: s1, terms }]);

    expect(store.fingerprints()['2']).toBe(serviceFingerprint(s2, terms));
  });

  it('tolera storage roto y sigue funcionando en memoria', () => {
    localStorage.setItem(KEY, '{no es json');
    const store = createStore();

    expect(store.lastExportAt()).toBeNull();
    expect(store.fingerprints()).toEqual({});

    store.recordExport([{ service: makeService(), terms: [makePack()] }]);
    expect(store.lastExportAt()).toBeTruthy();
    expect(Object.keys(store.fingerprints())).toEqual(['1']);
  });
});
