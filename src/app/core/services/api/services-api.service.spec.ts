import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ServicesApiService } from './services-api.service';
import { environment } from '@env/environment';
import { Service, ServicePack, PaginatedResponse } from '@models';

describe('ServicesApiService', () => {
  let service: ServicesApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ServicesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /services via getServices()', () => {
    const dummy: Service[] = [
      { id: 1, name: 'Corte', duration_minutes: 30, price: 15000, active: true },
    ];

    service.getServices().subscribe((data) => {
      expect(data).toEqual(dummy);
    });

    const req = httpMock.expectOne(`${baseUrl}/services`);
    expect(req.request.method).toBe('GET');
    req.flush(dummy);
  });

  it('GET /services/:id via getService()', () => {
    const dummy: Service = { id: 1, name: 'Corte', duration_minutes: 30, price: 15000, active: true };

    service.getService(1).subscribe((data) => {
      expect(data).toEqual(dummy);
    });

    const req = httpMock.expectOne(`${baseUrl}/services/1`);
    expect(req.request.method).toBe('GET');
    req.flush(dummy);
  });

  it('POST /services via createService()', () => {
    const payload = { name: 'Corte', price: 15000, duration_minutes: 30 };
    const response: Service = { id: 1, ...payload, active: true };

    service.createService(payload).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/services`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(response);
  });

  it('GET /packs via getPacks()', () => {
    const dummy: PaginatedResponse<ServicePack> = {
      data: [{ id: 1, service_id: 1, name: 'Pack Corte x3', total_sessions: 3, price: 40000, active: true }],
      meta: { current_page: 1, from: 1, last_page: 1, per_page: 10, to: 1, total: 1 },
    };

    service.getPacks().subscribe((data) => {
      expect(data).toEqual(dummy);
    });

    const req = httpMock.expectOne(`${baseUrl}/packs`);
    expect(req.request.method).toBe('GET');
    req.flush(dummy);
  });

  it('GET /packs/:id via getPack()', () => {
    const dummy: ServicePack = { id: 1, service_id: 1, name: 'Pack Corte x3', total_sessions: 3, price: 40000, active: true };

    service.getPack(1).subscribe((data) => {
      expect(data).toEqual(dummy);
    });

    const req = httpMock.expectOne(`${baseUrl}/packs/1`);
    expect(req.request.method).toBe('GET');
    req.flush(dummy);
  });
});
