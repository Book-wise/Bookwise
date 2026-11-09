/**
 * Dominio clínico (ficha médica).
 *
 * Contrato confirmado en `docs/clinical-records-contract.md` (backend
 * `origin/develop` de Bookwise-API, `79ef31d`). La API devuelve `fields`
 * siempre en el listado de tipos y `record_type` embebido en cada ficha; el
 * cliente normaliza esas formas en los `*ApiService` (ver
 * `@services/api/clinical-record-*.service.ts`).
 */

/** Tipo de dato de un campo de ficha (mapea el desplegable del constructor). */
export type ClinicalRecordFieldType = 'text' | 'longtext' | 'number' | 'select' | 'date';

/** Un campo configurable de un tipo de ficha. */
export interface ClinicalRecordField {
  /** Identificador estable (slug interno); no cambia al renombrar el label. */
  key: string;
  label: string;
  type: ClinicalRecordFieldType;
  required: boolean;
  /** Solo para `type === 'select'`. La API devuelve `null` para el resto. */
  options?: string[] | null;
}

/** Tipo de ficha configurable por negocio (pantalla de Configuraciones). */
export interface ClinicalRecordType {
  id: number;
  name: string;
  /** Texto corto que se muestra bajo el título en la ficha. */
  description?: string | null;
  active: boolean;
  sort_order?: number;
  fields: ClinicalRecordField[];
}

/** Registro clínico ya creado, asociado a un paciente y (opcional) a una reserva. */
export interface ClinicalRecord {
  id: number;
  client_id: number;
  record_type_id: number;
  /** Nombre del tipo tal como se muestra (mayúsculas en la tarjeta). */
  title: string;
  /** Valores capturados por campo (`key` → valor). */
  values: Record<string, unknown>;
  /** ISO-8601 de creación del registro. */
  created_at: string;
  /** Quién firmó/registró la ficha. El backend lo sirve denormalizado (contrato L8). */
  author_name?: string | null;
  /** Id del usuario de CORE que la creó; se usa para permisos, no para mostrar. */
  created_by?: number | null;
  booking_id?: number | null;
}
