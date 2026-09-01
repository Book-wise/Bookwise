import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env/environment';
import { AuthMeData, AuthMeResponse, AuthResponse, LoginCredentials, RegisterData, RegisterResponse } from '@models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, credentials);
  }

  register(data: RegisterData): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.baseUrl}/auth/register`, data);
  }

  /** PATCH /auth/verify-email (público) { token } → { data: { email_verified_at } } */
  verifyEmail(token: string): Observable<{ data: { email_verified_at: string } }> {
    return this.http.patch<{ data: { email_verified_at: string } }>(
      `${this.baseUrl}/auth/verify-email`,
      { token },
    );
  }

  /** GET /auth/me (Bearer) → unwrap { data: AuthMeData } */
  getMe(): Observable<AuthMeData> {
    return this.http.get<AuthMeResponse>(`${this.baseUrl}/auth/me`).pipe(map((r) => r.data));
  }
}
