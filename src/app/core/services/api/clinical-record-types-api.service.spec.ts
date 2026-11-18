import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ClinicalRecordTypesApiService } from './clinical-record-types-api.service';
import { environment } from '@env/environment';
import type { ClinicalRecordType } from '@models';

describe('ClinicalRecordTypesApiService', () => {
  let service: ClinicalRecordTypesApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  const makeType = (overrides: Partial<ClinicalRecordType> = {}): ClinicalRecordType => ({
    id: 1,
    name: 'Evaluación kinésica',
    active: true,
    sort_order: 10,
    fields: [],
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ClinicalRecordTypesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getTypes normaliza options: null → undefined y devuelve el listado', () => {
    const raw = makeType({
      fields: [{ key: 'motivo', label: 'Motivo', type: 'text', required: true, options: null }],
    });

    service.getTypes().subscribe((res) => {
      expect(res).toHaveLength(1);
      expect(res[0].fields[0].options).toBeUndefined();
    });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/clinical-record-types`);
    expect(req.request.method).toBe('GET');
    // array plano (una página corta) → el listado no se trunca
    req.flush([raw]);
  });

  it('createType hace POST con el payload y normaliza la respuesta', () => {
    const payload = { name: 'Láser', active: true, fields: [] };

    service.createType(payload).subscribe((res) => expect(res.id).toBe(3));

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/clinical-record-types`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(makeType({ id: 3, name: 'Láser' }));
  });

  it('updateType hace PATCH a /clinical-record-types/{id}', () => {
    service.updateType(3, { name: 'Láser 2' }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/clinical-record-types/3`);
    expect(req.request.method).toBe('PATCH');
    req.flush(makeType({ id: 3, name: 'Láser 2' }));
  });
});
