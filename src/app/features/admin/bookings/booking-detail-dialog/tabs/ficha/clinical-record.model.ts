/**
 * Modelo mínimo de la ficha médica.
 *
 * El backend **no** tiene dominio clínico todavía (no existen
 * `clinical_record_types` ni `clinical_records`). Estos tipos describen el
 * contrato que se pidió, para que la pestaña Ficha tenga una forma estable
 * cuando el endpoint exista. Mientras tanto el componente recibe colecciones
 * vacías desde su padre y muestra estados vacíos: no se inventan datos.
 */

/** Tipo de ficha configurable por negocio (pantalla de Configuraciones). */
export interface ClinicalRecordType {
  id: number;
  name: string;
  active: boolean;
  sort_order?: number;
}

/** Registro clínico ya creado, asociado a una reserva y a un paciente. */
export interface ClinicalRecord {
  id: number;
  record_type_id: number;
  /** Nombre del tipo tal como se muestra (mayúsculas en la tarjeta). */
  title: string;
  /** ISO-8601 de creación del registro. */
  created_at: string;
  /** Quién firmó/registró la ficha. */
  author_name?: string | null;
  booking_id?: number | null;
}
