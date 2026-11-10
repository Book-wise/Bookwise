import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Observable, tap } from 'rxjs';
import type { ClinicalRecord } from '@models';
import {
  ClinicalRecordsApiService,
  type CreateClinicalRecordPayload,
} from '@services/api/clinical-records-api.service';

/** Lo que la pestaña Ficha necesita para crear un registro clínico. */
export interface CreateClinicalRecordInput {
  recordTypeId: number;
  clientId: number;
  bookingId?: number | null;
  values: Record<string, unknown>;
}

interface ClinicalRecordsState {
  records: ClinicalRecord[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

const initialState: ClinicalRecordsState = {
  records: [],
  loading: false,
  loaded: false,
  error: null,
};

/**
 * Store de dominio de los **registros clínicos**.
 *
 * `loadByClient(clientId)` pide `GET /clinical-records?client_id=` (agrega todas
 * las páginas, orden `created_at desc`) y de ahí derivan `byBooking` (fichas de
 * la reserva) y `historyFor` (historial de consultas anteriores: todo lo que no
 * es la reserva abierta). `create()` hace el POST real y antepone el registro
 * devuelto por el servidor (id, `author_name` y `created_at` resueltos).
 * `update()` hace el PATCH de `values` y reemplaza ese registro en el estado
 * local (el detalle inline vuelve a la lectura con los valores guardados).
 */
export const ClinicalRecordsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withMethods((store, recordsApi = inject(ClinicalRecordsApiService)) => {
    const byDateDesc = (a: ClinicalRecord, b: ClinicalRecord): number =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    return {
      /** Fichas asociadas a una reserva, más recientes primero. */
      byBooking(bookingId: number | null): ClinicalRecord[] {
        return store
          .records()
          .filter((r) => r.booking_id === bookingId)
          .sort(byDateDesc);
      },

      /** Historial de consultas anteriores: fichas de otras reservas. */
      historyFor(bookingId: number | null): ClinicalRecord[] {
        return store
          .records()
          .filter((r) => r.booking_id !== bookingId)
          .sort(byDateDesc);
      },

      /** Carga todas las fichas del paciente (fuente de `byBooking`/`historyFor`). */
      loadByClient(clientId: number): void {
        patchState(store, { loading: true, error: null });
        recordsApi.getRecords({ client_id: clientId }).subscribe({
          next: (records) =>
            patchState(store, { records, loading: false, loaded: true }),
          error: (err: Error) =>
            patchState(store, {
              loading: false,
              error: err.message ?? 'Error al cargar las fichas',
            }),
        });
      },

      /** Crea el registro en la API y antepone el resultado al listado local. */
      create(input: CreateClinicalRecordInput): Observable<ClinicalRecord> {
        const payload: CreateClinicalRecordPayload = {
          client_id: input.clientId,
          booking_id: input.bookingId ?? null,
          record_type_id: input.recordTypeId,
          values: input.values,
        };
        return recordsApi.createRecord(payload).pipe(
          tap((record) => patchState(store, { records: [record, ...store.records()] })),
        );
      },

      /**
       * Actualiza los `values` de una ficha (`PATCH /clinical-records/{id}`) y
       * reemplaza ese registro en el listado local con la respuesta del server.
       */
      update(id: number, values: Record<string, unknown>): Observable<ClinicalRecord> {
        return recordsApi.updateRecord(id, { values }).pipe(
          tap((updated) =>
            patchState(store, {
              records: store.records().map((record) => (record.id === updated.id ? updated : record)),
            }),
          ),
        );
      },
    };
  }),
);
