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
  /** Fichas por paciente (`clientId` → registros tal como los devolvió la API). */
  byClient: Record<number, ClinicalRecord[]>;
  /** Pacientes cuyo listado ya se pidió y llegó bien (llave de la caché). */
  loadedClients: Record<number, boolean>;
  /** Pacientes con un `GET /clinical-records` en vuelo (dedupe de requests). */
  loadingClients: Record<number, boolean>;
  error: string | null;
}

const initialState: ClinicalRecordsState = {
  byClient: {},
  loadedClients: {},
  loadingClients: {},
  error: null,
};

/**
 * Store de dominio de los **registros clínicos**, con caché **por paciente**.
 *
 * Cada paciente tiene su propio bucket (`byClient[clientId]`), así que abrir la
 * reserva de otro paciente ya no pisa el listado anterior. `loadByClient()`
 * pide `GET /clinical-records?client_id=` solo la primera vez que se ve a ese
 * paciente: es **no-op** si el bucket ya está cargado (`loadedClients`) o si hay
 * un request en vuelo (`loadingClients`, dedupe). `refresh(clientId)` es la
 * salida explícita para forzar un re-fetch cuando se sospecha dato viejo.
 *
 * De ese bucket derivan `byBooking` (fichas de la reserva) e `historyFor`
 * (historial de consultas anteriores: todo lo que no es la reserva abierta).
 *
 * **Política de invalidación:** los parches locales de `create()`, `update()` y
 * `uploadImage()` son autoritativos — se aplican sobre el bucket del paciente y
 * **no** disparan un refetch automático. Si otro usuario cambió una ficha, el
 * dato se actualiza con `refresh(clientId)`.
 */
export const ClinicalRecordsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withMethods((store, recordsApi = inject(ClinicalRecordsApiService)) => {
    const byDateDesc = (a: ClinicalRecord, b: ClinicalRecord): number =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    /** Bucket de un paciente (`undefined` = todavía no se pidió su listado). */
    const bucketFor = (clientId: number): ClinicalRecord[] | undefined =>
      store.byClient()[clientId];

    /** Listado cacheado del paciente (`[]` mientras no se haya cargado). */
    const cachedRecords = (clientId: number): ClinicalRecord[] => bucketFor(clientId) ?? [];

    /** Escribe el bucket de un paciente sin tocar los de los demás. */
    const setBucket = (clientId: number, records: ClinicalRecord[]): void =>
      patchState(store, {
        byClient: { ...store.byClient(), [clientId]: records },
      });

    /**
     * Reemplaza un registro **solo** en el bucket del paciente que la API
     * devuelve en el registro actualizado (`client_id`). Si ese bucket no está
     * cargado no hay nada coherente que parchear y el estado queda intacto.
     */
    const replaceRecord = (updated: ClinicalRecord): void => {
      const bucket = bucketFor(updated.client_id);
      if (!bucket) return;
      setBucket(
        updated.client_id,
        bucket.map((record) => (record.id === updated.id ? updated : record)),
      );
    };

    /** Dispara el GET del paciente y guarda el resultado en su bucket. */
    const fetchClient = (clientId: number): void => {
      patchState(store, {
        loadingClients: { ...store.loadingClients(), [clientId]: true },
        error: null,
      });
      recordsApi.getRecords({ client_id: clientId }).subscribe({
        next: (records) => {
          patchState(store, {
            byClient: { ...store.byClient(), [clientId]: records },
            loadedClients: { ...store.loadedClients(), [clientId]: true },
            loadingClients: { ...store.loadingClients(), [clientId]: false },
          });
        },
        error: (err: Error) => {
          patchState(store, {
            loadingClients: { ...store.loadingClients(), [clientId]: false },
            error: err.message ?? 'Error al cargar las fichas',
          });
        },
      });
    };

    return {
      /**
       * Carga el listado del paciente **una sola vez**. Es no-op cuando el
       * bucket ya está cargado o cuando ya hay un request en vuelo para ese
       * paciente (dos aperturas seguidas del diálogo = un único `GET`).
       */
      loadByClient(clientId: number): void {
        if (store.loadedClients()[clientId]) return;
        if (store.loadingClients()[clientId]) return;
        fetchClient(clientId);
      },

      /** Escape hatch: descarta la marca de cargado y vuelve a pedir el listado. */
      refresh(clientId: number): void {
        patchState(store, {
          loadedClients: { ...store.loadedClients(), [clientId]: false },
        });
        fetchClient(clientId);
      },

      /** Registros cacheados del paciente (`[]` mientras no se hayan cargado). */
      recordsFor(clientId: number): ClinicalRecord[] {
        return cachedRecords(clientId);
      },

      /** Fichas asociadas a una reserva del paciente, más recientes primero. */
      byBooking(clientId: number, bookingId: number | null): ClinicalRecord[] {
        return cachedRecords(clientId)
          .filter((r) => r.booking_id === bookingId)
          .sort(byDateDesc);
      },

      /** Historial de consultas anteriores: fichas del paciente en otras reservas. */
      historyFor(clientId: number, bookingId: number | null): ClinicalRecord[] {
        return cachedRecords(clientId)
          .filter((r) => r.booking_id !== bookingId)
          .sort(byDateDesc);
      },

      /**
       * Crea el registro en la API y lo antepone al bucket de su paciente. Si
       * ese bucket no está cargado solo se devuelve el registro: no se inventa
       * un listado parcial que después parezca "completo".
       */
      create(input: CreateClinicalRecordInput): Observable<ClinicalRecord> {
        const payload: CreateClinicalRecordPayload = {
          client_id: input.clientId,
          booking_id: input.bookingId ?? null,
          record_type_id: input.recordTypeId,
          values: input.values,
        };
        return recordsApi.createRecord(payload).pipe(
          tap((record) => {
            const bucket = bucketFor(input.clientId);
            if (!bucket) return;
            setBucket(input.clientId, [record, ...bucket]);
          }),
        );
      },

      /**
       * Actualiza los `values` de una ficha (`PATCH /clinical-records/{id}`) y
       * reemplaza ese registro en el bucket que la API indica con `client_id`.
       */
      update(id: number, values: Record<string, unknown>): Observable<ClinicalRecord> {
        return recordsApi.updateRecord(id, { values }).pipe(tap(replaceRecord));
      },

      /**
       * Sube la imagen de un campo `image` (`POST /clinical-records/{id}/image`)
       * y reemplaza el registro en el bucket del paciente, con la respuesta del
       * server que ya trae `images` actualizado (re-subir la misma `key`
       * reemplaza el archivo). No toca `values`: la clave de imagen la gestiona
       * el servidor.
       */
      uploadImage(id: number, key: string, file: File): Observable<ClinicalRecord> {
        return recordsApi.uploadImage(id, key, file).pipe(tap(replaceRecord));
      },
    };
  }),
);
