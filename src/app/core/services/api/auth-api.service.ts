import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env/environment';
import { AuthMeData, AuthMeResponse, AuthResponse, ChangePasswordData, LoginCredentials, RegisterData, RegisterResponse, User } from '@models';

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

  /** PATCH /auth/verify-email (público) { token } → { message, user } */
  verifyEmail(token: string): Observable<{ message: string; user: User }> {
    return this.http.patch<{ message: string; user: User }>(
      `${this.baseUrl}/auth/verify-email`,
      { token },
    );
  }

  /** GET /auth/me (Bearer) → unwrap { user: AuthMeData } */
  getMe(): Observable<AuthMeData> {
    return this.http.get<AuthMeResponse>(`${this.baseUrl}/auth/me`).pipe(map((r) => r.user));
  }

  /** POST /auth/password (Bearer) → { message } — cambio de contraseña del usuario autenticado. */
  changePassword(data: ChangePasswordData): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/auth/password`, data);
  }

  /** PATCH /auth/me (Bearer) → { user } — actualiza el perfil del usuario autenticado (hoy solo phone). */
  updateProfile(data: { phone: string }): Observable<AuthMeResponse> {
    return this.http.patch<AuthMeResponse>(`${this.baseUrl}/auth/me`, data);
  }
}
