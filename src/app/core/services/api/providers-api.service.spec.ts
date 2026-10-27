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
    const url = `${environment.apiUrl}/providers`;

    /** Envelope tal cual lo devuelve el backend (Laravel paginator). */
    const envelope = (data: Provider[], current: number, last: number, total = last * 25) => ({
      data,
      links: {},
      meta: { current_page: current, from: 1, last_page: last, per_page: 25, to: data.length, total },
    });

    it('unwraps the paginated envelope into a provider array', () => {
      const mock: Provider[] = [
        { id: 1, first_name: 'Ana', last_name: 'García', email: 'ana@test.com', active: true },
      ];

      service.getProviders().subscribe((res) => {
        expect(res).toEqual(mock);
      });

      const req = httpMock.expectOne((r) => r.url === url);
      expect(req.request.method).toBe('GET');
      req.flush(envelope(mock, 1, 1));
    });

    it('asks for a bounded page size (the backend does not cap per_page)', () => {
      service.getProviders().subscribe();

      const req = httpMock.expectOne((r) => r.url === url);
      expect(req.request.params.get('per_page')).toBe('25');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(envelope([], 1, 1, 0));
    });

    it('aggregates every page so consumers never get a truncated list', () => {
      const first: Provider[] = [
        { id: 1, first_name: 'Ana', last_name: 'García', email: 'ana@test.com', active: true },
      ];
      const second: Provider[] = [
        { id: 2, first_name: 'Luis', last_name: 'Pérez', email: 'luis@test.com', active: true },
      ];
      let result: Provider[] | undefined;

      service.getProviders().subscribe((res) => (result = res));

      httpMock.expectOne((r) => r.url === url && r.params.get('page') === '1').flush(envelope(first, 1, 2));
      httpMock
        .expectOne((r) => r.url === url && r.params.get('page') === '2')
        .flush(envelope(second, 2, 2));

      expect(result).toEqual([...first, ...second]);
    });

    it('stops at the safety cap instead of following an unbounded last_page', () => {
      let result: Provider[] = [];

      service.getProviders().subscribe((res) => (result = res));

      for (let page = 1; page <= 40; page++) {
        const item: Provider = {
          id: page,
          first_name: `P${page}`,
          last_name: 'X',
          email: `p${page}@test.com`,
          active: true,
        };
        httpMock
          .expectOne((r) => r.url === url && r.params.get('page') === String(page))
          .flush(envelope([item], page, 99, 99 * 25));
      }

      expect(result.length).toBe(40);
      // No queda ninguna request pendiente: la cadena se detuvo en el tope.
      httpMock.expectNone((r) => r.url === url);
    });

    it('passes location_id as query param', () => {
      service.getProviders({ location_id: 2 }).subscribe();

      const req = httpMock.expectOne((r) => r.url === url);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('location_id')).toBe('2');
      req.flush(envelope([], 1, 1, 0));
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
