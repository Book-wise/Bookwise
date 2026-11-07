/**
 * Dominio clínico (ficha médica).
 *
 * El backend **todavía no** expone `clinical_record_types` ni `clinical_records`
 * (contrato en `odd/tasks/ficha-medica.md`, F4). Estos tipos describen ese
 * contrato para que la pestaña Ficha y el catálogo de Configuraciones tengan
 * una forma estable cuando el endpoint exista. Mientras tanto, los consumidores
 * de solo-lectura reciben colecciones vacías y el catálogo se edita en memoria
 * (ver `clinical-record-types.store.ts`): no se inventan datos del servidor.
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
  /** Solo para `type === 'select'`: opciones separadas por coma. */
  options?: string[];
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

/** Registro clínico ya creado, asociado a una reserva y a un paciente. */
export interface ClinicalRecord {
  id: number;
  record_type_id: number;
  /** Nombre del tipo tal como se muestra (mayúsculas en la tarjeta). */
  title: string;
  /** ISO-8601 de creación del registro. */
  created_at: string;
  /** Quién firmó/registró la ficha. El backend lo sirve denormalizado (contrato L8). */
  author_name?: string | null;
  /** Id del usuario de CORE que la creó; se usa para permisos, no para mostrar. */
  created_by?: number | null;
  booking_id?: number | null;
}
