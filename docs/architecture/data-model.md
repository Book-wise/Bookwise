# Modelo De Datos Esperado Por El Frontend

## Entidades principales

Los tipos base estan en `src/app/core/models/index.ts`.

- `Location`: sede con `id`, `name`, `address`, `city`, `timezone`, `active`.
- `Provider`: profesional con datos personales, sede opcional y servicios opcionales.
- `Service`: servicio con duracion, precio, estado y configuracion opcional de slots.
- `ServicePack`: pack de sesiones asociado a un servicio.
- `Client`: cliente/paciente con nombre, email, telefono, RUT, genero, `wc_customer_id`, estado y atributos custom.
- `ClientPack`: pack comprado/asignado a cliente, con sesiones usadas/restantes y estado.
- `Booking`: reserva con cliente, servicio, provider, sede, estado, tiempos, precio, pago, pack session y notas.
- `ProviderAvailability`: disponibilidad semanal por provider/sede/dia.
- `Payment`: pago resumido asociado a reserva.

## Respuestas especializadas

`src/app/core/models/responses/bookings.ts` define respuestas mas especificas para reservas y bloqueos, incluyendo `BookingPayment`, `BookingPackSession` y `BlockConflictResponse`.

`src/app/core/models/responses/sales.ts` define ventas, transacciones, pack sessions de ventas y respuestas de transacciones.

## Requests principales

`src/app/core/models/requests/blocked-slots.ts` contiene:

- `CreateBlockedSlot`
- `CreateBlockedSlotRepeat`
- `CreateBooking`
- `BookingRepeat`
- `UpdateBooking`
- `CancelBooking`

`src/app/core/models/requests/sales.ts` contiene:

- `CreateSaleRequest`
- `CreateTransactionRequest`
- `UpdateSaleRequest`

## Estados

Estados de reserva definidos en `src/app/features/admin/bookings/constants/booking-statuses.ts`:

| ID | Label |
| --- | --- |
| 1 | Reservado |
| 2 | Confirmado |
| 3 | Asiste |
| 4 | No asistio |
| 5 | Pendiente |
| 6 | En espera |
| 7 | Cancelado |

Estados de pago definidos en el mismo archivo:

- `unpaid`
- `partial`
- `paid`

## Desconocido o no verificable

No hay esquema de base de datos, migraciones backend ni fixtures de API en este repositorio. El modelo documentado es el contrato esperado por el frontend.

