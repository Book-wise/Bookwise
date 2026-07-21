# Vista General Del Negocio

## Confirmado por el repositorio

Bookwise es un frontend para gestion de agenda y reservas. El README de raiz lo describe como un sistema para admins y providers que permite ver, crear y gestionar reservas, con clientes asociados a perfiles. El codigo confirma rutas para login, registro, administracion y vista de provider en `src/app/app.routes.ts`.

El dominio observado gira alrededor de:

- Reservas: `Booking`, `CreateBooking`, `UpdateBooking` en `src/app/core/models/index.ts` y `src/app/core/models/requests/blocked-slots.ts`.
- Clientes o pacientes: `Client` y `PatientCardComponent` en `src/app/core/models/index.ts` y `src/app/shared/components/patient-card/patient-card.component.ts`.
- Profesionales o providers: `Provider` en `src/app/core/models/index.ts`.
- Sedes o ubicaciones: `Location` en `src/app/core/models/index.ts`.
- Servicios y packs: `Service`, `ServicePack`, `ClientPack` en `src/app/core/models/index.ts`.
- Bloqueos de horario: `BlockedSlot` y `CreateBlockedSlot` en `src/app/core/models/responses/bookings.ts` y `src/app/core/models/requests/blocked-slots.ts`.
- Ventas, pagos y transacciones: `Sale`, `CreateSaleRequest`, `CreateTransactionRequest` en `src/app/core/models/responses/sales.ts` y `src/app/core/models/requests/sales.ts`.

## Inferencias razonables

El producto parece orientado a centros de atencion con agenda por sede, profesional y servicio. La presencia de RUT, CLP, WhatsApp, idioma espanol por defecto y locale `es-CL` sugiere uso principal en Chile. Esta es una inferencia desde `src/app/shared/validators/rut.validator.ts`, `src/app/shared/config/currency.config.ts`, enlaces `wa.me` en componentes y configuracion PrimeNG en `src/app/app.config.ts`.

## Desconocido o no verificable

No se puede confirmar desde este repositorio:

- Reglas comerciales completas del negocio.
- Reglas reales de autorizacion backend.
- Reglas contables o fiscales.
- Persistencia de datos.
- Si los terminos "cliente" y "paciente" son sinonimos oficiales del dominio o solo etiquetas de UI mezcladas.

