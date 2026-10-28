import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ClientsApiService, ClientPage } from './clients-api.service';
import { environment } from '@env/environment';
import { Client, ClientPack, PaginatedResponse } from '@models';

describe('ClientsApiService', () => {
  let service: ClientsApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ClientsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /clients via getClients() without params', () => {
    const dummy: Client[] = [
      { id: 1, first_name: 'Juan', last_name: 'Pérez', email: 'juan@test.com', active: true },
    ];

    service.getClients().subscribe((data) => {
      expect(data).toEqual(dummy);
    });

    const req = httpMock.expectOne(`${baseUrl}/clients`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush(dummy);
  });

  it('getClients() unwraps the {data, links, meta} envelope', () => {
    const rows = [
      { id: 1, first_name: 'A', last_name: 'B', email: 'a@b.c', active: true } as Client,
      { id: 2, first_name: 'C', last_name: 'D', email: 'c@d.c', active: true } as Client,
    ];

    let result: Client[] | undefined;
    service.getClients().subscribe((r) => (result = r));

    httpMock.expectOne((r) => r.url === `${baseUrl}/clients`).flush({
      data: rows,
      links: {},
      meta: { current_page: 1, from: 1, last_page: 1, per_page: 15, to: 2, total: 2 },
    });

    expect(result).toEqual(rows);
  });

  it('GET /clients via getClients() with params', () => {
    service.getClients({ location_id: 2, search: 'Juan' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/clients`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('location_id')).toBe('2');
    expect(req.request.params.get('search')).toBe('Juan');
    req.flush([]);
  });

  it('listClientsPage reads meta.total/from/to/last_page from the envelope', () => {
    let page: ClientPage | undefined;
    service
      .listClientsPage({ search: 'x', sort: 'last_name', direction: 'asc' }, 2, 10)
      .subscribe((p) => (page = p));

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/clients` && r.params.get('page') === '2');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('per_page')).toBe('10');
    expect(req.request.params.get('search')).toBe('x');
    expect(req.request.params.get('sort')).toBe('last_name');
    expect(req.request.params.get('direction')).toBe('asc');
    req.flush({
      data: [{ id: 1, first_name: 'A', last_name: 'B', email: 'a@b.c', active: true }],
      links: {},
      meta: { current_page: 2, from: 11, last_page: 3, per_page: 10, to: 20, total: 25 },
    });

    expect(page?.total).toBe(25);
    expect(page?.from).toBe(11);
    expect(page?.to).toBe(20);
    expect(page?.lastPage).toBe(3);
    expect(page?.rows.length).toBe(1);
  });

  it('listClientsPage falls back to aggregation when the backend returns a flat array', () => {
    let page: ClientPage | undefined;
    service.listClientsPage({}, 1, 10).subscribe((p) => (page = p));

    // Request inicial (per_page=10) devuelve array plano → dispara el fallback.
    httpMock
      .expectOne((r) => r.url === `${baseUrl}/clients` && r.params.get('per_page') === '10')
      .flush([]);

    // collectPaginatedPages pide per_page=100&page=1.
    httpMock
      .expectOne(
        (r) =>
          r.url === `${baseUrl}/clients` &&
          r.params.get('per_page') === '100' &&
          r.params.get('page') === '1',
      )
      .flush([{ id: 1, first_name: 'A', last_name: 'B', email: 'a@b.c', active: true }]);

    expect(page?.rows.length).toBe(1);
    expect(page?.total).toBe(1);
    expect(page?.lastPage).toBe(1);
  });

  it('GET /clients/:id via getClient()', () => {
    const dummy: Client = { id: 5, first_name: 'Ana', last_name: 'García', email: 'ana@test.com', active: true };

    service.getClient(5).subscribe((data) => {
      expect(data).toEqual(dummy);
    });

    const req = httpMock.expectOne(`${baseUrl}/clients/5`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: dummy });
  });

  it('POST /clients via createClient()', () => {
    const payload: Partial<Client> = { first_name: 'Nuevo', last_name: 'Cliente', email: 'nuevo@test.com' };
    const response: Client = { id: 10, ...payload, active: true } as Client;

    service.createClient(payload).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/clients`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(response);
  });

  it('PATCH /clients/:id via updateClient()', () => {
    const payload: Partial<Client> = { email: 'updated@test.com' };
    const response: Client = { id: 3, first_name: 'Carlos', last_name: 'López', email: 'updated@test.com', active: true };

    service.updateClient(3, payload).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/clients/3`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush({ data: response });
  });

  it('GET /clients/:id/packs via getClientPacks()', () => {
    const dummy: ClientPack[] = [
      { id: 1, client_id: 1, service_pack_id: 1, total_sessions: 3, used_sessions: 1, remaining_sessions: 2, status: 'active' },
    ];

    service.getClientPacks(1).subscribe((data) => {
      expect(data).toEqual(dummy);
    });

    const req = httpMock.expectOne(`${baseUrl}/clients/1/packs`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: dummy });
  });

  it('GET /client-packs via getClientPacksList()', () => {
    const dummy: PaginatedResponse<ClientPack> = {
      data: [{ id: 1, client_id: 1, service_pack_id: 1, total_sessions: 3, used_sessions: 1, remaining_sessions: 2, status: 'active' }],
      meta: { current_page: 1, from: 1, last_page: 1, per_page: 10, to: 1, total: 1 },
    };

    service.getClientPacksList({ client_id: 1 }).subscribe((data) => {
      expect(data).toEqual(dummy);
    });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/client-packs`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('client_id')).toBe('1');
    req.flush(dummy);
  });

  it('PATCH /client-packs/:id/use via useClientPack()', () => {
    const response: ClientPack = { id: 1, client_id: 1, service_pack_id: 1, total_sessions: 3, used_sessions: 1, remaining_sessions: 2, status: 'active' };

    service.useClientPack(1, 42).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/client-packs/1/use`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ booking_id: 42 });
    req.flush(response);
  });
});
