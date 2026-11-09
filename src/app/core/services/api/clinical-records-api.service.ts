import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import type { ClinicalRecord } from '@models';
import { collectPaginatedPages } from './collect-paginated';

/** Shape cruda del recurso que devuelve la API (con `record_type` embebido). */
interface ClinicalRecordResource {
  id: number;
  client_id: number;
  booking_id: number | null;
  record_type_id: number;
  values: Record<string, unknown>;
  created_by: number | null;
  author_name: string | null;
  created_at: string;
  record_type?: { name?: string } | null;
}

/** Filtros combinables con AND de `GET /clinical-records`. */
export type GetClinicalRecordsParams = {
  client_id?: number;
  booking_id?: number;
  record_type_id?: number;
};

/** `POST /clinical-records`: `client_id` y `record_type_id` obligatorios. */
export interface CreateClinicalRecordPayload {
  client_id: number;
  booking_id: number | null;
  record_type_id: number;
  values: Record<string, unknown>;
}

/** `PATCH /clinical-records`: `values`, si viene, REEMPLAZA el mapa completo. */
export interface UpdateClinicalRecordPayload {
  booking_id?: number | null;
  record_type_id?: number;
  values?: Record<string, unknown>;
}

/** Normaliza el recurso a la forma del front: `title` sale de `record_type.name`. */
function toClinicalRecord(res: ClinicalRecordResource): ClinicalRecord {
  return {
    id: res.id,
    client_id: res.client_id,
    booking_id: res.booking_id ?? null,
    record_type_id: res.record_type_id,
    title: res.record_type?.name ?? '',
    values: res.values ?? {},
    created_at: res.created_at,
    author_name: res.author_name ?? null,
    created_by: res.created_by ?? null,
  };
}

/**
 * Fichas clínicas (`/clinical-records`). La tarjeta de la pestaña Ficha muestra
 * el **nombre del tipo** (mayúsculas) y quién la registró (`author_name`, ya
 * resuelto por el backend vía `created_by` → `users` de CORE).
 */
@Injectable({ providedIn: 'root' })
export class ClinicalRecordsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getRecords(params: GetClinicalRecordsParams): Observable<ClinicalRecord[]> {
    return collectPaginatedPages<ClinicalRecordResource>(
      this.http,
      `${this.baseUrl}/clinical-records`,
      params,
    ).pipe(map((records) => records.map(toClinicalRecord)));
  }

  createRecord(payload: CreateClinicalRecordPayload): Observable<ClinicalRecord> {
    return this.http
      .post<ClinicalRecordResource>(`${this.baseUrl}/clinical-records`, payload)
      .pipe(map(toClinicalRecord));
  }

  updateRecord(id: number, payload: UpdateClinicalRecordPayload): Observable<ClinicalRecord> {
    return this.http
      .patch<ClinicalRecordResource>(`${this.baseUrl}/clinical-records/${id}`, payload)
      .pipe(map(toClinicalRecord));
  }

  deleteRecord(id: number): Observable<unknown> {
    return this.http.delete<unknown>(`${this.baseUrl}/clinical-records/${id}`);
  }
}
