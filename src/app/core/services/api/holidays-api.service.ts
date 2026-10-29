import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { Holiday } from '@models';
import { buildHttpParams } from './build-http-params';

/**
 * Feriados nacionales de Chile (`GET /holidays`).
 *
 * Params mutuamente excluyentes: `year` (atajo de año completo) **o**
 * `from`+`to` (rango inclusivo, máx. 2 años). Sin params → año actual. El
 * backend responde 422 si se manda `year` junto con `from`/`to`.
 */
@Injectable({ providedIn: 'root' })
export class HolidaysApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getHolidays(params: { year?: number; from?: string; to?: string } = {}): Observable<Holiday[]> {
    return this.http
      .get<{ data: Holiday[] }>(`${this.baseUrl}/holidays`, { params: buildHttpParams(params) })
      .pipe(map((res) => res.data));
  }
}
