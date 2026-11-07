import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ServicesApiService } from './services-api.service';
import { environment } from '@env/environment';
import {
  Service,
  ServicePack,
  PaginatedResponse,
  CreateServicePayload,
  UpdateServicePayload,
} from '@models';

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

  it('GET /services via getServices() agrega todas las páginas del envelope {data, links, meta}', () => {
    const page1: Service[] = [
      { id: 1, name: 'Corte', duration_minutes: 30, price: 15000, active: true },
    ];
    const page2: Service[] = [
      { id: 2, name: 'Color', duration_minutes: 60, price: 30000, active: true },
    ];

    let recibidos: Service[] | undefined;
    service.getServices().subscribe((data) => (recibidos = data));

    const req1 = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/services` && r.params.get('page') === '1',
    );
    expect(req1.request.method).toBe('GET');
    expect(req1.request.params.get('per_page')).toBe('100');
    req1.flush({
      data: page1,
      links: {},
      meta: { current_page: 1, last_page: 2, per_page: 100, total: 2 },
    } as unknown as PaginatedResponse<Service>);

    const req2 = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/services` && r.params.get('page') === '2',
    );
    req2.flush({
      data: page2,
      links: {},
      meta: { current_page: 2, last_page: 2, per_page: 100, total: 2 },
    } as unknown as PaginatedResponse<Service>);

    expect(recibidos).toEqual([...page1, ...page2]);
  });

  it('GET /services tolera el array plano del backend anterior al deploy', () => {
    const dummy: Service[] = [
      { id: 1, name: 'Corte', duration_minutes: 30, price: 15000, active: true },
    ];

    let recibidos: Service[] | undefined;
    service.getServices().subscribe((data) => (recibidos = data));

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/services`);
    expect(req.request.method).toBe('GET');
    req.flush(dummy);

    expect(recibidos).toEqual(dummy);
  });

  it('GET /services pasa search, status y active por query params', () => {
    let recibidos: Service[] | undefined;
    service
      .getServices({ search: 'Kine', status: 'draft', active: 1 })
      .subscribe((data) => (recibidos = data));

    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/services` && r.params.get('page') === '1',
    );
    expect(req.request.params.get('search')).toBe('Kine');
    expect(req.request.params.get('status')).toBe('draft');
    expect(req.request.params.get('active')).toBe('1');
    expect(req.request.params.get('per_page')).toBe('100');
    req.flush({
      data: [],
      links: {},
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 },
    } as unknown as PaginatedResponse<Service>);

    expect(recibidos).toEqual([]);
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

  it('POST /services via createService() envía el payload completo con variations[]', () => {
    const payload: CreateServicePayload = {
      name: 'Kinesiología',
      description: 'Sesión de kinesiología',
      attribute_name: 'Sesiones',
      duration_minutes: 60,
      price: 25000,
      slot_interval_minutes: 30,
      active: true,
      status: 'draft',
      variations: [
        { term: '1 sesión', total_sessions: 1, price: 25000 },
        {
          term: '3 sesiones',
          total_sessions: 3,
          price: 67500,
          compare_at_price: 75000,
          sku: 'svc-1-3',
          active: true,
        },
      ],
    };
    const response: Service = {
      id: 1,
      name: payload.name,
      duration_minutes: payload.duration_minutes,
      price: payload.price,
      active: true,
      status: 'draft',
      attribute_name: payload.attribute_name,
      variations: [
        {
          id: 1,
          term: '1 sesión',
          total_sessions: 1,
          price: 25000,
          discount_percent: null,
          name: 'Kinesiología - 1 sesión',
        },
        {
          id: 2,
          term: '3 sesiones',
          total_sessions: 3,
          price: 67500,
          compare_at_price: 75000,
          discount_percent: 10,
          sku: 'svc-1-3',
          active: true,
          name: 'Kinesiología - 3 sesiones',
        },
      ],
    };

    service.createService(payload).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/services`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(response);
  });

  it('PATCH /services/:id via updateService() envía un parcial', () => {
    const payload: UpdateServicePayload = { description: 'Nueva descripción', status: 'inactive' };
    const response: Service = {
      id: 1,
      name: 'Kinesiología',
      duration_minutes: 60,
      price: 25000,
      active: false,
      description: 'Nueva descripción',
      status: 'inactive',
    };

    service.updateService(1, payload).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/services/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush(response);
  });

  it('DELETE /services/:id via deleteService() sin force no agrega force=true', () => {
    service.deleteService(1).subscribe((data) => {
      expect(data).toBeNull();
    });

    const req = httpMock.expectOne(`${baseUrl}/services/1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('force')).toBeNull();
    req.flush(null);
  });

  it('DELETE /services/:id?force=true via deleteService(id, true)', () => {
    service.deleteService(1, true).subscribe((data) => {
      expect(data).toBeNull();
    });

    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/services/1` && r.params.get('force') === 'true',
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('POST /services/:id/image via uploadServiceImage() envía FormData sin Content-Type manual', () => {
    const file = new File(['contenido'], 'foto.jpg', { type: 'image/jpeg' });
    const response = {
      image_url: '/storage/services/1.jpg',
      image_thumb_url: '/storage/services/1_thumb.jpg',
    };

    service.uploadServiceImage(1, file).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/services/1/image`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('image')).toEqual(file);
    expect(req.request.headers.get('Content-Type')).toBeNull();
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
