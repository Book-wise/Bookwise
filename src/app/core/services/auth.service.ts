import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { User, UserRole } from '@models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY  = 'auth_user';

  private _token = signal<string | null>(this.getStoredToken());
  private _user  = signal<User | null>(this.getStoredUser());

  readonly token           = computed(() => this._token());
  readonly user            = computed(() => this._user());
  readonly isAuthenticated = computed(() => !!this._token());
  readonly userRole        = computed(() => this._user()?.role ?? null);
  readonly isAdmin         = computed(() => this._user()?.role === 'admin');
  readonly isProvider      = computed(() => this._user()?.role === 'provider');

  constructor(private router: Router) {}

  getToken(): string | null {
    return this._token();
  }

  private getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
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
    this._token.set(null);
    this._user.set(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    this.router.navigate(['/login']);
  }
}
