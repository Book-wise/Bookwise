import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, tap } from 'rxjs';
import { AuthMeData, AuthSwitchResponse, User, UserRole } from '@models';
import { AuthApiService } from './api/auth-api.service';
import { CalendarPrefsService } from './calendar-prefs.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY  = 'auth_user';

  private readonly authApi = inject(AuthApiService);
  private readonly calendarPrefs = inject(CalendarPrefsService);

  private _token = signal<string | null>(this.getStoredToken());
  private _user  = signal<User | null>(this.getStoredUser());
  private _me    = signal<AuthMeData | null>(null);
  private _meLoaded = signal(false);
  private _abilities = signal<string[]>([]);

  readonly token           = computed(() => this._token());
  readonly user            = computed(() => this._user());
  readonly me              = computed(() => this._me());
  readonly meLoaded        = computed(() => this._meLoaded());
  readonly abilities       = computed(() => this._abilities());
  readonly isAuthenticated = computed(() => !!this._token());
  readonly userRole        = computed(() => this._user()?.role ?? null);
  readonly isAdmin         = computed(() => this._user()?.role === 'admin');
  readonly isProvider      = computed(() => this._user()?.role === 'provider');
  /** Roles de NEGOCIO (multi-tenant) — expuestos por el backend en /auth/me. */
  readonly isAdminGeneral  = computed(() => this._me()?.is_admin_general ?? false);
  readonly isAdminLocal    = computed(() => this._me()?.is_admin_local ?? false);
  /** True cuando el usuario debe completar onboarding: sin negocio o negocio pendiente
   *  (name vacío). El backend crea el tenant en el registro, así que NO se usa
   *  `onboarding_complete` (siempre true cuando hay tenant_id). */
  readonly needsOnboarding = computed(() => {
    const me = this._me();
    return !me || !me.business || !(me.business.name?.trim());
  });

  constructor(private router: Router) {}

  getToken(): string | null {
    return this._token();
  }

  /** Token persisted in `localStorage` — the cross-tab source of truth. The
   *  interceptor compares it against the token a failed request actually used
   *  to tell a rotated (stale) token apart from a genuinely expired session. */
  getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /** Re-syncs the in-memory token from `localStorage` after another tab rotated
   *  it. Does NOT write to `localStorage` — the persisted value wins. */
  syncTokenFromStorage(): void {
    this._token.set(this.getStoredToken());
  }

  private getStoredUser(): User | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(this.USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  setToken(token: string): void {
    this._token.set(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.TOKEN_KEY, token);
    }
  }

  setUser(user: User): void {
    this._user.set(user);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }

  login(token: string, user: User): void {
    this.setToken(token);
    this.setUser(user);
    this.navigateByRole(user.role);
  }

  /**
   * GET /auth/me con caché. La primera llamada (p. ej. desde `onboardingGuard`)
   * cachea el resultado para que deep-links a /admin no re-peticionen. `force`
   * vuelve a consultar el backend (útil tras crear el negocio).
   */
  loadMe(force = false): Observable<AuthMeData> {
    if (!force && this._meLoaded()) {
      return of(this._me() as AuthMeData);
    }
    return this.authApi.getMe().pipe(
      tap((me) => {
        this._me.set(me);
        this._meLoaded.set(true);
      }),
    );
  }

  /** Actualiza el caché de /auth/me (p. ej. tras switch-tenant o datos locales). */
  setMe(me: AuthMeData): void {
    this._me.set(me);
    this._meLoaded.set(true);
  }

  /** Cambia el negocio activo (admin_general) y adopta la sesión rotada.
   *  El backend revoca el token viejo y devuelve uno nuevo, así que hay que
   *  reemplazar el token persistido; actualiza `user()` vía `setUser` — nunca
   *  `login()`, que navegaría. */
  switchTenant(tenantId: number): Observable<AuthSwitchResponse> {
    return this.authApi.switchTenant(tenantId).pipe(
      tap((res) => {
        this.setToken(res.token);
        this._me.set(res.user);
        this._meLoaded.set(true);
        this.setUser(this.toUser(res.user));
        this._abilities.set(res.abilities ?? []);
      }),
    );
  }

  /** True when the backend granted the given ability on the active session. */
  hasAbility(ability: string): boolean {
    return this._abilities().includes(ability);
  }

  /** Mapea el payload de /auth/me a la forma persistida `User`. */
  private toUser(me: AuthMeData): User {
    return {
      id: me.id,
      email: me.email,
      name: me.name,
      phone: me.phone ?? undefined,
      avatar_url: me.avatar_url ?? null,
      role: me.role,
      provider_id: me.provider_id ?? null,
      tenant_id: me.tenant_id,
      email_verified_at: me.email_verified_at,
      onboarding_complete: me.onboarding_complete,
      business: me.business,
    };
  }

  private navigateByRole(role: UserRole): void {
    if (role === 'admin') {
      this.router.navigate(['/admin']);
    } else if (role === 'provider') {
      this.router.navigate(['/provider']);
    } else {
      this.router.navigate(['/']);
    }
  }

  logout(): void {
    const userId = this._user()?.id ?? null;
    this._token.set(null);
    this._user.set(null);
    this._me.set(null);
    this._meLoaded.set(false);
    this._abilities.set([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    // Limpia TODAS las preferencias tenant-scoped del usuario (sucursal +
    // profesional, incl. la clave legacy user-only) para que no queden restos
    // del usuario anterior en el mismo navegador.
    this.calendarPrefs.clearForUser(userId);
    this.router.navigate(['/login']);
  }
}
