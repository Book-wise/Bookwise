import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { HolidaysApiService } from './holidays-api.service';
import { environment } from '@env/environment';

describe('HolidaysApiService', () => {
  let service: HolidaysApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HolidaysApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GET /holidays unwraps the data array (by year)', () => {
    const data = [{ date: '2026-01-01', name: 'Año Nuevo' }];

    service.getHolidays({ year: 2026 }).subscribe((res) => expect(res).toEqual(data));

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/holidays`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('year')).toBe('2026');
    expect(req.request.params.get('from')).toBeNull();
    req.flush({ data });
  });

  it('GET /holidays accepts an inclusive from/to range', () => {
    service.getHolidays({ from: '2026-12-01', to: '2027-01-31' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/holidays`);
    expect(req.request.params.get('from')).toBe('2026-12-01');
    expect(req.request.params.get('to')).toBe('2027-01-31');
    expect(req.request.params.get('year')).toBeNull();
    req.flush({ data: [] });
  });

  it('GET /holidays sends no params when called empty', () => {
    service.getHolidays().subscribe();

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/holidays`);
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ data: [] });
  });
});
