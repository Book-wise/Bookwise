import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '@services/auth.service';

/**
 * Frontera DURA de navegación por permission key (matriz editable).
 *
 *   { path: 'roles', canActivate: [abilityGuard('roles.view')], ... }
 *
 * El usuario sin el key en el tenant activo es redirigido a su dashboard (o a
 * login si no hay sesión). El backend sigue siendo la autoridad final: este
 * guard es UX de navegación, no seguridad.
 *
 * @param permission permission key único del catálogo (dot-notated).
 */
export const abilityGuard = (permission: string): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }

    if (auth.hasPermission(permission)) {
      return true;
    }

    // Sin permiso → dashboard del rol actual (sin bucle: nunca apunta a sí mismo).
    const role = auth.userRole();
    if (role === 'admin') {
      router.navigate(['/admin']);
    } else if (role === 'provider') {
      router.navigate(['/provider']);
    } else {
      router.navigate(['/']);
    }
    return false;
  };
};
