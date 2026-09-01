import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Business, CreateBusinessData, CreateBusinessResponse } from '@models';

@Injectable({ providedIn: 'root' })
export class BusinessesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** GET /businesses (Bearer, email verificado) → unwrap { data: Business | null } */
  getBusiness(): Observable<Business | null> {
    return this.http
      .get<{ data: Business | null }>(`${this.baseUrl}/businesses`)
      .pipe(map((r) => r.data));
  }

  /** POST /businesses (Bearer) → 201 { data: { business }, user } */
  createBusiness(data: CreateBusinessData): Observable<CreateBusinessResponse> {
    return this.http.post<CreateBusinessResponse>(`${this.baseUrl}/businesses`, data);
  }
}
