# Arquitectura General

## Confirmado por el repositorio

El proyecto es una aplicacion Angular standalone. No hay `NgModule` de aplicacion; `main.ts` inicia `App` con `appConfig`, y `app.config.ts` registra router, HTTP client, interceptor, animaciones, PrimeNG, mensajes y deteccion de cambios zoneless.

Archivos principales:

- `src/main.ts`
- `src/app/app.ts`
- `src/app/app.config.ts`
- `src/app/app.routes.ts`
- `angular.json`
- `package.json`

La estructura principal separa:

- `core`: servicios singleton, modelos, guards, interceptores e i18n.
- `features`: pantallas por dominio funcional.
- `layouts`: shells de navegacion para admin y provider.
- `shared`: componentes, pipes, validadores, constantes y utilidades reutilizables.
- `environments`: URLs de API por ambiente.
- `styles` y `assets`: estilos globales, tokens, imagenes y fuentes.

## Estado y comunicacion interna

El codigo usa Angular signals en servicios y componentes para estado local/reactivo. Ejemplos:

- `AuthService` expone `token`, `user`, `isAuthenticated`, `userRole`, `isAdmin`, `isProvider`.
- `FullCalendarComponent`, `ProviderCalendarComponent`, listas admin y dialogos usan `signal()` para loading y datos.
- `BookingUpdateService` usa `Subject<Booking>` para avisar actualizaciones de reservas entre dialogos y calendarios.
- `DataCacheService` implementa cache en memoria con TTL y stale-while-revalidate para recursos base.

## UI y librerias

La UI usa PrimeNG, PrimeIcons, FullCalendar, Chart.js e `intl-tel-input`. La configuracion global de PrimeNG usa preset Aura y traducciones de calendario en espanol en `src/app/app.config.ts`.

## Inferencias razonables

La aplicacion esta pensada como SPA servida por Angular CLI o build estatico. La URL de produccion para API es relativa (`/api/v1`), lo que sugiere que en produccion podria servirse detras del mismo host o proxy. Esto es una inferencia desde `src/environments/environment.prod.ts`.

## Desconocido o no verificable

No hay en el repositorio configuracion de servidor productivo, contenedores, pipeline CI/CD o infraestructura.

