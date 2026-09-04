import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env/environment';
import { AuthMeData, AuthMeResponse, AuthResponse, ChangePasswordData, LoginCredentials, RegisterData, RegisterResponse, ResetPasswordData, User } from '@models';

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

  /** POST /auth/switch-tenant (Bearer) → { user } — cambia el negocio activo (admin_general). */
  switchTenant(tenantId: number): Observable<AuthMeData> {
    return this.http
      .post<AuthMeResponse>(`${this.baseUrl}/auth/switch-tenant`, { tenant_id: tenantId })
      .pipe(map((r) => r.user));
  }

  /** POST /auth/password (Bearer) → { message } — cambio de contraseña del usuario autenticado. */
  changePassword(data: ChangePasswordData): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/auth/password`, data);
  }

  /** POST /auth/forgot-password (público, sin auth) { email } → 200 { message }
   *  — respuesta genérica (anti-enumeración): siempre 200 aunque el email no exista. */
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/auth/forgot-password`, { email });
  }

  /** POST /auth/reset-password (público) { token, password, password_confirmation }
   *  → 200 { message } | 400 { error: 'invalid_token' | 'token_expired' | 'token_already_used' } | 422 { message, errors }. */
  resetPassword(data: ResetPasswordData): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/auth/reset-password`, data);
  }

  /** PATCH /auth/me (Bearer) → { user } — actualiza el perfil del usuario autenticado (hoy solo phone). */
  updateProfile(data: { phone: string }): Observable<AuthMeResponse> {
    return this.http.patch<AuthMeResponse>(`${this.baseUrl}/auth/me`, data);
  }

  /** POST /auth/me/avatar (Bearer, multipart) → { user } — sube el avatar del usuario autenticado.
   *  El backend genera un thumbnail optimizado (WebP), nunca persiste el original. */
  uploadAvatar(file: File): Observable<AuthMeResponse> {
    const form = new FormData();
    form.append('avatar', file);
    return this.http.post<AuthMeResponse>(`${this.baseUrl}/auth/me/avatar`, form);
  }
}
