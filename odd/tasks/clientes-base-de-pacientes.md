# Manejo de clientes ("Base de Pacientes")

Rehacer la gestión de clientes del panel admin siguiendo la referencia de Kinesilk
("Base de Pacientes"): listado con panel de filtros avanzados, buscador global, contador con
total real, columnas ordenables, detalle del cliente, alta/edición y desactivación.

## Specs

- S1 (usuario, verbatim): "puedes revisar la imagen registro de pacientes en esta ruta y ademas
  la imagen filtro de pacientes y filtro de pacientes 2 para formular el manejo de clientes?"
- S2 (usuario, decisión): la primera entrega es **todo, incluidos los filtros avanzados**
  (no por fases: lista + filtros + detalle + alta/edición).
- S3 (usuario, decisión): los filtros que hoy no tienen respaldo (cumpleaños, ¿ha reservado?,
  servicio/profesional) se le piden al backend **ahora**, no después.
- S4 (usuario, decisión): el tacho de basura de la referencia **desactiva (soft)**, no borra.
- S5 (usuario, verbatim): "comunicate con el backend cuando necesites".

## Estado actual (verificado 2026-10-27 en este repo)

| Pieza | Hallazgo |
|---|---|
| `src/app/app.routes.ts:62-64` | Ruta `clients` con `abilityGuard(ABILITIES.clientsView)` |
| `clients-list.component.ts` (68 líneas) | Buscador + tabla. Llama `getClients({ search })` **sin `per_page`** → el API devuelve 15 → **la lista se trunca a 15 clientes** |
| `clients-list.component.html` (74 líneas) | Botones "Ver" y "Ver Packs" **sin `(onClick)`** (decorativos); `type="text"` duplicado; strings hardcodeados; `[paginator]="true" [rows]="10"` client-side sobre lo que llegó |
| `core/models/index.ts:97-112` | `Client` ya tiene `rut`, `gender`, `custom_attributes`, `notifications_enabled`, `notification_prefs`, `created_at`. **No tiene fecha de nacimiento** |
| `clients-api.service.ts` | `getClients({location_id, search, page, per_page})` tipado `Client[]` (array plano) · `getClient(id)` desenvuelve `{data}` · `createClient` / `updateClient` |
| `booking-form-dialog.component.ts:564` | Único lugar que crea clientes hoy (alta al vuelo en la reserva) |
| `shared/components/patient-card/` | Ya existen `bw-patient-card` y `bw-patient-detail-content` para reusar en el detalle |
| `shared/config/abilities.config.ts:21-23` | Ya existen `clients.view`, `clients.create`, `clients.update` |
| i18n | **No hay claves `clients.*`** en `es.ts`/`en.ts`: la pantalla está toda hardcodeada en español |

## Estado al cerrar la sesión (2026-10-27) — REGISTRADO Y A LA ESPERA

- Docs **commiteados** en `e84fcc8` (este archivo + el proposal) y **pusheados** a `origin`.
- Pedido de contrato **enviado** al mantenedor de `Bookwise-API` con 10 puntos; se le pidió
  prioridad sobre **1** (forma del listado + totales), **2** (`birth_date`), **3** (query params
  de filtros) y **6** (consecuencias de desactivar).
- **T1 sigue bloqueada** por esa respuesta; T2 y T3 dependen de ella.
- **Se puede avanzar sin contrato**: T4 (detalle), T5 (alta/edición, con `clients.create/update`
  que ya existen en el catálogo), T7 (i18n) y la parte de T2 que no depende del servidor
  (columna RUT, acciones reales).
- Vista consolidada de todo lo abierto: `odd/tasks/pendientes.md`.

## Contrato: respuesta del backend (2026-10-28)

El mantenedor de `Bookwise-API` respondió los 10 puntos (verificado contra develop `e94d2f7`).
**Nada implementado aún**; ETA 1–2 unidades para lo mecánico.

- **1. Listado + `meta.total` → GO.** Réplica de providers/locations (`{data, links, meta}`).
  `meta.total` es el total **visible para el actor** (boundary intra-tenant), no el global.
- **2. `birth_date` → GO, aditivo.** `date nullable` + validación `before_or_equal:today`.
- **3. Filtros → parcial.** Existen `email`/`rut`/`active`/`wc_customer_id` (exactos) y `search`
  (first/last/email/phone — **NO matchea RUT**, discrepancia con la tabla). Se construyen
  `location_id`, `provider_id`, `service_id`, `booking_status_id`, `has_booked`, `gender`,
  `birth_date_from/to`, `created_from/to`, `sort/direction` (vía `whereHas`, como AND sobre el scope).
- **5. Sort → allowlist.** Default real: `first_name asc` (no `last_name`).
- **6. Desactivación → DECIDIDO**: **bloquear y confirmar**. Regla final del backend: desactivar
  con reservas futuras o packs con sesiones → `409 requires_confirmation` con payload `affects`
  (el front confirma y reintenta); cliente desactivado **no recibe reservas nuevas** (`403`/`422`
  al intentar agendar).
- **2.4 `has_booked` → DECIDIDO**: enum `ever|upcoming` (no booleano); el filtro expone ambos.
- **Contrato CERRADO** (2026-10-28). El backend avisará con el hash del commit.
- **Unidad 1 implementada** en `Bookwise-API` `feat/clients-management-contract`:
  `4ca497c` (punto 1 envelope + `meta.total` boundary-respetado, y punto 8 `per_page` 1–100 → 422)
  y `952507b` (punto 2 `birth_date` date nullable, expuesta `YYYY-MM-DD`, aceptada en POST/PATCH no
  futura). **Ojo**: `GET /clients` ahora devuelve `{data, links, meta}` (antes array plano);
  `listClients` ya lo consume vía `collectPaginatedPages`.
- **Contrato COMPLETO** (rama `feat/clients-management-contract`, base `develop` @ `00aa24a`, sin
  pushear/mergear): Unidad 2 `2bf64ec` (sort/direction allowlist, default `last_name asc`) y
  `1ae9658` (`gender`, `created_from/to`, `search` incluye RUT); Unidad 3 `5b3cf1b`
  (`location_id`/`provider_id`/`service_id`/`booking_status_id`) y `24a31ed`
  (`has_booked=ever|upcoming`); Unidad 4 `37b0159` (desactivar `409 requires_confirmation` +
  `affects` + `force`; inactivo no recibe reservas) y `a1ff571` (`docs/api/clients-frontend.md`).
- **Follow-ups del backend**: `birth_date_from/to` (rango "Cumpleaños") y `custom_attributes[...]`
  como filtro **NO** están implementados; `birth_date` sí es editable. => el panel **no** muestra
  el rango de cumpleaños por ahora.
- **Pendiente de mergear**: la rama del backend la decide seba.
- **8. `per_page` → tope 1–100** (hoy sin tope; `abc` → 500).
- **RUT único por tenant**, `ChileanRutRule`, duplicado → `422 errors.rut`.
- **RBAC**: GET → `clients:read`+`view`; POST → `clients:write`+`create`; PATCH/deactivate →
  `clients:write`+`update`.
- ⚠️ El backend está cerrando un escape del boundary en `search` (OR sin agrupar).

## Gaps contra la referencia

1. **Fecha de nacimiento inexistente.** El resource documentado del backend
   (`backend/api-endpoints.md:82`) es `{ id, first_name, last_name, email, phone, rut, gender,
   wc_customer_id, active }`: sin fecha de nacimiento. El filtro "Cumpleaños" necesita schema
   nuevo (migración + resource + validación).
2. **Filtros por sede/profesional/servicio/estado de reserva/¿ha reservado?** son agregados
   sobre `bookings` y `client_packs`; hoy el FE no los pide y no sabemos si el API los acepta.
3. **Total para "Mostrando X de N"**: depende de paginación con `meta`.
4. **Orden por columna**: tiene que ser server-side si la paginación lo es.
5. **Consecuencia de desactivar**: qué pasa con reservas futuras y packs del cliente.

## Tasks — ✅ implementadas (2026-10-28, ver Estado abajo)

- ✅ T1 [S3] Cerrar contrato con `Bookwise-API`. — **CERRADO** y mergeado en el backend (`79ed586`).
- ✅ T2 [S1] Listado: buscador global, contador "Mostrando X-Y de N" (`meta.total`/`from`/`to`),
  columnas ordenables (server-side), RUT visible y acciones reales. **Server-side** (1 request por
  página); fallback tolerante a array plano.
- ✅ T3 [S1] Panel "Filtros avanzados" colapsable: Local/sede, Profesional, Servicio, Estado de la
  reserva, ¿Ha reservado? (`ever`/`upcoming`), Género, Creado desde/hasta; con **Buscar** y
  **Reestablecer**. ⚠️ **Cumpleaños (rango) NO implementado** en el backend → follow-up.
- ✅ T4 [S1] Detalle (`bw-client-detail-dialog`) reusando `bw-patient-card` + `bw-patient-detail-content`.
- ✅ T5 [S1] Alta y edición (`bw-client-form-dialog`) con RUT (módulo 11) y `birth_date`; gateadas
  con `clients.create`/`clients.update`.
- ✅ T6 [S4] Desactivar (soft) con 409 `deactivation_conflict` → diálogo con afectados (reservas +
  packs con `total`/`used`/`remaining`) → reintento con `force`; 422 `already_inactive`.
- ✅ T7 [S1] i18n es/en de toda la pantalla (claves `clients.*`).
- ✅ T8 [S1] Specs + `ng build` + `ng test` (servicio, lista, detalle, form).
- ✅ **Extra**: `ClientsStore` centraliza lista + mutaciones (parchea el cache, sin re-fetch).
- ❌ Fuera de alcance declarado: **Importar pacientes** y **Crear una audiencia con este
  listado** (CRM/marketing, no pedido).

## Dependencias del pedido de contrato

| Task | Depende de | Qué se necesita |
|---|---|---|
| T2 | §2.1, §2.5 | forma del listado con `meta.total` + orden server-side |
| T3 | §2.2, §2.3, §2.4 | `birth_date`, query params de filtros, semántica de `has_booked` |
| T6 | §2.6 | qué pasa con reservas futuras y packs al desactivar |

Propuesta FE→BE: `openspec/changes/2026-10-27-clients-management/proposal.md`.

## Decisión de alcance (2026-10-27)

Se preguntó y el usuario eligió: primera entrega **completa** (incluye filtros avanzados), pedir
**todo** el contrato al backend ahora, y **desactivar** en vez de borrar. Queda registrado para
no re-preguntar.

## Referencias

- `/mnt/d/documentos/trabajo/kinesilk/registro de pacientes.png` — pantalla completa.
- `/mnt/d/documentos/trabajo/kinesilk/filtros de paciente.png` — mitad inferior del panel.
- `/mnt/d/documentos/trabajo/kinesilk/filtros de paciente 2.png` — mitad superior del panel.

## Log

- L1 (usuario, verbatim): "puedes revisar la imagen registro de pacientes en esta ruta y ademas
  la imagen filtro de pacientes y filtro de pacientes 2 para formular el manejo de clientes?"
- L2 (exploración): mapa del frontend de clientes y del doc de endpoints del backend. Aparecen
  el truncado a 15, los botones decorativos, la ausencia de fecha de nacimiento y la ausencia
  total de i18n.
- L3 (usuario, decisiones): alcance completo; pedir todo el contrato ahora; tacho = desactivar.
- L4 (usuario, verbatim): "comunicate con el backend cuando necesites".
- L5 (backend, contrato, 2026-10-28): respuesta a los 10 puntos verificada contra `Bookwise-API`
  develop `e94d2f7`; nada implementado aún. GO: listado `{data,links,meta}` con `meta.total`
  (boundary-respetado), `birth_date` aditivo, sort allowlist (default `first_name asc`), tope
  `per_page` 1–100. Parcial: filtros (existen `email/rut/active/wc_customer_id` + `search` sin
  RUT; se construyen `location_id/provider_id/service_id/booking_status_id/has_booked/gender/
  birth_date_from/to/created_from/to/sort/direction`). Pendiente de seba: (6) desactivación y
  (2.4) `has_booked`. Hallazgo: el `search` escapaba el boundary (OR sin agrupar); backend lo cierra.
- L6 (usuario, decisiones, 2026-10-28): desactivación = **bloquear y confirmar** (impide agendar
  nuevas; confirmación si hay reservas futuras o packs con sesiones); `has_booked` = **ambos**
  (`ever` y `upcoming` como dos valores). Retransmitido al backend.
- L7 (backend, contrato cerrado, 2026-10-28): reglas finales — (6) desactivar con reservas futuras
  o packs con sesiones → `409 requires_confirmation` + payload `affects` (el front confirma y
  reintenta); cliente desactivado no recibe reservas nuevas (`403`/`422`); (2.4) `has_booked` =
  enum `ever|upcoming` (no booleano). Contrato **COMPLETO**. Puntos mecánicos (1,2,5,8) en curso;
  (3) y (6) arrancan con estas reglas. Backend avisará con el hash.
- L8 (backend, unidad 1, 2026-10-28): `4ca497c` (envelope+`meta.total`, `per_page` 1–100) y
  `952507b` (`birth_date`). `/clients` cambió de array plano a `{data,links,meta}`. Unidad 2
  (sort/direction, filtros de columna propia y `search` con RUT) en curso.
