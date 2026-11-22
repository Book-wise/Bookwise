import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RecordPrintComponent } from './record-print.component';
import { ClientsApiService } from '@services/api/clients-api.service';
import { ClinicalRecordsApiService } from '@services/api/clinical-records-api.service';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';
import { AuthService } from '@services/auth.service';
import { HttpErrorService } from '@services/http-error.service';
import type { Client, ClinicalRecord } from '@models';

const client: Partial<Client> = {
  id: 7,
  first_name: 'Camila',
  last_name: 'Rojas Fuentes',
  rut: '17.234.567-8',
  phone: '+56 9 8765 4321',
};

const record: Partial<ClinicalRecord> = {
  id: 42,
  client_id: 7,
  record_type_id: 3,
  title: 'Evaluación kinesica inicial',
  values: { diagnostico: 'Dolor lumbar mecánico' },
  images: { foto_frontal: 'clinical-records/42/foto_frontal.jpg' },
  created_at: '2026-11-05T14:30:00Z',
  author_name: 'Carlos Rojas',
};

describe('RecordPrintComponent', () => {
  let clientsApi: { getClient: ReturnType<typeof vi.fn> };
  let recordsApi: { getRecords: ReturnType<typeof vi.fn>; getImageBlob: ReturnType<typeof vi.fn> };
  let typesStore: { load: ReturnType<typeof vi.fn>; types: () => unknown[] };
  const fixturePart = () => TestBed.createComponent(RecordPrintComponent);

  beforeEach(async () => {
    clientsApi = { getClient: vi.fn().mockReturnValue(of(client)) };
    recordsApi = {
      getRecords: vi.fn().mockReturnValue(of([record])),
      getImageBlob: vi.fn().mockReturnValue(of(new Blob(['x'], { type: 'image/jpeg' }))),
    };
    typesStore = {
      load: vi.fn(),
      types: () => [{ id: 3, name: 'Evaluación', active: true, fields: [
        { key: 'diagnostico', label: 'Diagnóstico funcional', type: 'longtext', required: false },
        { key: 'foto_frontal', label: 'Foto frontal', type: 'image', required: false },
      ] }],
    };

    await TestBed.configureTestingModule({
      imports: [RecordPrintComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClientsApiService, useValue: clientsApi },
        { provide: ClinicalRecordsApiService, useValue: recordsApi },
        { provide: ClinicalRecordTypesStore, useValue: typesStore },
        { provide: AuthService, useValue: { me: () => ({ business: { id: 1, name: 'Kinesilk', rut: '76.111.222-3', address: 'Av. Apoquindo 4700', phone: '+56 2 2345 6789', logo_url: null } }) } },
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ clientId: '7' }) } } },
      ],
    }).compileComponents();
  });

  it('loads the client, the records and resolves fields from the type of each record', () => {
    const fixture = fixturePart();
    fixture.detectChanges();

    expect(typesStore.load).toHaveBeenCalled();
    expect(clientsApi.getClient).toHaveBeenCalledWith(7);
    expect(recordsApi.getRecords).toHaveBeenCalledWith({ client_id: 7 });
    expect(fixture.componentInstance.sortedRecords()[0].id).toBe(42);
    expect(fixture.componentInstance.valueFields(record as ClinicalRecord).map((f) => f.key)).toEqual(['diagnostico']);
    expect(fixture.componentInstance.imageFields(record as ClinicalRecord).map((f) => f.key)).toEqual(['foto_frontal']);
  });

  it('downloads every referenced image blob as an object URL', () => {
    const fixture = fixturePart();
    fixture.detectChanges();

    expect(recordsApi.getImageBlob).toHaveBeenCalledWith(42, 'foto_frontal');
    expect(Object.values(fixture.componentInstance.imageUrls()).length).toBe(1);
    expect(Object.values(fixture.componentInstance.imageUrls())[0]).toMatch(/^blob:/);
  });

  it('prints without failing when an image 404s, and keeps loading state reset by the records stream', () => {
    recordsApi.getImageBlob.mockReturnValue(throwError(() => new Error('404')));
    const fixture = fixturePart();
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.client()?.id).toBe(7);
  });
});
