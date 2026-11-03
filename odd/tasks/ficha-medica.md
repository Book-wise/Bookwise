# Ficha médica (pestaña del diálogo de reserva)

Diseño: `design/ficha-medica/` (4 artboards). Implementación empezada el 2026-11-03.

## Specs

- **S1 (seba, verbatim):** «ok para lo del dialogo en ficha queremos algo simple como esto» — la
  pestaña Ficha es una **lista simple**: sección *Fichas asociadas a la reserva* con un CTA
  *Agregar tipo de registro/ficha*, y debajo *Historial de consultas anteriores* con una tarjeta por
  registro (título en mayúsculas, fecha + hora, quién lo registró, «Ver más detalles»).
- **S2 (seba, verbatim):** «este es un desplegable que muestras las fichas medicas que tendremos en
  lista en la pagina de configuracion, eso esalgo para despues pero te muestro un ejemplo» — los
  tipos de ficha son un **catálogo configurable por negocio**, no un enum fijo, y se administran en
  **Configuraciones**.
- **S3 (seba, verbatim):** «si esa pantalla puedes crearla en configuraciones, inicialmente, como una
  pantalla mas» — el catálogo vive en una pantalla propia dentro de Configuraciones
  (`design/ficha-medica/04-config-tipos-ficha.html`).

## Lo que existe hoy en el producto

- La pestaña **Ficha** ya estaba en `booking-detail-dialog` (6 tabs; en mobile quedan
  `reserva, pago, ficha`) y mostraba un placeholder hardcodeado: «Ficha médica próximamente».
- **No hay dominio clínico en el backend**: no existen `clinical_records` ni
  `clinical_record_types`. `clients` solo tiene `notes`.

## Tasks

| # | Tarea | Estado | Commit |
|---|---|---|---|
| F1 | Pestaña Ficha presentacional: fichas de la reserva + historial + CTA de tipos, con estados vacíos honestos | ✅ hecho | `feat(bookings)` de esta sesión |
| F2 | Pantalla de Configuraciones «Tipos de ficha» | ⏳ pendiente (solo diseñada) | — |
| F3 | Detalle de la ficha detrás de «Ver más detalles» (campos por tipo) | ⏳ pendiente | — |
| F4 | Contrato backend del dominio clínico (ver abajo) | ⏳ pedido | — |

## Contrato pendiente con el backend

1. `clinical_record_types` (tenant-scoped): `name`, `active`, `sort_order` y **`fields`**
   (`key`, `label`, `type`, `required`, `options`) — una ficha láser no pide lo mismo que una kinésica.
2. `clinical_records`: `client_id`, `booking_id`, `record_type_id`, `values` (JSON), `created_at`,
   `created_by`. El **nombre del tipo** es lo que la tarjeta muestra en mayúsculas.
3. Endpoints: `GET /clinical-record-types` (activos para el desplegable, todos para administración) +
   CRUD; `GET /clinical-records?client_id=&booking_id=` + CRUD.
4. Permisos: `clinical.view` / `clinical.manage` (datos sensibles: profesional que atiende y admin;
   NO recepción por defecto) y `clinical_types.manage` para el catálogo.
5. Adjuntos y consentimiento: storage propio (mismo pedido que la imagen del servicio).

## Decisiones de implementación (F1)

- El componente `bw-ficha-tab` es **presentacional**: inputs `records`, `history`, `recordTypes`,
  `serviceLabel`; outputs `addRecord(typeId)`, `openRecord(id)`, `configureTypes()`. No conoce rutas
  ni hace requests: el padre navega a Configuraciones.
- El padre (`booking-detail-dialog`) pasa **colecciones vacías** mientras no exista el endpoint, con
  el comentario del contrato: la UI muestra sus estados vacíos, no datos inventados.
- Sin tipos configurados, el CTA cambia a **«Configurar tipos de ficha ›»** (no un desplegable vacío).
- «Ver más detalles» emite el id; el detalle es F3.

## Log

- **L1 (2026-11-03, verbatim):** «Implement the design artboard design/ficha-medica/02-ficha-subpestanas.html …»
  → F1 implementada: `ficha-tab.component.{ts,html,scss,spec.ts}` + modelo `clinical-record.model.ts`,
  wiring en `booking-detail-dialog` (reemplaza el placeholder) e i18n `ficha.*` (es/en).
  Evidencia: 8 specs del componente + 11 del diálogo **verdes**, `ng build` verde, 0 literales de color.
- **L2 (2026-11-03):** el diseño vive en `design/ficha-medica/` (lista simple, ficha vacía y pantalla
  de tipos en Configuraciones). Se descartó la dirección «dos columnas» del board 01: el mantenedor
  pidió algo simple, tipo lista.
