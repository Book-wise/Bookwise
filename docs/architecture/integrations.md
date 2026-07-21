# Integraciones

## API HTTP

Confirmado por `src/environments/environment.ts`, el ambiente de desarrollo consume `http://127.0.0.1:9999/api/v1`.

Confirmado por `src/environments/environment.prod.ts`, produccion usa `/api/v1`.

Todas las llamadas HTTP revisadas estan concentradas en `src/app/core/services/api.service.ts`, salvo `AvailabilityService`, que tambien usa `HttpClient` para `available_slots` y deja otros endpoints de disponibilidad comentados como TODO.

## Autenticacion

El frontend espera respuestas de login/registro con `{ token, user }`. El token se guarda en `localStorage` y se agrega como Bearer token por interceptor. Fuentes:

- `src/app/core/models/index.ts`
- `src/app/core/services/auth.service.ts`
- `src/app/core/interceptors/auth.interceptor.ts`

## WhatsApp

La UI genera enlaces `https://wa.me/...` para telefonos de pacientes/clientes en calendario, detalle de pago y patient card. Fuentes:

- `src/app/features/admin/calendar/full-calendar.component.html`
- `src/app/features/admin/bookings/payment-detail/payment-detail-dialog.component.html`
- `src/app/shared/components/patient-card/patient-card.component.ts`

## WooCommerce

El modelo contiene `wc_customer_id` en clientes y `wc_order_id` en reservas/ventas. El README afirma que el frontend no pasa por WooCommerce. En el codigo revisado no hay llamadas directas a WooCommerce. Fuentes:

- `src/app/core/models/index.ts`
- `src/app/core/models/responses/sales.ts`
- `README.md`

## Librerias UI y runtime

- PrimeNG/PrimeIcons: componentes UI, temas y mensajes.
- FullCalendar: calendario admin/provider.
- Chart.js: graficos del dashboard.
- intl-tel-input: input telefonico internacional.
- RxJS: flujos HTTP, subjects, forkJoin y combinaciones reactivas.

## Desconocido o no verificable

No se verifico disponibilidad real de API, credenciales, CORS, version backend ni integraciones server-side.

