import { HttpParams } from '@angular/common/http';
import { buildHttpParams } from './build-http-params';

describe('buildHttpParams', () => {
  it('builds params from object with multiple keys', () => {
    const params = buildHttpParams({ a: '1', b: '2' });
    expect(params.get('a')).toBe('1');
    expect(params.get('b')).toBe('2');
  });

  it('excludes null and undefined values', () => {
    const params = buildHttpParams({ a: '1', b: null, c: undefined });
    expect(params.get('a')).toBe('1');
    expect(params.keys().length).toBe(1);
  });

  it('returns empty HttpParams for empty object', () => {
    const params = buildHttpParams({});
    expect(params.keys().length).toBe(0);
  });

  it('converts numbers and booleans to strings', () => {
    const params = buildHttpParams({ num: 42, bool: true });
    expect(params.get('num')).toBe('42');
    expect(params.get('bool')).toBe('true');
  });
});
