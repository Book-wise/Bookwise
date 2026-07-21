# Contrato frontend–API: Laravel Resources

Fecha de verificación: 2026-07-21. Alcance: frontend Angular en
`feature/estabilizacion-avx`.

## Contrato adoptado

La API Laravel conserva sus respuestas `JsonResource`; Angular las adapta en
un único punto, `src/app/core/services/api.service.ts`, mediante los tipos y
helpers de `src/app/core/models/api-response.ts`:

- Recurso individual: `{ data: T }` → `T` con `unwrapResource`.
- Colección: `{ data: T[], meta?, links? }` → `T[]` con
  `unwrapCollection` cuando el consumidor no pagina.
- Colección paginada: se conserva la respuesta completa. En particular,
  `getClientsPage` devuelve `data`, `meta` y `links`; `getClients` es sólo la
  vista de conveniencia para selectores y cachés que no muestran paginación.

Esta adaptación cubre locations, services, packs, providers, clients,
client-packs y reservas. Las operaciones de crear, editar y cancelar una
reserva retornan siempre `Booking`, no una mezcla de `Booking` y `{ data:
Booking }`.

`available_slots` requiere `start_date` en Laravel y retorna `start`/`end`.
El cliente Angular traduce ese límite de contrato hacia `date` y
`start_time`/`end_time` de `AvailableSlot`. No fabrica slots locales.

## Decisiones provisionales aplicadas

- El registro público no forma parte de la aplicación navegable: no existe la
  ruta `/register`, el login no lo enlaza y `ApiService` no emite `POST
  /register`. El componente se conserva fuera de las rutas y deja explícito
  que la capacidad está deshabilitada.
- La creación rápida de servicios desde el formulario de reservas queda
  deshabilitada. La API actual no publica `POST /services`; no se simula una
  creación local ni se presenta como persistida.
- La pantalla de disponibilidad del profesional no edita ni muestra horarios
  en memoria. La API sólo expone disponibilidad de slots por ubicación/fecha;
  no hay contrato verificado para persistir horarios laborales.
- Las reglas FullCalendar y la tarjeta de paciente permanecen iguales, pero se
  cargan desde hojas globales para evitar incumplir presupuestos CSS por
  componente. No se aumentaron los budgets.

## POR REVISAR CON SEBACIRK

1. Definir si el registro público existirá y, si corresponde, su endpoint,
   rol inicial, validaciones y flujo de activación.
2. Confirmar el contrato CRUD de servicios antes de reactivar la creación
   rápida desde reservas.
3. Definir el modelo y permisos para horarios laborales del profesional. La
   disponibilidad calculada de slots no reemplaza ese contrato.
4. Decidir qué vistas de clientes deben mostrar paginación; hoy la API la
   entrega, pero los selectores y la lista actual consumen la vista plana.
5. Confirmar si el coste de cargar estilos de calendario globalmente es
   aceptable a cambio de respetar los budgets actuales. Es una estabilización
   de compilación, no un cambio visual ni de arquitectura de producto.

## Pruebas relacionadas

- `api-response.spec.ts`: Resource individual, colección y metadata.
- `api.service.spec.ts`: clientes, reservas, paginación y errores HTTP.
- `app.routes.spec.ts`: login disponible y ausencia de ruta pública de
  registro.
