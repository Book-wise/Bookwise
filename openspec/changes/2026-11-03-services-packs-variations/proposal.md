# Pedido FE → BE — Servicios, packs y variaciones por atributo (2026-11-03)

Contexto: hoy **no se pueden crear servicios ni packs desde el panel** (el backend solo expone
`GET`), y la agenda **no sabe cuántas sesiones de un pack ya se consumieron** aunque el modelo de
datos sí lo soporta. Además el cliente pidió vender **variaciones** de un servicio igual que en su
WordPress (kinesilk.cl): un atributo (`Sesiones`) con términos (`1 sesión`, `3 sesiones`,
`6 sesiones`), cada término con su precio, el nombre del término anexado al producto, badge de
descuento e imagen optimizada.

Este documento es el pedido concreto. Nada de esto está implementado todavía en el frontend.

> **Actualización 2026-11-03 (decisiones del mantenedor, ver §6):** un solo atributo por servicio y
> hoy es **`Sesiones`** (talla/color queda fuera de v1); la **variación es la fuente** y el pack del
> catálogo se materializa desde un término (**se renuevan los seeds**); la pantalla reusa
> **`/admin/packs`**; **sin porcentajes precargados** (el front ofrece una **escalera de descuento
> por volumen opcional y vacía**, y sugiere *agregar variaciones*; los precios y el precio de lista
> los define el negocio o una carga masiva futura); **una imagen por servicio**, nunca por término.

---

## 1. Lo que ya existe (verificado, no supuesto)

### Backend (`Bookwise-API`, `develop`)

| Recurso | Rutas | Permisos |
|---|---|---|
| Servicios | `GET /services`, `GET /services/{id}` | `scope` de lectura |
| Packs (catálogo) | `GET /packs`, `GET /packs/{id}` | idem |
| Packs del cliente | `GET /client-packs`, `GET /client-packs/{id}`, `POST /client-packs`, `PATCH /client-packs/{id}/use` | `client_packs.view` / `client_packs.manage` |
| Sesiones de pack | `PATCH /pack-sessions/{id}` | `pack_sessions.manage` |

Modelos y reglas que ya están (esto es lo valioso):

- `services`: `id, name, duration_minutes, price, wc_product_id, active` — **sin** descripción,
  **sin** imagen, **sin** variaciones.
- `service_packs`: `service_id, name, total_sessions, price, active`.
- `client_packs`: `client_id, service_pack_id, wc_order_id, total_sessions, used_sessions, status`
  + `remaining_sessions` derivado + `isWooOrderPaid()` (un pack de Woo no se usa hasta que la venta
  esté pagada).
- `pack_sessions`: `client_pack_id, booking_id, session_number, status
  (pending|scheduled|attended|cancelled), attended_at, price, notes`.
- `PackSessionConsumptionService`: un booking **reserva** la sesión (`pending → scheduled`) y al
  pasar a estado *atendido* **consume** (`attended`, `used_sessions++`, y el pack pasa a
  `completed` al llenarse). Cancelar libera la sesión a `pending`.
- `POST /bookings` con `service_pack_id`: valida el id, **resuelve el servicio del pack y descarta
  el `service_pack_id`** (`BookingController.php:105-126`). **No crea ni linkea `pack_session`.**

### Frontend (`Bookwise`, `develop` = `a080e7f`)

- `ServicesApiService`: `getServices`, `getService`, `createService` (**sin contrato detrás**),
  `getPacks`, `getPack`.
- `ClientsApiService`: `getClientPacks`, `getClientPacksList`, `useClientPack` (**nadie lo llama**).
- `/admin/packs`: listado de solo lectura; los botones Editar/Ver **no tienen handler**.
- Formulario de reserva: el selector unifica servicios y packs (`pack_<id>` / `svc_<id>`), pero
  manda **`service_pack_id` = id del pack del CATÁLOGO**, no del pack del cliente.
- Ficha del paciente: chip de estado del pack + conteo de sesiones totales (sin usadas/restantes).

---

## 2. Contrato pedido

### 2.1 CRUD de servicios

```
POST    /v1/services                 {services.manage}
PATCH   /v1/services/{id}            {services.manage}
DELETE  /v1/services/{id}            {services.manage}   (soft delete)
GET     /v1/services?search=&active=&page=&per_page=      (envelope {data, links, meta})
```

Payload (mismo estilo que `providers`/`locations`: campos planos, opcionales explícitos):

```json
{
  "name": "Kinesiología",
  "description": "Sesión de kinesiología general",
  "duration_minutes": 60,
  "price": 25000,
  "slot_interval_minutes": 15,
  "active": true,
  "image_url": null,
  "wc_product_id": null,
  "variations": []
}
```

Validaciones propuestas: `name` requerido (3–120), `duration_minutes` 5–480, `price` ≥ 0,
`slot_interval_minutes` 5–120 opcional, `active` boolean. `DELETE` bloquea (409) si el servicio
tiene reservas o packs activos, y devuelve `{ error: "service_in_use", detail }` como
`locations` con `force`.

### 2.2 Variaciones por atributo (el pedido del cliente)

Modelo propuesto, **simple de usar**: **un atributo por servicio**, con N términos. Cada término es
una variación comprable. **En v1 el único atributo es `Sesiones`** (decisión D1; el nombre del
atributo se guarda igual para poder sumar otros más adelante).

```json
{
  "attribute_name": "Sesiones",
  "variations": [
    { "id": 1, "term": "1 sesión",  "total_sessions": 1, "price": 25000,
      "compare_at_price": null,   "discount_percent": null, "active": true, "sku": null },
    { "id": 2, "term": "3 sesiones", "total_sessions": 3, "price": 67500,
      "compare_at_price": 75000,  "discount_percent": 10,   "active": true, "sku": null },
    { "id": 3, "term": "6 sesiones", "total_sessions": 6, "price": 120000,
      "compare_at_price": 150000, "discount_percent": 20,   "active": true, "sku": null }
  ]
}
```

Reglas que pedimos al backend (para que el front no las reinvente):

1. `discount_percent` **lo calcula el backend** desde `compare_at_price` y `price`
   (`round((1 - price / compare_at_price) * 100)`), y `compare_at_price` debe ser `> price` (si no,
   422). El front solo lo muestra. **`compare_at_price` es opcional y sin defaults**: si viene
   `null`, no hay badge ni precio tachado, y el backend devuelve `discount_percent: null` (decisión
   D4: el sistema no propone descuentos; pueden venir de una carga masiva más adelante).
2. `name` efectivo = `"{service.name} - {term}"` (el nombre del término anexado, como en Woo), para
   que la orden y la agenda identifiquen qué se compró sin abrir el detalle.
3. **Un término de 1 sesión es válido y necesario**: el pack de 1 sesión es la venta individual.
   Unificamos: `total_sessions` del término **es** el `total_sessions` del pack. Así una variación
   comprada genera un `client_pack` con el mismo `service_id` y `total_sessions`.
4. `total_sessions` se guarda **también** en el pack por compatibilidad: si `service_packs` sigue
   existiendo como entidad aparte, pedimos que `variation_id` sea la fuente y que el pack sea
   derivado (ver pregunta 3).

- **Helper de precios (solo en el front, opcional):** el diálogo puede ofrecer una **escalera de
  descuento por volumen** (tramo = *"desde N sesiones → X %"*) que **calcula precios localmente solo
  para el formulario**. Nunca viene precargada: el backend recibe los **valores absolutos**
  `price`/`compare_at_price` y **recalcula** `discount_percent`; **no se agregan reglas de promoción**.

Endpoints, dos opciones (elegir una, ver pregunta 2):

- **A (recomendada, simple)**: las variaciones viajan dentro del servicio.
  `POST /services` y `PATCH /services/{id}` aceptan `attribute_name` + `variations[]` (con `id`
  nulo = crear, con `id` = actualizar, ausente = borrar). Una sola request, sin orquestación en el
  front.
- **B (anidada)**: `GET|POST /services/{id}/variations` y `PATCH|DELETE /services/{id}/variations/{v}`.

### 2.3 Packs

```
POST    /v1/packs      {service_packs.manage}   (si se mantiene la entidad aparte)
PATCH   /v1/packs/{id} {service_packs.manage}
DELETE  /v1/packs/{id} {service_packs.manage}
```

`ServicePack` (`service_id, name, total_sessions, price, active`) queda como está. Si se aprueba
2.2, el pack es **una variación materializada**: `POST /packs` con `variation_id` copia
`total_sessions` y `price` del término, y el nombre sigue la regla del punto 2.2.

### 2.4 Imagen de producto optimizada

- `image_url` (y `image_thumb_url` de ~400 px, webp) **solo en `services`** (decisión D5: una imagen
  por servicio; por término multiplicaría el uso de almacenamiento y se quiere ir liviano). Las
  variaciones **no** tienen imagen propia: heredan la del servicio.
- Upload: `POST /v1/services/{id}/image` (multipart, máx 5 MB, `jpg|png|webp`) → devuelve las dos
  URLs ya optimizadas. El backend decide variante/recorte; el front solo muestra.
- Si no hay imagen, el front cae a un placeholder con la inicial del servicio (no bloquea).

### 2.5 Badge de descuento

Sale de `compare_at_price` / `discount_percent` (2.2, regla 1). El front lo renderiza como chip
`-20%` **sobre la imagen del producto** (y el precio de lista tachado junto al precio). Con un término
elegido, el badge sigue a **ese término**; sin selección, muestra el **mayor** `−%` entre las
variaciones activas. No se calcula nada en el cliente.

### 2.6 Agenda fidedigna: sesión N de M — **el punto crítico**

Hoy se puede reservar "un pack" pero **la sesión no queda linkeada** y `used_sessions` no se mueve.
Pedimos:

1. `POST /bookings` acepta **`client_pack_id`** (el pack DEL CLIENTE, no el del catálogo) y opcional
   `pack_session_number`. El backend, **en la misma transacción** del alta:
   - valida pack `active` y `isWooOrderPaid()`;
   - linkea la sesión indicada (o la primera `pending` por `session_number`) →
     `pending → scheduled`, con `booking_id`;
   - errores estables: `pack_not_active`, `pack_not_paid`, `no_sessions_remaining`,
     `pack_session_unavailable` (esa sesión ya está `scheduled`/`attended`).
2. `GET /v1/clients/{id}/packs` devuelve, por pack: `total_sessions`, `used_sessions`,
   `remaining_sessions`, `status`, y **`sessions[]`** con
   `{ id, session_number, status, booking_id, attended_at }`. Con eso el diálogo de reserva puede
   mostrar *"Sesión 3 de 6 · 2 consumidas · quedan 4"* y deshabilitar las que ya tienen reserva.
3. **Consistencia de lo ya creado**: pedimos un criterio para las reservas históricas que se
   crearon con `service_pack_id` (hoy huérfanas). Opciones: (a) backfill por cliente+pack+servicio
   si hay un único pack candidato; (b) dejarlas sin link y no contarlas. Necesitamos el criterio,
   no lo asumimos.
4. Confirmar que `PATCH /client-packs/{id}/use` sigue siendo válido para consumo manual desde el
   panel y que `Idempotency-Key` es obligatorio en la práctica.

### 2.7 Permisos a exponer en `/auth/me → permissions`

`services.view`, `services.manage`, `service_packs.view`, `service_packs.manage`
(`pack_sessions.manage` y `client_packs.*` ya existen). Los nombres siguen la convención
`recurso.acción` que ya usa el catálogo del front.

---

## 3. Resumen de endpoints

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/v1/services` | `services.view` | envelope `{data, links, meta}`, filtros `search`, `active` |
| POST | `/v1/services` | `services.manage` | acepta `variations[]` (opción A) |
| PATCH | `/v1/services/{id}` | `services.manage` | idem; `variations[]` con `id`/sin `id` |
| DELETE | `/v1/services/{id}` | `services.manage` | soft; 409 `service_in_use` si tiene reservas |
| POST | `/v1/services/{id}/image` | `services.manage` | multipart; devuelve `image_url` + `image_thumb_url` |
| GET/POST/PATCH/DELETE | `/v1/packs[/{id}]` | `service_packs.*` | si se mantiene la entidad (2.3) |
| POST | `/v1/bookings` | `bookings.write` | + `client_pack_id`, `pack_session_number` (2.6.1) |
| GET | `/v1/clients/{id}/packs` | `client_packs.view` | + `sessions[]` (2.6.2) |
| PATCH | `/v1/client-packs/{id}/use` | `client_packs.manage` | ya existe; se mantiene |

---

## 4. Preguntas que bloquean el frontend

1. ~~**¿Variaciones simples o matriz?**~~ **RESPONDIDO (D1):** un atributo por servicio, y en v1 ese
   atributo es **solo `Sesiones`**. Se pide el modelo plano de 2.2 con el nombre del atributo
   guardado, para sumar otros atributos más adelante sin migrar.
2. **¿Variaciones dentro del servicio (A) o anidadas (B)?** A ahorra requests y evita estados
   intermedios; B es más REST. Recomendamos **A**.
3. ~~**¿`service_packs` sigue existiendo?**~~ **RESPONDIDO (D2):** la variación es la fuente y
   **se renuevan los seeds** con el modelo de variaciones; `service_packs` se mantiene como
   **materialización** del término (`variation_id`, copiando `total_sessions` y `price`) para no
   romper `client_packs.service_pack_id` ni la agenda del cliente.
4. **Alta de reserva con pack**: ¿lo resolvemos en `POST /bookings` (atómico, recomendado) o el
   front sigue llamando `PATCH /client-packs/{id}/use` después del alta (dos requests, riesgo de
   reserva sin sesión si falla la segunda)?
5. **Sesión elegible**: ¿aceptamos `pack_session_number` (agendar explícitamente la sesión 3) o el
   backend siempre asigna la primera `pending`?
6. **Backfill histórico** (2.6.3): ¿qué criterio aplicamos a las reservas con pack ya creadas?
7. **Imagen**: ¿storage del backend con CDN propio, S3, o reutilizamos la imagen de Woo
   (`wc_product_id`)? Necesitamos las dos URLs (full + thumb) para no descargar 2 MB en una lista.
   (Sigue abierto; D5 solo fija que es **una por servicio**.)
8. ~~**Descuento**: ¿`compare_at_price` alcanza o hay reglas de promoción?~~ **RESPONDIDO (D4):**
   `compare_at_price` opcional + `discount_percent` calculado alcanza para el badge. **No hay
   defaults ni reglas de promoción por ahora**; el front no aplica descuentos por su cuenta: ofrece
   una escalera de volumen opcional y vacía (solo calcula y rellena el formulario) y sugiere agregar
   variaciones. El origen futuro de los precios puede ser una **carga masiva** coordinada con
   el catálogo de WordPress del cliente (subdominio propio).

---

## 4bis. Decisiones del mantenedor que ajustan el pedido (2026-11-03)

Detalle y consecuencias en `odd/tasks/services-packs-variations.md` §6.

| # | Decisión | Efecto en este contrato |
|---|---|---|
| D1 | Un atributo por servicio; hoy **solo `Sesiones`** | shape plano de 2.2, con `attribute_name` guardado |
| D2 | **Variación = fuente**; packs materializados; **se renuevan los seeds** | `service_packs.variation_id`, seeds nuevos, la tabla plana deja de ser la UI |
| D3 | Se reusa la vista **`/admin/packs`** con los diálogos nuevos | no hay endpoint nuevo por esto; el front no crea `/admin/servicios` |
| D4 | **Sin porcentajes precargados**; el front sugiere variaciones y ofrece una **escalera de descuento por volumen** opcional, vacía por defecto | `compare_at_price` opcional; `discount_percent` puede ser `null` |
| D5 | **Una imagen por servicio** | `image_url`/`image_thumb_url` solo en `services`; las variaciones heredan |

Sigue abierto del lado del backend: **backfill histórico** (pregunta 6) y **storage de la imagen**
(pregunta 7).

---

## 4ter. Contrato CONFIRMADO por el backend (2026-11-03)

Respuesta del agente de `Bookwise-API`. **Nada está desplegado todavía**: todo vive en ramas locales
a la espera del merge de su mantenedor.

### Bloque 1 — `POST /v1/bookings` con pack del cliente (rama `feat/booking-pack-sessions`, `5f23ae3`)

```json
{ "client_pack_id": 12, "pack_session_number": 2, "client_id": 34, "location_id": 5,
  "start_time": "2026-11-10T10:00:00-03:00" }
```

- `pack_session_number` es **opcional**: el backend asigna la próxima (siempre en orden). El front lo
  **omite**.
- **Excluyente** con `service_id` y `service_pack_id` → 422 `validation` si se manda más de uno.
- Reserva + linkeo (`pending → scheduled` con `booking_id`) en **la misma transacción**: si la sesión
  no se puede tomar, la reserva no se crea.
- Linkear **no consume**: `used_sessions` se mueve recién al atender la sesión.
- Errores (todos 422): `pack_not_active`, `pack_not_paid`, `no_sessions_remaining`,
  `pack_session_unavailable`, `pack_session_out_of_order` y **`pack_client_mismatch`** (nuevo: el pack
  es de otro cliente).

### Bloque 2 — `GET /v1/clients/{id}/packs` con sesiones

Envelope sin cambios (`{"data": [...]}`). Cada pack agrega `remaining_sessions` y `sessions[]`
ordenadas por `session_number`:

```json
{ "id": 51, "session_number": 1, "status": "scheduled", "booking_id": 900,
  "attended_at": null, "scheduled_at": "2026-11-10T10:00:00-03:00" }
```

- `scheduled_at` = `booking.start_time` ya resuelto: el front no tiene que pedir cada booking (es lo
  que faltaba para mostrar «programada el …»).
- **Aditivo**: se conservan todas las claves previas del pack y de cada sesión.
- `PATCH /client-packs/{id}/use` sigue igual; `Idempotency-Key` es **opcional** (recomendado mandarlo).

### Bloque 4 — estados y permisos (ramas `feat/services-status` `988c6d9`, `feat/permissions-services-packs` `8434003` + `cb934eb`)

- `services.status: draft|active|inactive` como fuente de verdad (`active` queda como espejo).
- `GET /services?status=active|draft|inactive` (422 `service_status_invalid`) y `?active=` legacy.
  ⚠️ **`?active=0` ahora devuelve NO publicados (draft + inactive)**, no solo inactivos.
- `POST /bookings` rechaza servicio no publicado con 422 **`service_not_available`** (cubre también
  el pack de catálogo).
- Keys nuevas: `services.view`, `services.manage`, `service_packs.view`, `service_packs.manage`.
  Admin con `manage` por defecto; **recepcionista** con `services.view` + `service_packs.view` +
  `locations.view` (solo lectura).
- ⚠️ **No cablear el guard todavía**: cada tenant necesita
  `php artisan permissions:apply-baseline` (aditivo, `--dry-run` disponible) para que `/auth/me` las
  emita. Con `hasPermission` fail-closed, gatear antes **esconde la pantalla para todos**.

### Precisiones verificadas por el backend (2026-11-03, mensaje `688f46c1`)

- **`draft` → `POST /bookings` responde `422 service_not_available`**, igual que `inactive` (guard
  `!isBookable()`, con un test por caso y otro para el pack de catálogo de un servicio inactivo).
- **`GET /services` sin filtro devuelve los tres estados** (test explícito). Para los **diálogos**
  corresponde `?status=active` (o `?active=1`).
- **`?active=0` = no publicados** (`draft` + `inactive`), pero sigue siendo el filtro sobre la columna
  espejo `active`: no hay ningún consumidor actual en el repo, y sin datos `draft` el resultado es
  idéntico al de antes del deploy.
- **`GET /packs` no se toca** (verificado por diff: `ServicePackController`, `ServicePackResource` y
  `routes/api.php` sin cambios en ninguna de las dos ramas).
- **`pack_session_number`**, si algún día se manda, tiene que ser **exactamente la próxima pendiente**:
  si no, `422 pack_session_out_of_order` explícito (no se corrige en silencio). El front lo omite.
- `scheduled_at` viene en **hora de la sucursal con offset**; `attended_at` marca el uso.

### Bloque 3 — CRUD de servicios + variaciones: **PENDIENTE**

Diseño confirmado por ellos (variaciones dentro del servicio, `GET /packs` sigue devolviendo los
packs materializados, `compare_at_price: null → discount_percent: null`, `compare_at_price > price` o
422). **Falta la autorización de su mantenedor para arrancarlo.**

### Plan del front (regla de ejecución)

1. **Nada se cablea hasta el merge + deploy** del backend: los commits están en ramas locales.
2. **El guard de permisos va después de `permissions:apply-baseline`**, en el mismo release; nunca antes.
3. Cuando avise el merge: cablear `client_pack_id`/`sessions[]` (selector de sesión N de M con orden
   secuencial), mapear los 6 códigos de error y el filtro `?status=`.

---

## 5. Lo que este pedido NO cambia (para no romper nada)

- `GET /services` y `GET /packs` mantienen sus campos actuales (solo se agregan los nuevos y, si se
  aprueba, el envelope `{data, links, meta}` que ya se pidió para `providers`/`locations`).
- `POST /client-packs`, `PATCH /client-packs/{id}/use`, `PATCH /pack-sessions/{id}` y
  `PackSessionConsumptionService` quedan como están.
- El **alta rápida de servicio dentro del formulario de reserva** del front (`createService()`) se
  **mantiene**: no se borra. Se adaptará al contrato real cuando exista `POST /services` (hoy esa
  llamada apunta a una ruta inexistente y recibe `405`).
