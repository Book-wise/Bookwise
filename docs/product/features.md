# Funcionalidades

## Confirmadas por rutas y componentes

### Autenticacion

- Login con email/password.
- Registro con nombre, email, telefono y password.
- Redireccion por rol.

Fuentes: `src/app/features/auth/login/login.component.ts`, `src/app/features/auth/register/register.component.ts`.

### Administracion

- Dashboard con conteos de sedes, profesionales, reservas del dia y reservas pendientes, mas graficos locales.
- Lista de ubicaciones.
- Lista de profesionales.
- Agenda admin con filtros por ubicacion, profesional y estados.
- Creacion y edicion de reservas.
- Bloqueo de horarios con repeticion.
- Gestion de detalle de reserva y pagos.
- Lista de clientes con busqueda.
- Lista de packs.

Fuentes: `src/app/app.routes.ts` y componentes bajo `src/app/features/admin`.

### Provider

- Agenda propia filtrada por provider y sede del usuario.
- Gestion de disponibilidad semanal en UI, usando mock en memoria para la disponibilidad de provider.

Fuentes: `src/app/features/provider/calendar/provider-calendar.component.ts`, `src/app/features/provider/availability/provider-availability.component.ts`, `src/app/core/services/availability.service.ts`.

### Pacientes/clientes

- Alta rapida de paciente desde reserva.
- Deteccion de pacientes similares por email o telefono.
- Validacion de RUT opcional.
- Ficha resumida con planes, sesiones, prepago y reservas recientes.
- Enlaces de WhatsApp cuando hay telefono.

Fuentes: `src/app/features/admin/bookings/booking-form-dialog/booking-form-dialog.component.ts`, `src/app/shared/components/patient-card/patient-card.component.ts`.

### Pagos

- Creacion de venta/cobro para una reserva.
- Registro de abonos/transacciones.
- Visualizacion de total, pagado, saldo, estado y detalle de items.

Fuente: `src/app/features/admin/bookings/payment-detail/payment-tab.component.ts`.

## Pantallas con contenido placeholder

En el detalle de pago/reserva, los tabs `recordatorios`, `ficha` e `historial` muestran estados vacios o "proximamente". Fuente: `src/app/features/admin/bookings/payment-detail/payment-detail-dialog.component.html`.

