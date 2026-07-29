import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProvidersApiService } from './providers-api.service';
import { environment } from '@env/environment';
import { Provider } from '@models';

describe('ProvidersApiService', () => {
  let service: ProvidersApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ProvidersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  describe('getProviders', () => {
    it('fetches all providers without params', () => {
      const mock: Provider[] = [
        { id: 1, first_name: 'Ana', last_name: 'García', email: 'ana@test.com', active: true },
      ];

      service.getProviders().subscribe((res) => {
        expect(res).toEqual(mock);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/providers`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush(mock);
    });

    it('passes location_id as query param', () => {
      service.getProviders({ location_id: 2 }).subscribe();

      const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/providers`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('location_id')).toBe('2');
      req.flush([]);
    });
  });

  describe('getProvider', () => {
    it('fetches a single provider by id', () => {
      const mock: Provider = {
        id: 5,
        first_name: 'Luis',
        last_name: 'Pérez',
        email: 'luis@test.com',
        active: true,
      };

      service.getProvider(5).subscribe((res) => {
        expect(res).toEqual(mock);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/providers/5`);
      expect(req.request.method).toBe('GET');
      req.flush(mock);
    });
  });

  describe('createProvider', () => {
    it('POSTs data and returns the created provider', () => {
      const payload: Partial<Provider> = {
        first_name: 'Nuevo',
        last_name: 'Provider',
        email: 'nuevo@test.com',
      };
      const response = { message: 'Created', data: { id: 10, ...payload, active: true } as Provider };

      service.createProvider(payload).subscribe((res) => {
        expect(res).toEqual(response);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/providers`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(response);
    });
  });

  describe('updateProvider', () => {
    it('PATCHes data by id and returns the updated provider', () => {
      const payload: Partial<Provider> = { email: 'updated@test.com' };
      const response = {
        message: 'Updated',
        data: { id: 3, first_name: 'Carlos', last_name: 'López', email: 'updated@test.com', active: true } as Provider,
      };

      service.updateProvider(3, payload).subscribe((res) => {
        expect(res).toEqual(response);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/providers/3`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(payload);
      req.flush(response);
    });
  });
});
