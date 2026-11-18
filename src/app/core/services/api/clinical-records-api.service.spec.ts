import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ClinicalRecordsApiService } from './clinical-records-api.service';
import { environment } from '@env/environment';

describe('ClinicalRecordsApiService', () => {
  let service: ClinicalRecordsApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  const makeResource = (overrides: Record<string, unknown> = {}) => ({
    id: 12,
    client_id: 88,
    booking_id: 452,
    record_type_id: 3,
    values: { motivo: 'dolor lumbar' },
    created_by: 5,
    author_name: 'Carlos Rojas',
    created_at: '2026-11-10T10:00:00Z',
    record_type: { name: 'Evaluación kinésica' },
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ClinicalRecordsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getRecords mapea record_type.name → title y envía los filtros', () => {
    service.getRecords({ client_id: 88, booking_id: 452 }).subscribe((res) => {
      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('Evaluación kinésica');
      expect(res[0].client_id).toBe(88);
      expect(res[0].booking_id).toBe(452);
      expect(res[0].author_name).toBe('Carlos Rojas');
    });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/clinical-records`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('client_id')).toBe('88');
    expect(req.request.params.get('booking_id')).toBe('452');
    req.flush([makeResource()]);
  });

  it('createRecord hace POST con el payload y mapea la respuesta', () => {
    const payload = {
      client_id: 88,
      booking_id: 452,
      record_type_id: 3,
      values: { motivo: 'x' },
    };

    service.createRecord(payload).subscribe((res) => expect(res.title).toBe('Evaluación kinésica'));

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/clinical-records`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(makeResource());
  });

  it('updateRecord hace PATCH a /clinical-records/{id}', () => {
    service.updateRecord(12, { values: { motivo: 'otro' } }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/clinical-records/12`);
    expect(req.request.method).toBe('PATCH');
    req.flush(makeResource({ values: { motivo: 'otro' } }));
  });

  describe('campo image (F10)', () => {
    it('uploadImage envía multipart con `key` + `file` y nada de `values`', () => {
      const file = new File(['binario'], 'lesion.png', { type: 'image/png' });

      service.uploadImage(12, 'lesion', file).subscribe((res) => {
        expect(res.images).toEqual({ lesion: '/clinical-records/12/image/lesion' });
        expect(res.values).toEqual({ motivo: 'dolor lumbar' });
      });

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/clinical-records/12/image`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBe(true);

      const body = req.request.body as FormData;
      expect(body.get('key')).toBe('lesion');
      expect(body.get('file')).toEqual(file);
      // La clave de la imagen es gestionada por el servidor: jamás viaja en `values`.
      expect(body.has('values')).toBe(false);
      expect([...body.keys()].sort()).toEqual(['file', 'key']);

      req.flush(makeResource({ images: { lesion: '/clinical-records/12/image/lesion' } }));
    });

    it('getImageBlob pide el binario con responseType blob', () => {
      const blob = new Blob(['png'], { type: 'image/png' });

      let received: Blob | null = null;
      service.getImageBlob(12, 'lesion').subscribe((res) => (received = res));

      const req = httpMock.expectOne(`${baseUrl}/clinical-records/12/image/lesion`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(blob);

      expect(received).toEqual(blob);
    });

    it('getPdf pide el PDF con responseType blob', () => {
      const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

      let received: Blob | null = null;
      service.getPdf(12).subscribe((res) => (received = res));

      const req = httpMock.expectOne(`${baseUrl}/clinical-records/12/pdf`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(blob);

      expect(received).toEqual(blob);
    });

    it('normaliza `images` (mapa en el detalle, `null` cuando no viene)', () => {
      service
        .getRecords({ client_id: 88 })
        .subscribe((res) => expect(res[0].images).toEqual({ lesion: '/clinical-records/12/image/lesion' }));

      httpMock
        .expectOne((r) => r.url === `${baseUrl}/clinical-records`)
        .flush([makeResource({ images: { lesion: '/clinical-records/12/image/lesion' } })]);

      service.getRecords({ client_id: 88 }).subscribe((res) => expect(res[0].images).toBeNull());

      httpMock.expectOne((r) => r.url === `${baseUrl}/clinical-records`).flush([makeResource()]);
    });
  });
});
