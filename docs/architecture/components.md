# Componentes Y Servicios

## Core

- `ApiService` (`src/app/core/services/api.service.ts`): concentra llamadas HTTP a locations, services, packs, slots disponibles, bloqueos, auth, providers, bookings, clients, sales, transactions y client packs.
- `AuthService` (`src/app/core/services/auth.service.ts`): persiste token/usuario, expone signals de sesion y redirige por rol.
- `authInterceptor` (`src/app/core/interceptors/auth.interceptor.ts`): agrega Bearer token y maneja 401.
- `roleGuard` (`src/app/core/guards/role.guard.ts`): protege rutas por rol.
- `DataCacheService` (`src/app/core/services/data-cache.service.ts`): cache en memoria con TTL para clients, services, packs, providers y locations.
- `HttpErrorService` (`src/app/core/services/http-error.service.ts`): traduce errores HTTP/API a toasts y detecta estado offline/online.
- `LanguageService` (`src/app/core/services/language.service.ts`): idioma `es | en` persistido en `localStorage`.
- `ThemeService` (`src/app/core/services/theme.service.ts`): cambia presets Aura/Lara/Nora de PrimeNG.
- `AvailabilityService` (`src/app/core/services/availability.service.ts`): mezcla endpoint `available_slots` con mocks para disponibilidad de provider.

## Layouts

- `AdminLayoutComponent`: menu lateral responsive, dark mode, selector de tema, selector de idioma y logout.
- `ProviderLayoutComponent`: menubar con agenda, disponibilidad, idioma y logout.

## Features admin

- Dashboard: carga locations, providers y bookings; muestra metricas y graficos locales.
- Locations: tabla de ubicaciones.
- Providers: tabla de profesionales.
- Calendar: FullCalendar con filtros por sede, provider y estado; muestra reservas y bloqueos; abre dialogos de reserva, bloqueo y pago.
- Clients: tabla con busqueda debounce.
- Packs: tabla de packs.
- Booking dialogs: creacion/edicion de reservas, bloqueo de horario, detalle de pago, tabs de reserva y pago.

## Features provider

- Calendar: calendario filtrado por `provider_id` y primera `location_id` del usuario autenticado.
- Availability: gestion de disponibilidad semanal usando `AvailabilityService`, actualmente con mock en memoria para lectura/escritura de disponibilidad de provider.

## Shared

- `PhoneInputComponent`: ControlValueAccessor sobre `intl-tel-input`.
- `PatientCardComponent`: ficha resumida de paciente con packs, sesiones, prepago y reservas recientes.
- `ToastService` y `ToastModalComponent`: modal/toast compartido.
- `BwCurrencyPipe` y `currency.config.ts`: formato CLP.
- `rut.validator.ts` y `rut.directive.ts`: validacion de RUT.
- `client-similarity.util.ts`: comparacion de pacientes por email o telefono.

