import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SiiActivitiesApiService } from './sii-activities-api.service';
import { environment } from '@env/environment';
import { SiiActivity } from '@models';

describe('SiiActivitiesApiService', () => {
  let service: SiiActivitiesApiService;
  let httpMock: HttpTestingController;

  const activity: SiiActivity = {
    id: 612,
    code: '960200',
    description: 'PELUQUERÍA Y OTROS TRATAMIENTOS DE BELLEZA',
  };

  const page = {
    data: [activity],
    meta: { current_page: 1, from: 1, last_page: 28, per_page: 25, to: 1, total: 700 },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SiiActivitiesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('search calls GET /sii-activities with no params when nothing is given (backend defaults)', () => {
    service.search().subscribe((res) => {
      expect(res).toEqual(page);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/sii-activities`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(page);
  });

  it('search sends search, page and per_page when provided', () => {
    service.search({ search: 'peluquería', page: 2, perPage: 50 }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/sii-activities`,
    );
    expect(req.request.params.get('search')).toBe('peluquería');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('per_page')).toBe('50');
    req.flush(page);
  });

  it('search trims the term and drops it when blank', () => {
    service.search({ search: '   ' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/sii-activities`);
    expect(req.request.params.has('search')).toBe(false);
    req.flush(page);
  });
});
