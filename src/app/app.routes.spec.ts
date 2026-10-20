import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { ABILITIES } from '@shared/config/abilities.config';

/**
 * Contrato de la frontera de navegación (S1/S2 de `odd/tasks/fase-b-rbac-cierre.md`):
 * cada ruta admin gateada por capacidad DEBE declarar `abilityGuard` con el
 * permission key de `ABILITIES`, y el guard DEBE sacar al usuario sin el key.
 */
function adminChildren() {
  const admin = routes.find((r) => r.path === 'admin');
  return admin?.children ?? [];
}

function guardFor(path: string): CanActivateFn | undefined {
  const child = adminChildren().find((r) => r.path === path);
  const guards = child?.canActivate ?? [];
  return guards[0] as CanActivateFn | undefined;
}

const GATED: Array<[path: string, key: string]> = [
  ['locations', ABILITIES.locationsView],
  ['providers', ABILITIES.providersView],
  ['calendar', ABILITIES.bookingsView],
  ['clients', ABILITIES.clientsView],
  ['roles', ABILITIES.rolesView],
  ['configuraciones', ABILITIES.settingsView],
];

function runGuard(
  guard: CanActivateFn,
  auth: { isAuthenticated: boolean; permissions: string[]; role: 'admin' | 'provider' | 'client' },
): { allowed: unknown; navigatedTo: unknown[] | undefined } {
  const navigate = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AuthService,
        useValue: {
          isAuthenticated: () => auth.isAuthenticated,
          hasPermission: (key: string) => auth.permissions.includes(key),
          userRole: () => auth.role,
        },
      },
      { provide: Router, useValue: { navigate } },
    ],
  });

  const allowed = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
  return { allowed, navigatedTo: navigate.mock.calls[0]?.[0] };
}

describe('admin routes — ability guards', () => {
  it.each(GATED)('%s declara un guard de capacidad', (path) => {
    expect(guardFor(path), `la ruta "${path}" no declara canActivate`).toBeTypeOf('function');
  });

  it.each(GATED)('%s permite entrar con su permission key', (path, key) => {
    const guard = guardFor(path);
    expect(guard).toBeTypeOf('function');

    const { allowed } = runGuard(guard as CanActivateFn, {
      isAuthenticated: true,
      permissions: [key],
      role: 'admin',
    });

    expect(allowed).toBe(true);
  });

  it.each(GATED)('%s expulsa al dashboard sin su permission key', (path) => {
    const guard = guardFor(path);
    expect(guard).toBeTypeOf('function');

    const { allowed, navigatedTo } = runGuard(guard as CanActivateFn, {
      isAuthenticated: true,
      permissions: [],
      role: 'admin',
    });

    expect(allowed).toBe(false);
    expect(navigatedTo).toEqual(['/admin']);
  });

  it.each(GATED)('%s manda a login sin sesión', (path) => {
    const guard = guardFor(path);
    expect(guard).toBeTypeOf('function');

    const { allowed, navigatedTo } = runGuard(guard as CanActivateFn, {
      isAuthenticated: false,
      permissions: [],
      role: 'admin',
    });

    expect(allowed).toBe(false);
    expect(navigatedTo).toEqual(['/login']);
  });
});
