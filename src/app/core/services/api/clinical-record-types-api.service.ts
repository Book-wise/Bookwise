import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import type { ClinicalRecordField, ClinicalRecordType } from '@models';
import { collectPaginatedPages } from './collect-paginated';

/** Cuerpo aceptado por `POST/PATCH /clinical-record-types`. */
export interface ClinicalRecordTypePayload {
  name?: string;
  description?: string | null;
  active?: boolean;
  sort_order?: number;
  /** En PATCH, `fields` reemplaza el set completo (igual que `variations[]`). */
  fields?: ClinicalRecordField[];
}

/** La API devuelve `options: null` para campos no-select; el front prefiere `undefined`. */
function normalizeType(type: ClinicalRecordType): ClinicalRecordType {
  return {
    ...type,
    fields: (type.fields ?? []).map((field) => ({ ...field, options: field.options ?? undefined })),
  };
}

/**
 * Catálogo de tipos de ficha (`/clinical-record-types`).
 *
 * `GET /clinical-record-types` emite `fields` completo por tipo siempre (columna
 * JSON de la misma fila, sin N+1), así que el listado sirve tanto para el
 * mantenedor de Configuraciones como para el desplegable «Agregar tipo de
 * ficha» de la pestaña Ficha.
 */
@Injectable({ providedIn: 'root' })
export class ClinicalRecordTypesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Listado completo (agrega todas las páginas). El backend ordena por `sort_order` asc, `name`. */
  getTypes(): Observable<ClinicalRecordType[]> {
    return collectPaginatedPages<ClinicalRecordType>(
      this.http,
      `${this.baseUrl}/clinical-record-types`,
    ).pipe(map((types) => types.map(normalizeType)));
  }

  createType(payload: ClinicalRecordTypePayload): Observable<ClinicalRecordType> {
    return this.http
      .post<ClinicalRecordType>(`${this.baseUrl}/clinical-record-types`, payload)
      .pipe(map(normalizeType));
  }

  updateType(id: number, payload: ClinicalRecordTypePayload): Observable<ClinicalRecordType> {
    return this.http
      .patch<ClinicalRecordType>(`${this.baseUrl}/clinical-record-types/${id}`, payload)
      .pipe(map(normalizeType));
  }
}
