import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type { ClinicalRecord } from '@models';

/**
 * Store de dominio de los **registros clínicos** creados en la sesión.
 *
 * El backend todavía no expone `clinical_records` (contrato F4 en
 * `odd/tasks/ficha-medica.md`), así que este store guarda en memoria los
 * registros que el profesional crea desde la pestaña Ficha del diálogo de
 * reserva. Nada se persiste entre visitas: cada registro nace con
 * `pendingSync: true` para no mentir sobre la persistencia.
 *
 * **Se reemplaza por el contrato real sin cambiar la UI:** cuando exista el
 * endpoint, `create()` hará el POST y `byBooking()`/`byClient()` leerán del
 * API; la forma de los datos ya respeta el contrato (`client_id`,
 * `booking_id`, `record_type_id`, `values`, `created_at`, `created_by`).
 */

/** Registro clínico de sesión: extiende `ClinicalRecord` con lo que la API guardará después. */
export interface SessionClinicalRecord extends ClinicalRecord {
  client_id: number | null;
  values: Record<string, unknown>;
  pendingSync: true;
}

export interface CreateClinicalRecordInput {
  recordTypeId: number;
  title: string;
  bookingId?: number | null;
  clientId?: number | null;
  values: Record<string, unknown>;
  authorName?: string | null;
}

interface ClinicalRecordsState {
  records: SessionClinicalRecord[];
}

const initialState: ClinicalRecordsState = {
  records: [],
};

/** Ids locales hasta que el backend los genere. */
let nextRecordId = 1;

export const ClinicalRecordsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withMethods((store) => {
    const byDateDesc = (a: SessionClinicalRecord, b: SessionClinicalRecord): number =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    return {
      /** Crea un registro de sesión marcado `pendingSync` (aún sin API). */
      create(input: CreateClinicalRecordInput): void {
        const record: SessionClinicalRecord = {
          id: nextRecordId++,
          record_type_id: input.recordTypeId,
          title: input.title,
          created_at: new Date().toISOString(),
          author_name: input.authorName ?? null,
          booking_id: input.bookingId ?? null,
          client_id: input.clientId ?? null,
          values: input.values,
          pendingSync: true,
        };
        patchState(store, { records: [...store.records(), record] });
      },

      /** Registros asociados a una reserva, más recientes primero. */
      byBooking(bookingId: number | null): SessionClinicalRecord[] {
        return store
          .records()
          .filter((r) => r.booking_id === bookingId)
          .sort(byDateDesc);
      },

      /** Registros asociados a un paciente, más recientes primero. */
      byClient(clientId: number | null): SessionClinicalRecord[] {
        return store
          .records()
          .filter((r) => r.client_id === clientId)
          .sort(byDateDesc);
      },
    };
  }),
);
