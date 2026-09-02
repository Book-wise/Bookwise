import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./features/auth/verify-email/verify-email.component').then(m => m.VerifyEmailComponent)
  },
  {
    path: 'onboarding',
    canActivate: [roleGuard(['admin'])],
    loadComponent: () => import('./features/admin/onboarding/onboarding.component').then(m => m.OnboardingComponent)
  },
  {
    path: 'admin',
    canActivate: [roleGuard(['admin']), onboardingGuard],
    loadComponent: () => import('./layouts/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'locations',
        loadComponent: () => import('./features/admin/locations/locations-list.component').then(m => m.LocationsListComponent)
      },
      {
        path: 'providers',
        loadComponent: () => import('./features/admin/providers/providers-list.component').then(m => m.ProvidersListComponent)
      },
      {
        path: 'calendar',
        loadComponent: () => import('./features/admin/calendar/full-calendar.component').then(m => m.FullCalendarComponent)
      },
      {
        path: 'clients',
        loadComponent: () => import('./features/admin/clients/clients-list.component').then(m => m.ClientsListComponent)
      },
      {
        path: 'packs',
        loadComponent: () => import('./features/admin/packs/packs-list.component').then(m => m.PacksListComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/admin/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'roles',
        loadComponent: () => import('./features/admin/roles/roles.component').then(m => m.RolesComponent)
      }
    ]
  },
  {
    path: 'provider',
    canActivate: [roleGuard(['provider'])],
    loadComponent: () => import('./layouts/provider-layout/provider-layout.component').then(m => m.ProviderLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/provider/calendar/provider-calendar.component').then(m => m.ProviderCalendarComponent)
      },
      {
        path: 'availability',
        loadComponent: () => import('./features/provider/availability/provider-availability.component').then(m => m.ProviderAvailabilityComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];