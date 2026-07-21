# Reglas De Negocio Observadas

## Confirmadas por codigo

- Solo existen dos roles frontend: `admin` y `provider`. Fuente: `UserRole` en `src/app/core/models/index.ts`.
- La ruta `/admin` exige rol `admin` y `/provider` exige rol `provider`. Fuente: `src/app/app.routes.ts` y `src/app/core/guards/role.guard.ts`.
- Si no hay rol autenticado, el guard redirige a `/login`. Fuente: `src/app/core/guards/role.guard.ts`.
- Si un usuario autenticado intenta entrar a una ruta de otro rol, se redirige al dashboard de su rol. Fuente: `src/app/core/guards/role.guard.ts`.
- El token se envia como `Authorization: Bearer <token>` cuando existe. Fuente: `src/app/core/interceptors/auth.interceptor.ts`.
- Ante HTTP 401, el interceptor ejecuta logout y redirige a login via `AuthService.logout()`. Fuente: `src/app/core/interceptors/auth.interceptor.ts` y `src/app/core/services/auth.service.ts`.
- Una reserva nueva requiere cliente, servicio o pack, fecha/hora y sede para ser guardable desde el formulario principal. Fuente: `isFormValid()` en `src/app/features/admin/bookings/booking-form-dialog/booking-form-dialog.component.ts`.
- Para reservas con pack, el frontend envia `service_pack_id` y omite `price`; para reservas con servicio, envia `service_id` y `price`. Fuente: `onSave()` en `src/app/features/admin/bookings/booking-form-dialog/booking-form-dialog.component.ts`.
- El formulario de bloqueo no permite guardar si la fecha/hora de fin es menor o igual a la de inicio. Fuente: `endBeforeStart` y `block()` en `src/app/features/admin/bookings/block-time-dialog/block-time-dialog.component.ts`.
- El alta rapida de cliente valida campos requeridos por el formulario Angular y RUT solo cuando el valor no esta vacio. Fuente: `booking-form-dialog.component.spec.ts` y `rutValidator()` en `src/app/shared/validators/rut.validator.ts`.
- La deteccion de pacientes similares se basa en email exacto case-insensitive o telefono normalizado; nombre solo no califica. Fuente: `src/app/shared/utils/client-similarity.util.ts` y su spec.
- La disponibilidad de provider se guarda contra un mock en memoria, no contra endpoint real. Fuente: `src/app/core/services/availability.service.ts`.

## Contratos comentados en tipos

Estos puntos estan escritos como comentarios en modelos TypeScript. Son evidencia de expectativa del frontend, pero no validan el backend real:

- `CreateBooking`: exactamente uno entre `service_id` y `service_pack_id`; el backend devolveria 422 si ambos o ninguno se envian. Fuente: `src/app/core/models/requests/blocked-slots.ts`.
- `CreateSaleRequest`: exactamente uno entre `booking_id` y `client_pack_id`; el backend devolveria 422 si ambos o ninguno se envian, y `sale_already_exists` si ya existe venta. Fuente: `src/app/core/models/requests/sales.ts`.
- `CreateTransactionRequest`: si el monto supera el saldo, el backend devolveria `amount_exceeds_remaining`. Fuente: `src/app/core/models/requests/sales.ts`.

## Inferencias razonables

- Los providers pueden estar asociados a una sede y los filtros de provider dependen de `location_id`, porque `getProviders({ location_id })` se usa en calendario y formularios.
- Las reservas y bloqueos comparten la misma vista de calendario, porque ambos se transforman a eventos de FullCalendar en `FullCalendarComponent` y `ProviderCalendarComponent`.

## Desconocido o no verificable

- Reglas reales de colision de agenda.
- Reglas reales de consumo de sesiones de packs.
- Validaciones backend de precios, estados y pagos.
- Significado legal o operativo de cada estado de reserva.

