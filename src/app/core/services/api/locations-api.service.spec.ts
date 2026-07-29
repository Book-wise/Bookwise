import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { LocationsApiService } from './locations-api.service';
import { environment } from '@env/environment';
import { Location, Region, LocationComuna } from '@models';

describe('LocationsApiService', () => {
  let service: LocationsApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(LocationsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /locations via getLocations()', () => {
    const dummy: Location[] = [
      { id: 1, name: 'Santiago', address: 'Av. Principal 123', city: 'Santiago', timezone: 'America/Santiago', active: true },
    ];

    service.getLocations().subscribe(data => {
      expect(data).toEqual(dummy);
    });

    const req = httpMock.expectOne(`${baseUrl}/locations`);
    expect(req.request.method).toBe('GET');
    req.flush(dummy);
  });

  it('GET /locations/:id via getLocation()', () => {
    const dummy: Location = { id: 1, name: 'Santiago', address: 'Av. Principal 123', city: 'Santiago', timezone: 'America/Santiago', active: true };

    service.getLocation(1).subscribe(data => {
      expect(data).toEqual(dummy);
    });

    const req = httpMock.expectOne(`${baseUrl}/locations/1`);
    expect(req.request.method).toBe('GET');
    req.flush(dummy);
  });

  it('POST /locations via createLocation()', () => {
    const payload: Partial<Location> = { name: 'Nueva Locación', address: 'Calle 456', city: 'Viña del Mar', timezone: 'America/Santiago', active: true };
    const response = { message: 'Location created', data: { ...payload, id: 99 } as Location };

    service.createLocation(payload).subscribe(res => {
      expect(res).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/locations`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(response);
  });

  it('PATCH /locations/:id via updateLocation()', () => {
    const payload: Partial<Location> & { force?: boolean } = { name: 'Locación Editada', force: true };
    const response = { message: 'Location updated', data: { id: 1, name: 'Locación Editada', address: 'Av. Principal 123', city: 'Santiago', timezone: 'America/Santiago', active: true } };

    service.updateLocation(1, payload).subscribe(res => {
      expect(res).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/locations/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush(response);
  });

  it('GET /regions via getRegions()', () => {
    const response = { data: [{ id: 1, name: 'Metropolitana', timezone: 'America/Santiago' }] as Region[] };

    service.getRegions().subscribe(res => {
      expect(res).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/regions`);
    expect(req.request.method).toBe('GET');
    req.flush(response);
  });

  it('GET /regions/:id/comunas via getComunas()', () => {
    const response = { data: [{ id: 101, name: 'Santiago Centro' }] as LocationComuna[] };

    service.getComunas(1).subscribe(res => {
      expect(res).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/regions/1/comunas`);
    expect(req.request.method).toBe('GET');
    req.flush(response);
  });

  it('GET /comunas via getAllComunas()', () => {
    const response = { data: [{ id: 101, name: 'Santiago Centro', region_id: 1 }] as (LocationComuna & { region_id: number })[] };

    service.getAllComunas().subscribe(res => {
      expect(res).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/comunas`);
    expect(req.request.method).toBe('GET');
    req.flush(response);
  });
});
