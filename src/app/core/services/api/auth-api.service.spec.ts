import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthApiService } from './auth-api.service';
import { environment } from '@env/environment';
import { AuthMeData, LoginCredentials, RegisterData, ResetPasswordData } from '@models';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('login calls POST /auth/login', () => {
    const credentials: LoginCredentials = { email: 'test@test.com', password: '123456' };

    service.login(credentials).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(credentials);
  });

  it('register calls POST /auth/register', () => {
    const data: RegisterData = {
      name: 'Test User',
      email: 'test@test.com',
      password: '123456',
      password_confirmation: '123456',
      phone: '1123456789',
    };

    service.register(data).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
  });

  it('verifyEmail calls PATCH /auth/verify-email with { token } and returns the raw { message, user } body', () => {
    const response = {
      message: 'Email verificado',
      user: { id: 7, name: 'Test', email: 'test@test.com', role: 'admin' as const, email_verified_at: '2026-09-01T16:00:00Z' },
    };

    service.verifyEmail('tok-123').subscribe((res) => {
      expect(res).toEqual(response);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/verify-email`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ token: 'tok-123' });
    req.flush(response);
  });

  it('forgotPassword calls POST /auth/forgot-password with { email }', () => {
    service.forgotPassword('user@test.com').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/forgot-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@test.com' });
  });

  it('resetPassword calls POST /auth/reset-password with token and the new passwords', () => {
    const data: ResetPasswordData = {
      token: 'tok-123',
      password: 'NewPass1',
      password_confirmation: 'NewPass1',
    };

    service.resetPassword(data).subscribe((res) => {
      expect(res).toEqual({ message: 'ok' });
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/reset-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush({ message: 'ok' });
  });

  it('getMe calls GET /auth/me and unwraps { user }', () => {
    const me: AuthMeData = {
      id: 7,
      name: 'Admin',
      email: 'admin@test.com',
      phone: '+56912345678',
      role: 'admin',
      tenant_id: 1,
      email_verified_at: '2026-09-01T16:00:00Z',
      onboarding_complete: true,
      business: null,
    };

    service.getMe().subscribe((res) => {
      expect(res).toEqual(me);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
    expect(req.request.method).toBe('GET');
    req.flush({ user: me });
  });
});
