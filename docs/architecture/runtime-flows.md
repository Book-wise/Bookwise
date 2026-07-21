# Flujos De Ejecucion

## Inicio de aplicacion

`src/main.ts` arranca `App` con `appConfig`. `appConfig` registra rutas, HTTP client con interceptor, PrimeNG, animaciones y servicios globales.

## Login y sesion

1. `LoginComponent` envia credenciales con `ApiService.login()`.
2. `AuthService.login()` guarda token y usuario.
3. `AuthService` redirige a `/admin` si el rol es admin o `/provider` si es provider.
4. `authInterceptor` agrega Bearer token a requests posteriores.
5. Si una respuesta HTTP es 401, el interceptor ejecuta logout.

Fuentes: `src/app/features/auth/login/login.component.ts`, `src/app/core/services/auth.service.ts`, `src/app/core/interceptors/auth.interceptor.ts`.

## Navegacion protegida

`roleGuard(['admin'])` protege `/admin`; `roleGuard(['provider'])` protege `/provider`. Si no hay usuario, redirige a login; si el rol no coincide, redirige al dashboard del rol autenticado.

Fuente: `src/app/app.routes.ts` y `src/app/core/guards/role.guard.ts`.

## Calendario admin

1. Carga sedes con `getLocations()`.
2. Selecciona la primera sede disponible y carga providers por `location_id`.
3. FullCalendar solicita eventos por rango visible.
4. El componente llama en paralelo `getBookings()` y `getBlockedSlots()`.
5. Transforma reservas y bloqueos a eventos de calendario.
6. Click en reserva abre detalle; click en bloqueo abre editor de bloqueo; seleccion de slot permite reserva o bloqueo.

Fuente: `src/app/features/admin/calendar/full-calendar.component.ts`.

## Calendario provider

El calendario provider replica el flujo del calendario admin, pero filtra con `provider_id` y primera `location_id` del usuario autenticado. Fuente: `src/app/features/provider/calendar/provider-calendar.component.ts`.

## Creacion o edicion de reserva

1. El dialogo carga clients, services, packs, providers y locations.
2. Clients, services, packs y locations pueden venir de `DataCacheService`.
3. El usuario selecciona paciente, sede, provider, servicio o pack, fecha/hora, estado y datos adicionales.
4. Si se elige pack, envia `service_pack_id`; si se elige servicio, envia `service_id` y `price`.
5. Puede incluir repeticion.
6. Al guardar, notifica a `BookingUpdateService` para refrescar calendario.

Fuente: `src/app/features/admin/bookings/booking-form-dialog/booking-form-dialog.component.ts`.

## Bloqueo de horario

1. El dialogo carga sedes y providers.
2. El usuario define alcance por sede o provider, fechas, motivo y repeticion opcional.
3. El frontend valida que fin sea posterior a inicio.
4. Crea, actualiza o elimina bloqueos via `ApiService`.
5. El calendario se refresca via evento `onBlocked`.

Fuente: `src/app/features/admin/bookings/block-time-dialog/block-time-dialog.component.ts`.

## Pago de reserva

1. `PaymentDetailDialogComponent` abre tabs de reserva/pago.
2. `PaymentTabComponent` usa `booking.payment.id` para cargar venta.
3. Si no hay venta, permite crear cobro con `createSale({ booking_id })`.
4. Permite registrar abonos con `createTransaction()`.

Fuente: `src/app/features/admin/bookings/payment-detail/payment-tab.component.ts`.

