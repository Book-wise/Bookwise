# Flujos De Usuario Observados

## Login

1. El usuario ingresa email y password.
2. El frontend llama `POST /auth/login`.
3. Guarda token y usuario.
4. Redirige por rol.

Fuente: `src/app/features/auth/login/login.component.ts`.

## Registro

1. El usuario ingresa nombre, email, telefono, password y confirmacion.
2. El frontend valida que password y confirmacion coincidan.
3. Llama `POST /register`.
4. Guarda sesion y redirige por rol.

Fuente: `src/app/features/auth/register/register.component.ts`.

## Crear reserva desde calendario

1. El usuario abre el calendario.
2. Click en boton o slot abre dialogo de reserva.
3. Selecciona paciente, sede, provider, servicio/pack, fecha/hora, estado y datos opcionales.
4. Puede crear paciente o servicio dentro del dialogo.
5. Guarda reserva via `POST /bookings`.
6. El calendario se refresca por `BookingUpdateService`.

Fuente: `src/app/features/admin/calendar/full-calendar.component.ts` y `src/app/features/admin/bookings/booking-form-dialog/booking-form-dialog.component.ts`.

## Editar reserva y pago

1. Click en una reserva abre detalle.
2. Desde detalle se puede abrir el dialogo con tabs.
3. En tab Reserva se editan horarios, provider, estado, notas y datos basicos del paciente.
4. En tab Pago se carga o crea venta y se registran abonos.

Fuentes:

- `src/app/features/admin/calendar/full-calendar.component.ts`
- `src/app/features/admin/bookings/payment-detail/reserva-tab.component.ts`
- `src/app/features/admin/bookings/payment-detail/payment-tab.component.ts`

## Bloquear horario

1. El usuario abre el dialogo de bloqueo desde boton o slot.
2. Define inicio, fin, motivo, sede o provider.
3. Puede configurar repeticion diaria, semanal o mensual.
4. Guarda bloqueo via `POST /blocked-slots`.

Fuente: `src/app/features/admin/bookings/block-time-dialog/block-time-dialog.component.ts`.

## Gestionar disponibilidad provider

1. Provider entra a `/provider/availability`.
2. Carga sedes desde API y disponibilidad desde `AvailabilityService`.
3. Agrega o elimina slots locales.
4. Guarda disponibilidad en mock en memoria.

Fuente: `src/app/features/provider/availability/provider-availability.component.ts` y `src/app/core/services/availability.service.ts`.

