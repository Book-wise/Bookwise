import {
  normalizeText,
  stripDigits,
  isEmailMatch,
  isPhoneMatch,
  isNameMatch,
  matchSimilarClients,
  dedupeById,
  type MinimalNewClient,
} from './client-similarity.util';
import type { Client } from '@core/models';

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1,
    first_name: 'Ana',
    last_name: 'Test',
    email: 'ana@test.com',
    phone: '+56912345678',
    active: true,
    ...overrides,
  };
}

function makeNewClient(overrides: Partial<MinimalNewClient> = {}): MinimalNewClient {
  return {
    first_name: 'Ana',
    last_name: 'Test',
    email: 'ana@test.com',
    phone: '+56912345678',
    ...overrides,
  };
}

describe('normalizeText', () => {
  it('trims, lowercases and folds accents', () => {
    expect(normalizeText('  Ánä Tést  ')).toBe('ana test');
  });

  it('handles null/undefined input as empty string', () => {
    expect(normalizeText(null as unknown as string)).toBe('');
    expect(normalizeText(undefined as unknown as string)).toBe('');
  });
});

describe('stripDigits', () => {
  it('removes all non-digit characters', () => {
    expect(stripDigits('(56) 9-1234-5678')).toBe('56912345678');
    expect(stripDigits('+56 9 1234 5678')).toBe('56912345678');
  });

  it('handles null/undefined input as empty string', () => {
    expect(stripDigits(null as unknown as string)).toBe('');
    expect(stripDigits(undefined as unknown as string)).toBe('');
  });
});

describe('isEmailMatch', () => {
  it('matches case-insensitively on exact email', () => {
    const candidate = makeClient({ email: 'ANA@TEST.COM' });
    const nc = makeNewClient({ email: 'ana@test.com' });
    expect(isEmailMatch(candidate, nc)).toBe(true);
  });

  it('does not match different emails', () => {
    const candidate = makeClient({ email: 'other@test.com' });
    const nc = makeNewClient({ email: 'ana@test.com' });
    expect(isEmailMatch(candidate, nc)).toBe(false);
  });

  it('does not match when either email is empty', () => {
    const candidate = makeClient({ email: '' });
    const nc = makeNewClient({ email: '' });
    expect(isEmailMatch(candidate, nc)).toBe(false);
  });
});

describe('isPhoneMatch', () => {
  it('matches phones ignoring formatting/punctuation', () => {
    const candidate = makeClient({ phone: '(56) 9-1234-5678' });
    const nc = makeNewClient({ phone: '+56912345678' });
    expect(isPhoneMatch(candidate, nc)).toBe(true);
  });

  it('does not match different phone numbers', () => {
    const candidate = makeClient({ phone: '+56911111111' });
    const nc = makeNewClient({ phone: '+56912345678' });
    expect(isPhoneMatch(candidate, nc)).toBe(false);
  });

  it('does not match when either phone is empty or missing', () => {
    expect(isPhoneMatch(makeClient({ phone: '' }), makeNewClient({ phone: '' }))).toBe(false);
    expect(isPhoneMatch(makeClient({ phone: null }), makeNewClient({ phone: '+56912345678' }))).toBe(
      false,
    );
    expect(isPhoneMatch(makeClient({ phone: '+56912345678' }), makeNewClient({ phone: '' }))).toBe(
      false,
    );
  });
});

describe('isNameMatch', () => {
  it('matches normalized full names', () => {
    const candidate = makeClient({ first_name: 'Ánä', last_name: 'Tést' });
    const nc = makeNewClient({ first_name: 'ana', last_name: 'test' });
    expect(isNameMatch(candidate, nc)).toBe(true);
  });

  it('does not match different names', () => {
    const candidate = makeClient({ first_name: 'Beto', last_name: 'Otro' });
    const nc = makeNewClient({ first_name: 'Ana', last_name: 'Test' });
    expect(isNameMatch(candidate, nc)).toBe(false);
  });
});

describe('matchSimilarClients', () => {
  it('includes candidate on exact case-insensitive email match', () => {
    const candidate = makeClient({ id: 1, email: 'ANA@TEST.COM', phone: '+56900000000' });
    const nc = makeNewClient({ email: 'ana@test.com', phone: '+56911111111' });

    const result = matchSimilarClients([candidate], nc);

    expect(result).toEqual([candidate]);
  });

  it('includes candidate on phone match ignoring formatting', () => {
    const candidate = makeClient({
      id: 2,
      email: 'someone-else@test.com',
      phone: '(56) 9-1234-5678',
    });
    const nc = makeNewClient({ email: 'ana@test.com', phone: '+56912345678' });

    const result = matchSimilarClients([candidate], nc);

    expect(result).toEqual([candidate]);
  });

  it('excludes a name-only match', () => {
    const candidate = makeClient({
      id: 3,
      first_name: 'Ana',
      last_name: 'Test',
      email: 'different@test.com',
      phone: '+56900000000',
    });
    const nc = makeNewClient({
      first_name: 'Ana',
      last_name: 'Test',
      email: 'ana@test.com',
      phone: '+56911111111',
    });

    const result = matchSimilarClients([candidate], nc);

    expect(result).toEqual([]);
  });

  it('excludes when both email and phone are empty/blank on both sides', () => {
    const candidate = makeClient({ id: 4, email: '', phone: '' });
    const nc = makeNewClient({ email: '', phone: '' });

    const result = matchSimilarClients([candidate], nc);

    expect(result).toEqual([]);
  });

  it('excludes candidates that match neither email nor phone', () => {
    const candidate = makeClient({ id: 5, email: 'other@test.com', phone: '+56900000000' });
    const nc = makeNewClient({ email: 'ana@test.com', phone: '+56911111111' });

    const result = matchSimilarClients([candidate], nc);

    expect(result).toEqual([]);
  });
});

describe('dedupeById', () => {
  it('keeps each id once when email and phone searches overlap', () => {
    const candidate = makeClient({ id: 42 });
    const fromEmailSearch = [candidate];
    const fromPhoneSearch = [makeClient({ id: 42 }), makeClient({ id: 7 })];

    const result = dedupeById([...fromEmailSearch, ...fromPhoneSearch]);

    expect(result.map((c) => c.id)).toEqual([42, 7]);
  });

  it('returns an empty array for an empty input', () => {
    expect(dedupeById([])).toEqual([]);
  });
});
