import { Routes } from '@angular/router';

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
    path: 'admin',
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
      }
    ]
  },
  {
    path: 'provider',
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