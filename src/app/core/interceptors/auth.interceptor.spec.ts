import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '@services/auth.service';

/**
 * The backend ROTATES the token on every switch and revokes the old one, so an
 * in-flight request can fail with a 401 while still holding a token that was
 * already replaced. The interceptor must tell that stale-token 401 apart from a
 * genuinely expired session by comparing the request's token against the
 * PERSISTED token (localStorage) — never the in-memory signal, which is stale
 * in a second tab.
 */
describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: {
    getToken: ReturnType<typeof vi.fn>;
    getStoredToken: ReturnType<typeof vi.fn>;
    syncTokenFromStorage: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    auth = {
      getToken: vi.fn(),
      getStoredToken: vi.fn(),
      syncTokenFromStorage: vi.fn(),
      logout: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches the in-memory token as a Bearer Authorization header', () => {
    auth.getToken.mockReturnValue('token-a');

    http.get('/api/things').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/things');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-a');
    req.flush({});
  });

  it('does NOT log out and re-syncs when the 401 comes from a stale (rotated) token', () => {
    // Cross-tab scenario: the in-memory signal still holds the old token, while
    // localStorage already holds the rotated one written by the other tab.
    auth.getToken.mockReturnValue('stale-token');
    auth.getStoredToken.mockReturnValue('rotated-token');

    let status: number | undefined;
    http.get('/api/things').subscribe({ error: (e) => (status = e.status) });

    const req = httpMock.expectOne('/api/things');
    expect(req.request.headers.get('Authorization')).toBe('Bearer stale-token');
    req.flush({ message: 'Unauthenticated' }, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(auth.syncTokenFromStorage).toHaveBeenCalledTimes(1);
  });

  it('logs out when the 401 token equals the persisted token (genuine expiry)', () => {
    auth.getToken.mockReturnValue('same-token');
    auth.getStoredToken.mockReturnValue('same-token');

    http.get('/api/things').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/things');
    expect(req.request.headers.get('Authorization')).toBe('Bearer same-token');
    req.flush({ message: 'Unauthenticated' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(auth.syncTokenFromStorage).not.toHaveBeenCalled();
  });

  it('logs out when there is no persisted token (session gone in every tab)', () => {
    auth.getToken.mockReturnValue('token-a');
    auth.getStoredToken.mockReturnValue(null);

    http.get('/api/things').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/things');
    req.flush({ message: 'Unauthenticated' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(auth.syncTokenFromStorage).not.toHaveBeenCalled();
  });

  it('ignores non-401 errors (no logout, no re-sync)', () => {
    auth.getToken.mockReturnValue('token-a');
    auth.getStoredToken.mockReturnValue('token-a');

    http.get('/api/things').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/things');
    req.flush({ message: 'Server error' }, { status: 500, statusText: 'Server Error' });

    expect(auth.logout).not.toHaveBeenCalled();
    expect(auth.syncTokenFromStorage).not.toHaveBeenCalled();
  });
});
