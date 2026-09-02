import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ClientsApiService } from './clients-api.service';
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

  it('GET /clients via getClients() with params', () => {
    service.getClients({ location_id: 2, search: 'Juan' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/clients`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('location_id')).toBe('2');
    expect(req.request.params.get('search')).toBe('Juan');
    req.flush([]);
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
