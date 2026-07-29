import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthApiService } from './auth-api.service';
import { environment } from '@env/environment';
import { LoginCredentials, RegisterData } from '@models';

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

  it('register calls POST /register', () => {
    const data: RegisterData = {
      name: 'Test User',
      email: 'test@test.com',
      password: '123456',
      password_confirmation: '123456',
      phone: '1123456789',
    };

    service.register(data).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
  });
});
