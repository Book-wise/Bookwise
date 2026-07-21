# Inventario De Rutas Frontend

Fuente principal: `src/app/app.routes.ts`.

| Ruta | Componente/Layout | Proteccion |
| --- | --- | --- |
| `/` | Redirect a `/login` | Ninguna |
| `/login` | `LoginComponent` | Ninguna |
| `/register` | `RegisterComponent` | Ninguna |
| `/admin` | `AdminLayoutComponent` + `AdminDashboardComponent` | `roleGuard(['admin'])` |
| `/admin/locations` | `LocationsListComponent` | `roleGuard(['admin'])` heredado |
| `/admin/providers` | `ProvidersListComponent` | `roleGuard(['admin'])` heredado |
| `/admin/calendar` | `FullCalendarComponent` | `roleGuard(['admin'])` heredado |
| `/admin/clients` | `ClientsListComponent` | `roleGuard(['admin'])` heredado |
| `/admin/packs` | `PacksListComponent` | `roleGuard(['admin'])` heredado |
| `/provider` | `ProviderLayoutComponent` + `ProviderCalendarComponent` | `roleGuard(['provider'])` |
| `/provider/availability` | `ProviderAvailabilityComponent` | `roleGuard(['provider'])` heredado |
| `**` | Redirect a `/login` | Ninguna |

