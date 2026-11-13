import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
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

const file = (): File => new File(['binario'], 'lesion.png', { type: 'image/png' });

describe('ClinicalRecordsStore', () => {
  let store: InstanceType<typeof ClinicalRecordsStore>;
  let recordsApi: {
    getRecords: ReturnType<typeof vi.fn>;
    createRecord: ReturnType<typeof vi.fn>;
    updateRecord: ReturnType<typeof vi.fn>;
    uploadImage: ReturnType<typeof vi.fn>;
  };
  /** Fixtures por paciente que devuelve el `GET /clinical-records` de mentira. */
  let fixtures: Record<number, ClinicalRecord[]>;

  beforeEach(() => {
    recordsApi = {
      getRecords: vi.fn(),
      createRecord: vi.fn(),
      updateRecord: vi.fn(),
      uploadImage: vi.fn(),
    };
    fixtures = {};
    recordsApi.getRecords.mockImplementation((params: { client_id: number }) =>
      of(fixtures[params.client_id] ?? []),
    );

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClinicalRecordsApiService, useValue: recordsApi },
      ],
    });
    store = TestBed.inject(ClinicalRecordsStore);
    patchState(unprotected(store), {
      byClient: {},
      loadedClients: {},
      loadingClients: {},
      error: null,
    });
  });

  /** Carga el bucket de un paciente con el listado que sirve `fixtures`. */
  function load(clientId: number, records: ClinicalRecord[]): void {
    fixtures[clientId] = records;
    store.loadByClient(clientId);
  }

  describe('loadByClient (caché por paciente)', () => {
    it('pide la API una sola vez y la segunda llamada del mismo paciente no vuelve a pedirla', () => {
      load(7, [makeRecord({ id: 1 })]);

      expect(recordsApi.getRecords).toHaveBeenCalledTimes(1);
      expect(recordsApi.getRecords).toHaveBeenCalledWith({ client_id: 7 });
      expect(store.recordsFor(7).map((r) => r.id)).toEqual([1]);
      expect(store.loadedClients()[7]).toBe(true);
      expect(store.loadingClients()[7]).toBe(false);

      store.loadByClient(7);

      expect(recordsApi.getRecords).toHaveBeenCalledTimes(1);
      expect(store.recordsFor(7).map((r) => r.id)).toEqual([1]);
    });

    it('dos llamadas simultáneas del mismo paciente producen un único request', () => {
      const inFlight = new Subject<ClinicalRecord[]>();
      recordsApi.getRecords.mockReturnValueOnce(inFlight.asObservable());

      store.loadByClient(7);
      store.loadByClient(7);

      expect(recordsApi.getRecords).toHaveBeenCalledTimes(1);
      expect(store.loadingClients()[7]).toBe(true);
      expect(store.recordsFor(7)).toEqual([]);

      inFlight.next([makeRecord({ id: 1 })]);
      inFlight.complete();

      expect(store.loadingClients()[7]).toBe(false);
      expect(store.recordsFor(7).map((r) => r.id)).toEqual([1]);

      // Ya cargado: la tercera llamada sigue sin gastar otro GET.
      store.loadByClient(7);
      expect(recordsApi.getRecords).toHaveBeenCalledTimes(1);
    });

    it('otro paciente dispara su propio request y ambos buckets quedan independientes', () => {
      load(7, [makeRecord({ id: 1, client_id: 7 })]);
      load(8, [makeRecord({ id: 2, client_id: 8 })]);

      expect(recordsApi.getRecords).toHaveBeenCalledTimes(2);
      expect(recordsApi.getRecords).toHaveBeenNthCalledWith(1, { client_id: 7 });
      expect(recordsApi.getRecords).toHaveBeenNthCalledWith(2, { client_id: 8 });
      expect(store.recordsFor(7).map((r) => r.id)).toEqual([1]);
      expect(store.recordsFor(8).map((r) => r.id)).toEqual([2]);
    });

    it('un error deja el paciente sin cargar, guarda el mensaje y permite reintentar', () => {
      recordsApi.getRecords.mockReturnValueOnce(throwError(() => new Error('boom')));

      store.loadByClient(7);

      expect(store.error()).toBe('boom');
      expect(store.loadingClients()[7]).toBe(false);
      expect(store.loadedClients()[7]).toBeFalsy();
      expect(store.recordsFor(7)).toEqual([]);

      load(7, [makeRecord({ id: 1 })]);
      store.loadByClient(7);

      expect(recordsApi.getRecords).toHaveBeenCalledTimes(2);
      expect(store.error()).toBeNull();
      expect(store.recordsFor(7).map((r) => r.id)).toEqual([1]);
    });

    it('recordsFor de un paciente desconocido devuelve un arreglo vacío', () => {
      expect(store.recordsFor(99)).toEqual([]);
      expect(store.byClient()[99]).toBeUndefined();
    });
  });

  describe('refresh', () => {
    it('vuelve a pedir el listado y reemplaza solo el bucket de ese paciente', () => {
      load(7, [makeRecord({ id: 1, client_id: 7 })]);
      load(8, [makeRecord({ id: 9, client_id: 8 })]);

      const refreshed = [
        makeRecord({ id: 1, client_id: 7, values: { diagnostico: 'nuevo' } }),
        makeRecord({ id: 2, client_id: 7 }),
      ];
      fixtures[7] = refreshed;
      store.refresh(7);

      expect(recordsApi.getRecords).toHaveBeenCalledTimes(3);
      expect(recordsApi.getRecords).toHaveBeenNthCalledWith(3, { client_id: 7 });
      expect(store.recordsFor(7)).toEqual(refreshed);
      expect(store.recordsFor(8).map((r) => r.id)).toEqual([9]);
      expect(store.loadedClients()[7]).toBe(true);
      expect(store.loadedClients()[8]).toBe(true);
    });
  });

  describe('byBooking / historyFor', () => {
    it('filtra dentro del bucket del paciente, más recientes primero', () => {
      load(7, [
        makeRecord({ id: 1, client_id: 7, booking_id: 900, created_at: '2026-11-10T09:00:00-03:00' }),
        makeRecord({ id: 2, client_id: 7, booking_id: 900, created_at: '2026-11-12T09:00:00-03:00' }),
        makeRecord({ id: 3, client_id: 7, booking_id: 901, created_at: '2026-11-01T09:00:00-03:00' }),
      ]);
      load(8, [makeRecord({ id: 4, client_id: 8, booking_id: 900 })]);

      expect(store.byBooking(7, 900).map((r) => r.id)).toEqual([2, 1]);
      expect(store.historyFor(7, 900).map((r) => r.id)).toEqual([3]);
      expect(store.byBooking(8, 900).map((r) => r.id)).toEqual([4]);
      expect(store.historyFor(8, 900)).toEqual([]);
      expect(store.byBooking(7, 999)).toEqual([]);
    });

    it('no devuelve fichas cuando el paciente todavía no se cargó', () => {
      expect(store.byBooking(7, 900)).toEqual([]);
      expect(store.historyFor(7, 900)).toEqual([]);
    });
  });

  describe('create', () => {
    it('hace el POST y antepone el registro en el bucket del paciente sin tocar otro', () => {
      load(7, [makeRecord({ id: 1, client_id: 7 })]);
      load(8, [makeRecord({ id: 9, client_id: 8 })]);
      const created = makeRecord({ id: 3, client_id: 7, title: 'Ficha láser' });
      recordsApi.createRecord.mockReturnValue(of(created));

      let emitted: ClinicalRecord | null = null;
      store
        .create({ recordTypeId: 10, clientId: 7, bookingId: 900, values: { dolor: '3' } })
        .subscribe((record) => (emitted = record));

      expect(recordsApi.createRecord).toHaveBeenCalledTimes(1);
      expect(recordsApi.createRecord).toHaveBeenCalledWith({
        client_id: 7,
        booking_id: 900,
        record_type_id: 10,
        values: { dolor: '3' },
      });
      expect(emitted).toEqual(created);
      expect(store.recordsFor(7).map((r) => r.id)).toEqual([3, 1]);
      expect(store.recordsFor(8).map((r) => r.id)).toEqual([9]);
    });

    it('sin bucket cargado devuelve el registro y no inventa el listado del paciente', () => {
      const created = makeRecord({ id: 3, client_id: 7 });
      recordsApi.createRecord.mockReturnValue(of(created));

      let emitted: ClinicalRecord | null = null;
      store
        .create({ recordTypeId: 10, clientId: 7, values: {} })
        .subscribe((record) => (emitted = record));

      expect(emitted).toEqual(created);
      expect(store.byClient()[7]).toBeUndefined();
      expect(store.recordsFor(7)).toEqual([]);
    });
  });

  describe('update', () => {
    it('hace el PATCH y reemplaza el registro en el bucket del client_id devuelto', () => {
      const original = makeRecord({ id: 1, client_id: 7, values: { diagnostico: 'viejo' } });
      const sibling = makeRecord({ id: 2, client_id: 7, title: 'Ficha láser' });
      // El mismo id en el bucket de otro paciente: no debe tocarse.
      const foreign = makeRecord({ id: 1, client_id: 8, values: { diagnostico: 'ajeno' } });
      load(7, [original, sibling]);
      load(8, [foreign]);
      const updated = makeRecord({ id: 1, client_id: 7, values: { diagnostico: 'nuevo' } });
      recordsApi.updateRecord.mockReturnValue(of(updated));

      let emitted: ClinicalRecord | null = null;
      store.update(1, { diagnostico: 'nuevo' }).subscribe((record) => (emitted = record));

      expect(recordsApi.updateRecord).toHaveBeenCalledTimes(1);
      expect(recordsApi.updateRecord).toHaveBeenCalledWith(1, {
        values: { diagnostico: 'nuevo' },
      });
      expect(emitted).toEqual(updated);
      expect(store.recordsFor(7)).toEqual([updated, sibling]);
      expect(store.recordsFor(8)).toEqual([foreign]);
    });

    it('un error del PATCH no altera el estado local', () => {
      const original = makeRecord({ id: 1, client_id: 7, values: { diagnostico: 'viejo' } });
      load(7, [original]);
      recordsApi.updateRecord.mockReturnValue(throwError(() => new Error('boom')));

      let errored = false;
      store.update(1, { diagnostico: 'nuevo' }).subscribe({ error: () => (errored = true) });

      expect(errored).toBe(true);
      expect(store.recordsFor(7)).toEqual([original]);
    });
  });

  describe('uploadImage', () => {
    it('sube la imagen y reemplaza el registro en el bucket del client_id devuelto', () => {
      const original = makeRecord({ id: 1, client_id: 7, images: null });
      const sibling = makeRecord({ id: 2, client_id: 7, title: 'Ficha láser' });
      const foreign = makeRecord({ id: 1, client_id: 8, images: null });
      load(7, [original, sibling]);
      load(8, [foreign]);
      const updated = makeRecord({
        id: 1,
        client_id: 7,
        images: { lesion: '/clinical-records/1/image/lesion' },
      });
      recordsApi.uploadImage.mockReturnValue(of(updated));
      const image = file();

      let emitted: ClinicalRecord | null = null;
      store.uploadImage(1, 'lesion', image).subscribe((record) => (emitted = record));

      expect(recordsApi.uploadImage).toHaveBeenCalledTimes(1);
      expect(recordsApi.uploadImage).toHaveBeenCalledWith(1, 'lesion', image);
      expect(emitted).toEqual(updated);
      expect(store.recordsFor(7)).toEqual([updated, sibling]);
      expect(store.recordsFor(8)).toEqual([foreign]);
    });

    it('un error de la subida no altera el estado local', () => {
      const original = makeRecord({ id: 1, client_id: 7, images: null });
      load(7, [original]);
      recordsApi.uploadImage.mockReturnValue(throwError(() => new Error('boom')));

      let errored = false;
      store.uploadImage(1, 'lesion', file()).subscribe({ error: () => (errored = true) });

      expect(errored).toBe(true);
      expect(store.recordsFor(7)).toEqual([original]);
    });
  });
});
