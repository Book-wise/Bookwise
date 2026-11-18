import {
  normalizeSearch,
  pricePerSession,
  serviceInitials,
  sortPacksBySessions,
  termsForService,
} from './services-terms.util';
import type { ServicePack } from '@models';

function makePack(overrides: Partial<ServicePack> = {}): ServicePack {
  return {
    id: 1,
    service_id: 1,
    name: 'Pack',
    total_sessions: 3,
    price: '30000',
    active: true,
    ...overrides,
  };
}

describe('pricePerSession', () => {
  it('divide el precio por la cantidad de sesiones', () => {
    expect(pricePerSession(67500, 3)).toBe(22500);
    expect(pricePerSession('120000', 6)).toBe(20000);
  });

  it('devuelve 0 cuando el divisor es 0', () => {
    expect(pricePerSession(100, 0)).toBe(0);
  });
});

describe('sortPacksBySessions', () => {
  it('ordena por sesiones ascendente sin mutar el input', () => {
    const input = [
      makePack({ id: 1, total_sessions: 6 }),
      makePack({ id: 2, total_sessions: 1 }),
      makePack({ id: 3, total_sessions: 3 }),
    ];

    const sorted = sortPacksBySessions(input);

    expect(sorted.map((p) => p.total_sessions)).toEqual([1, 3, 6]);
    expect(input.map((p) => p.total_sessions)).toEqual([6, 1, 3]);
  });
});

describe('termsForService', () => {
  it('filtra por service_id y ordena por sesiones', () => {
    const packs = [
      makePack({ id: 1, service_id: 1, total_sessions: 6 }),
      makePack({ id: 2, service_id: 2, total_sessions: 1 }),
      makePack({ id: 3, service_id: 1, total_sessions: 1 }),
    ];

    const terms = termsForService(packs, 1);

    expect(terms.map((p) => p.id)).toEqual([3, 1]);
  });
});

describe('serviceInitials', () => {
  it('devuelve máximo 2 letras en mayúsculas', () => {
    expect(serviceInitials('Kinesiología general')).toBe('KG');
    expect(serviceInitials('Masoterapia')).toBe('MA');
  });

  it('devuelve cadena vacía para un nombre vacío', () => {
    expect(serviceInitials('   ')).toBe('');
  });
});

describe('normalizeSearch', () => {
  it('pasa a minúsculas y quita acentos', () => {
    expect(normalizeSearch('  Kinesiología General ')).toBe('kinesiologia general');
  });
});
