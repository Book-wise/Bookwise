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
  /** Solo en el detalle: ruta API-relativa por campo `image` (o `null`). */
  images?: Record<string, string | null> | null;
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

/**
 * Normaliza el recurso a la forma del front: `title` sale de `record_type.name`.
 * `values` se copia tal cual (nunca lleva claves de campos `image`: esas las
 * gestiona el servidor y llegan en `images`, solo en el detalle).
 */
function toClinicalRecord(res: ClinicalRecordResource): ClinicalRecord {
  return {
    id: res.id,
    client_id: res.client_id,
    booking_id: res.booking_id ?? null,
    record_type_id: res.record_type_id,
    title: res.record_type?.name ?? '',
    values: res.values ?? {},
    images: res.images ?? null,
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

  /**
   * `POST /clinical-records/{id}/image` (multipart `key` + `file`): sube la
   * imagen de un campo `image` y devuelve la ficha completa ya con `images`.
   * Re-subir la misma `key` reemplaza el archivo en el servidor.
   */
  uploadImage(id: number, key: string, file: File): Observable<ClinicalRecord> {
    const form = new FormData();
    form.append('key', key);
    form.append('file', file);
    // Sin Content-Type manual: con FormData el navegador agrega el boundary.
    return this.http
      .post<ClinicalRecordResource>(`${this.baseUrl}/clinical-records/${id}/image`, form)
      .pipe(map(toClinicalRecord));
  }

  /**
   * `GET /clinical-records/{id}/image/{key}` → binario. La ruta **no** es
   * pública: el interceptor agrega el Bearer, por eso se pide como blob y se
   * pinta con un object URL (un `<img src>` directo no llevaría el header).
   */
  getImageBlob(id: number, key: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/clinical-records/${id}/image/${encodeURIComponent(key)}`, {
      responseType: 'blob',
    });
  }

  /** `GET /clinical-records/{id}/pdf`: PDF con las imágenes ya embebidas (L15). */
  getPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/clinical-records/${id}/pdf`, { responseType: 'blob' });
  }
}
