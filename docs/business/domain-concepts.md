# Conceptos De Dominio

## Usuarios y roles

Confirmado por `src/app/core/models/index.ts`, el usuario autenticado tiene `role: 'admin' | 'provider'`, `provider_id` opcional y `location_ids` opcional. `AuthService` persiste `auth_token` y `auth_user` en `localStorage` y redirige a `/admin` o `/provider` segun rol.

## Reserva

La reserva representa una atencion agendada con cliente, servicio o pack, provider, sede, estado, hora de inicio y fin, precio, pago y notas. Los campos estan definidos en `Booking` dentro de `src/app/core/models/index.ts` y en la respuesta mas detallada de `src/app/core/models/responses/bookings.ts`.

## Cliente o paciente

El modelo `Client` incluye nombre, email, telefono, RUT, genero, `wc_customer_id`, estado activo y atributos personalizados. La UI usa "Paciente" en el formulario de reserva y en `PatientCardComponent`; el modelo y endpoints usan `clients`.

## Provider o profesional

`Provider` incluye nombre, email, telefono, estado activo, sede asociada y servicios. Las pantallas admin listan providers y el calendario admin permite filtrar por provider.

## Sede o ubicacion

`Location` incluye nombre, direccion, ciudad, zona horaria y estado activo. El calendario admin selecciona una sede y recarga providers asociados.

## Servicio

`Service` incluye nombre, descripcion, duracion, precio, estado activo y configuracion opcional de slots. El formulario de reserva permite crear servicios rapidamente mediante `ApiService.createService()`.

## Pack

`ServicePack` representa un paquete de sesiones de un servicio. `ClientPack` representa el pack asignado a un cliente, con sesiones totales, usadas, restantes y estado `active | used | expired`.

## Bloqueo de horario

`BlockedSlot` representa un intervalo no disponible con inicio, fin, motivo, provider, sede y posible `repeat_group_id`. El dialogo de bloqueo permite crear, editar, eliminar y repetir bloqueos.

## Venta, pago y transaccion

`Sale` representa el cobro asociado a una reserva o pack. Incluye total, pagado, saldo, estado `paid | partial | unpaid`, metodo de pago y transacciones. `PaymentTabComponent` permite crear venta inicial y registrar abonos.

## Estado de reserva

Los estados visibles estan definidos en `src/app/features/admin/bookings/constants/booking-statuses.ts`: Reservado, Confirmado, Asiste, No asistio, Pendiente, En espera y Cancelado, con ids 1 a 7 y colores asociados.

