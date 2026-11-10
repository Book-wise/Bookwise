import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { ClinicalRecordsStore } from './clinical-records.store';
import { ClinicalRecordsApiService } from '@services/api/clinical-records-api.service';
import type { ClinicalRecord } from '@models';

function makeRecord(overrides: Partial<ClinicalRecord> = {}): ClinicalRecord {
  return {
    id: 1,
    client_id: 7,
    booking_id: 900,
    record_type_id: 10,
    title: 'Ficha clínica',
    values: {},
    created_at: '2026-11-12T10:30:00-03:00',
    author_name: 'Camila Rojas',
    created_by: null,
    ...overrides,
  };
}

describe('ClinicalRecordsStore.update', () => {
  let store: InstanceType<typeof ClinicalRecordsStore>;
  let recordsApi: { updateRecord: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    recordsApi = { updateRecord: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClinicalRecordsApiService, useValue: recordsApi },
      ],
    });
    store = TestBed.inject(ClinicalRecordsStore);
    patchState(unprotected(store), { records: [] });
  });

  it('hace el PATCH con los values y reemplaza el registro en el estado local', () => {
    const original = makeRecord({ id: 1, values: { diagnostico: 'viejo' } });
    const updated = makeRecord({ id: 1, values: { diagnostico: 'nuevo' } });
    const other = makeRecord({ id: 2, title: 'Ficha láser' });
    patchState(unprotected(store), { records: [original, other] });
    recordsApi.updateRecord.mockReturnValue(of(updated));

    let emitted: ClinicalRecord | null = null;
    store.update(1, { diagnostico: 'nuevo' }).subscribe((record) => (emitted = record));

    expect(recordsApi.updateRecord).toHaveBeenCalledTimes(1);
    expect(recordsApi.updateRecord).toHaveBeenCalledWith(1, { values: { diagnostico: 'nuevo' } });
    expect(emitted).toEqual(updated);
    expect(store.records()).toEqual([updated, other]);
    expect(store.records().length).toBe(2);
  });

  it('un error del PATCH no altera el estado local', () => {
    const original = makeRecord({ id: 1, values: { diagnostico: 'viejo' } });
    patchState(unprotected(store), { records: [original] });
    recordsApi.updateRecord.mockReturnValue(throwError(() => new Error('boom')));

    let errored = false;
    store.update(1, { diagnostico: 'nuevo' }).subscribe({ error: () => (errored = true) });

    expect(errored).toBe(true);
    expect(store.records()).toEqual([original]);
  });
});

describe('ClinicalRecordsStore.uploadImage', () => {
  let store: InstanceType<typeof ClinicalRecordsStore>;
  let recordsApi: { uploadImage: ReturnType<typeof vi.fn> };

  const file = (): File => new File(['binario'], 'lesion.png', { type: 'image/png' });

  beforeEach(() => {
    recordsApi = { uploadImage: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClinicalRecordsApiService, useValue: recordsApi },
      ],
    });
    store = TestBed.inject(ClinicalRecordsStore);
    patchState(unprotected(store), { records: [] });
  });

  it('sube la imagen y reemplaza el registro con la respuesta del servidor', () => {
    const original = makeRecord({ id: 1, images: null });
    const other = makeRecord({ id: 2, title: 'Ficha láser' });
    const updated = makeRecord({ id: 1, images: { lesion: '/clinical-records/1/image/lesion' } });
    patchState(unprotected(store), { records: [original, other] });
    recordsApi.uploadImage.mockReturnValue(of(updated));
    const image = file();

    let emitted: ClinicalRecord | null = null;
    store.uploadImage(1, 'lesion', image).subscribe((record) => (emitted = record));

    expect(recordsApi.uploadImage).toHaveBeenCalledTimes(1);
    expect(recordsApi.uploadImage).toHaveBeenCalledWith(1, 'lesion', image);
    expect(emitted).toEqual(updated);
    expect(store.records()).toEqual([updated, other]);
    expect(store.records().length).toBe(2);
  });

  it('un error de la subida no altera el estado local', () => {
    const original = makeRecord({ id: 1, images: null });
    patchState(unprotected(store), { records: [original] });
    recordsApi.uploadImage.mockReturnValue(throwError(() => new Error('boom')));

    let errored = false;
    store.uploadImage(1, 'lesion', file()).subscribe({ error: () => (errored = true) });

    expect(errored).toBe(true);
    expect(store.records()).toEqual([original]);
  });
});
