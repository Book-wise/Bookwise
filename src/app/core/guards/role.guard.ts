import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '@services/auth.service';
import { UserRole } from '@models';

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const userRole = authService.userRole();

    if (!userRole) {
      router.navigate(['/login']);
      return false;
    }

    if (!allowedRoles.includes(userRole)) {
      // Redirigir al dashboard correspondiente según rol
      if (userRole === 'admin') {
        router.navigate(['/admin']);
      } else if (userRole === 'provider') {
        router.navigate(['/provider']);
      } else {
        router.navigate(['/']);
      }
      return false;
    }

    return true;
  };
};