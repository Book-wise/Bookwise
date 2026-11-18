# Servicios, packs y variaciones — diseño de pantalla + plan (2026-11-03)

Pedido de seba: terminar la pantalla de servicios/packs con **variaciones por atributo** (atributo
`Sesiones` con términos `1`, `3`, `6 sesiones`), **badge de descuento** estilo WooCommerce e
**imagen optimizada para web**. Y que la **agenda** sepa cuántas sesiones de lo comprado ya se
consumieron.

Contrato pedido al backend: `openspec/changes/2026-11-03-services-packs-variations/proposal.md`.
Diseño (canvas): `design/productos-packs/` + `design/system.md`.

---

## 1. Estado verificado (2026-11-03)

| Ítem | Estado | Evidencia |
|---|---|---|
| Crear profesionales | ✅ done | `providers-list` + `provider-dialog` + `POST /providers` |
| Crear locations | ✅ done | `locations-list` + `location-dialog` + `POST /locations` |
| Crear servicios | ❌ **no** | backend solo `GET /services`; sin pantalla en el front |
| Crear packs | ❌ **no** | backend solo `GET /packs`; `/admin/packs` es solo lectura con botones sin handler |
| Variaciones por atributo | ❌ **no** | `services`/`service_packs` sin `attribute`, `term`, `compare_at_price`, `image_url` |
| Consumo de sesiones en agenda | ⚠️ **modelo sí, link no** | `pack_sessions` + `PackSessionConsumptionService` existen; `POST /bookings` **descarta** `service_pack_id` y no linkea sesión |

### Para qué se usa hoy `POST /services` (no se borra)

`ServicesApiService.createService()` se usa **solo** desde el **alta rápida dentro del formulario de
reserva** (`booking-form-dialog`, panel "Nuevo servicio": nombre + precio + duración →
`saveNewService()`). Sirve para que recepción no corte el flujo de reserva yendo a otra pantalla.

Hoy esa llamada **falla con 405** porque la ruta no existe en el backend. **No la eliminamos.** Plan:

1. Cuando exista `POST /services` (contrato 2.1), se adapta el payload al contrato real.
2. Mientras tanto, se **mantiene** y se le agrega manejo explícito de `405/404` con un mensaje claro
   ("el alta rápida todavía no está habilitada") en vez de un error genérico.

Cualquier cambio destructivo (borrar la quick-create, cambiar su UX, tocar `useClientPack`) se
consulta antes. Nada de lo propuesto acá la elimina.

### Hallazgo de fidelidad en la agenda (lo más importante)

- El formulario de reserva manda **`service_pack_id` = `service_packs.id` (catálogo)**, cuando el
  dato correcto para "sesión N de 6 de este paciente" es **`client_packs.id`** (el pack que ese
  cliente compró). Es un error semántico, no solo una feature faltante.
- El backend resuelve el servicio del pack, **descarta el id** y crea la reserva. Resultado: la
  reserva existe, **la sesión no se linkea** y `used_sessions` nunca sube por esa vía.
- `PATCH /client-packs/{id}/use` sí linkea (toma la primera sesión `pending` y la pasa a
  `scheduled`), pero **ningún componente del front lo llama**.
- El consumo real (attended → `used_sessions++`) ya funciona: lo dispara
  `PackSessionConsumptionService` al cambiar el estado de la reserva (y desde el webhook de Woo).

Conclusión: **la información se puede coordinar de forma fidedigna, y el 80% del backend ya está**.
Lo que falta es (a) que el alta de reserva linkee la sesión atómicamente y (b) mostrar el estado de
sesiones en el diálogo. Ambas cosas dependen del contrato (puntos 2.6.1 y 2.6.2).

---

## 2. Pantalla: se reusa `/admin/packs` (lista + variaciones)

**Decisión de seba (D3)**: no se crea `/admin/servicios`; se usa **la misma vista** que ya existe en
`http://localhost:4200/admin/packs` y se agregan los diálogos necesarios. La ruta se mantiene
(`/admin/packs`) para no romper el menú ni enlaces; lo que cambia es el **contenido**: deja de ser una
tabla plana de packs y pasa a ser la gestión de **servicios con sus variaciones**.

El diseño vive en `design/productos-packs/` (canvas: `http://127.0.0.1:<puerto>/d/productos-packs/`):

| Artboard | Qué propone | Tradeoff |
|---|---|---|
| `01-lista-tabla.html` | Tabla densa, una fila por servicio con sus términos y una sub-fila expandible con el detalle | Escanea rápido; imagen chica |
| `02-lista-tarjetas.html` | Grilla de tarjetas con imagen 16:9 y términos como opciones | Imagen manda; comparar cuesta más |
| `03-dialogo-servicio.html` | Diálogo: datos, imagen única, términos con precio por sesión y vista previa | Alto; scroll en pantallas chicas |

Reglas de presentación:

- Una fila/tarjeta por **servicio**, con sus términos resumidos (`1 sesión $25.000 · 3 sesiones
  $67.500 −10% · 6 sesiones $120.000 −20%`).
- **Chip de descuento** `-X%` (verde, `--bw-chip-text-success`) **solo si hay precio de lista**; el
  precio de lista se muestra tachado. Nunca se calcula en el cliente (lo da el backend).
- El badge de descuento va **sobre la imagen del producto**. Con un término elegido (vista previa /
  reserva), muestra el `−X%` de **ese término**; sin selección (grilla/tarjetas del listado), el
  **mayor** `−X%` entre los términos activos. Sin precio de lista no hay badge.
- **Imagen**: una por servicio (`image_thumb_url` ≈400 px, webp) con `loading="lazy"` y fallback a
  la inicial; la original nunca se descarga en la lista.
- Estado con los chips que ya existen (`bw-chip--success/warning/danger`), sin inventar paleta.
- **Banner de sugerencia** (ámbar, `.bw-capacity-cta` ya existe con ese patrón): "N servicios no
  tienen variaciones" + acción "Revisar". Descartable. **No** crea términos ni precios.
- **Filtro de estado** (`Todos · Activos · Borradores · Inactivos`) idéntico en las dos vistas; el
  estado «Borrador» está en stand-by (ver §6, ítem 4) y la propia UI lo declara por definir.

### Regla sobre el shell de la app (no tocar)

El **shell ya está implementado** y se mantiene **tal cual**: `admin-layout` (sidebar con el logo
oficial, botón de colapsar, los **6 ítems reales**, `bw-agenda-navigator`, footer con "Salir") y
`bw-app-header` (nombre del negocio + RUT, selector de tema, menú de cuenta). En los artboards se
reproduce **solo como contexto visual** para juzgar la pantalla; **no es trabajo a implementar**.

**Único cambio intencional en el shell:** el ítem de menú `nav.packs` (hoy «Packs») pasa a
**«Servicios y packs»** — una línea en `admin-layout.component.ts` + la clave i18n `nav.packs`.
Nada más se renombra: `nav.locations` sigue siendo **«Ubicaciones»** (no «Sucursales»), y «Plan»,
«Facturación», «Mi perfil», «Roles» y «Configuraciones» **no van al sidebar** (no están en
`allMenuItems`).

---

## 3. Diálogo de servicio (crear/editar) — descuento por volumen opcional

Estructura (ver `design/productos-packs/03-dialogo-servicio.html`):

- **Datos**: nombre, duración (min), descripción, precio base por sesión, intervalo de cupo,
  producto de WordPress (`wc_product_id`), activo.
- **Imagen**: una sola por servicio (JPG/PNG/WebP ≤5 MB, recorte 16:9 + miniatura). Helper explícito:
  *"una sola imagen por servicio (no por término): la reusan todas las variaciones"*.
- **Variaciones**: atributo **`Sesiones`** (fijo en v1) y una tabla de términos con: término,
  sesiones, **precio**, **precio de lista (opcional)**, **precio por sesión** calculado en vivo y
  acciones. `+ Agregar término`.
- **Vista previa**: mini-tarjeta con cómo se verá el producto en la reserva.

### Reglas (reemplazan la vieja "propuesta de precios")

1. **Descuento por volumen.** El diálogo ofrece una escalera de descuento por volumen (tramo =
   *"desde N sesiones → X %"*). **Decisión de seba (2026-11-03): el diálogo SÍ puede proponer la
   escalera**, siempre **editable** y **nunca aplicada sola** (acción explícita `✦ Sugerir escalera`;
   nada se guarda hasta apretar "Calcular precios"). Lo que se descarta es el **precargado silencioso**
   de 0/10/20 % (D4): el sistema no aplica descuentos por su cuenta. El `compare_at_price` es
   opcional y lo escribe el negocio.
2. **A más sesiones, mayor %.** El `X %` de un tramo debe ser mayor que el del tramo anterior; si no,
   el diálogo muestra un **aviso** (no bloqueante). La sugerencia respeta esa progresión.
3. **"Calcular precios" solo rellena**: completa el precio y el precio de lista de los términos en el
   formulario; **no guarda** ni aplica nada.
4. La sugerencia de **términos** sigue siendo **estructural**: propone *qué términos* faltan
   (`+ 6 sesiones`) y deja el precio **vacío** para que lo cargue el usuario. La sugerencia de
   **escalera** es la única que propone porcentajes, y lo hace en campos **editables** que el usuario
   puede cambiar o borrar antes de calcular.
5. El **precio por sesión** se muestra siempre por término: es la métrica con la que se decide, y
   delata "descuentos" que en realidad suben el unitario.
6. **El badge del selector de variación se mide contra la variación de 1 sesión**: en el diálogo de
   reserva, cada término muestra `−X%` calculado como
   `1 − (precio_término / sesiones) / (precio_1_sesión / 1)`. Ej.: 3 sesiones a $67.500 → $22.500 por
   sesión vs. $25.000 de 1 sesión ⇒ `−10%`. Sin término de 1 sesión no hay badge (no hay referencia).
7. La vista previa tiene un **selector de término** (para Kinesilk, Sesiones: 1 / 3 / 6): el badge
   `−X%`, el precio, el precio de lista tachado y el precio por sesión siguen al **término elegido**.
   La imagen es la misma para todos (una por servicio). Un término sin precio de lista se previsualiza
   **sin badge**.
8. Avisos (no bloqueantes): término sin precio; precio por sesión mayor que el del término de menos
   sesiones; falta el término de 1 sesión si se quiere vender individual.
9. Al guardar se envían **valores absolutos**; el backend revalida (`compare_at_price > price`, 422
   si no) y calcula `discount_percent`.

### Coordinación con el catálogo de WordPress (pendiente, no bloquea el diseño)

Los términos son los mismos que el negocio ya vende en el catálogo de su WordPress
(subdominio del cliente): el backend ya tiene `services.wc_product_id`, y más adelante esto puede
venir de una **carga masiva** en vez de carga manual una por una. Por eso el precio de lista se
modela como dato de entrada, no como regla de promoción.

---

## 4. Agenda: cómo se ve "sesión 3 de 6"

> **Venta suelta (seba, 2026-11-03):** «cobrar una sesión nueva, sin pack» agenda **una sola
> sesión**: la **variación de 1 sesión** si existe, o el **servicio original** cuando el servicio no
> tiene variaciones. Nunca agenda con la variación de 3+ sesiones elegida en el selector — es otro
> producto.
>
> **Regla de secuencia (seba, 2026-11-03):** las sesiones de un pack se consumen **siempre en orden**.
> No hay agendamiento alterno: se puede *ver* el pack completo, pero **solo se habilita la siguiente**
> sesión libre; las posteriores quedan **bloqueadas** hasta consumir la anterior. Si se cancela una
> reserva, esa sesión vuelve a `pending` y sigue siendo la siguiente.
> **Consecuencia para el backend**: `POST /bookings` con `client_pack_id` debe asignar (o aceptar)
> únicamente la primera sesión `pending` por `session_number` y rechazar cualquier salto con un error
> estable (propuesto: `422 pack_session_out_of_order`). Si no se puede garantizar el orden, es
> preferible que el backend ignore `pack_session_number` y asigne siempre la siguiente.

En el diálogo de reserva (cuando el cliente tiene packs activos para ese servicio):

```
Cliente: Rosa Kinesilk
Pack: Rosa Kinesilk · 6 sesiones      ▸ consumidas 2 · disponibles 4
Sesión:  ( ) 1 · programada 12/10   ( ) 2 · programada 19/10   (•) 3   ( ) 4 …
         [x] Consumir una sesión del pack al confirmar la reserva
```

- Se listan **solo las sesiones libres**; las `scheduled`/`attended` se muestran deshabilitadas con
  su fecha (fidelidad: si ya está reservada, no se puede volver a reservar).
- El pack sólo se ofrece si está `active` y pagado (`pack_not_paid` / `pack_not_active` del backend).
- Depende del contrato (2.6): `client_packs.id` en el booking y `sessions[]` en el GET de packs.

---

## 5. Plan de implementación (fases, con dependencias)

| # | Fase | Depende de | Entregable |
|---|---|---|---|
| T1 | Pedido de contrato al backend | — | `openspec/changes/2026-11-03-…/proposal.md` (✅ escrito) |
| T1b | Diseño de pantalla + design system | — | `design/system.md` + `design/productos-packs/` (✅ escrito) |
| T2 | Modelos + `ServicesApiService` (CRUD, variaciones, imagen) | contrato 2.1–2.4 + seeds nuevos | servicios tipados + specs |
| T3 | `/admin/packs` convertida en "Servicios y packs" — ✅ **IMPLEMENTADO** (2026-11-03, sin commit): grilla de tarjetas + vista lista con términos derivados de `service_packs`, filtro de estado, buscador y banner de sugerencia. **Read-only**: sin `POST/PATCH` no hay alta/edición, y no se ponen botones muertos | T2 (parcial) | `packs-list.component.{ts,html,scss}` + `services-terms.util.ts` + 21 specs |
| T4 | Diálogo de servicio con términos — ✅ **IMPLEMENTADO** (sin commit): `service-form-dialog` con Reactive Forms, variaciones (`variations[]` con `id` en edición = sync por id), validación espejo del contrato (`compare_at_price > price`), transiciones de estado válidas, subida de imagen post-save y refresh de `services`+`packs`. **Escalera de volumen**: NO incluida (fuera del alcance de esta unidad) | T2, T3 | `service-form-dialog/**` + specs |
| T5 | Quick-create del form de reserva adaptada al `POST /services` real (sin romper el flujo) | T2 | fix + manejo de 405 mientras no exista |
| T6 | Agenda: `client_pack_id` + selector de sesión "N de M" — **PASO 1 HECHO** (`1f22326`): **servicio → variación** con badge `−%` vs 1 sesión + **resumen read-only** del pack del paciente. **Contrato CONFIRMADO por el backend** (`5f23ae3`, rama sin mergear): `client_pack_id` (+ `pack_session_number` opcional), `sessions[]` con `scheduled_at`, 6 códigos de error. **Falta cablear** → esperando merge/deploy | contrato 2.6 ✅ (falta deploy) | form de reserva + specs |
| T7 | Retirar la tabla plana de packs del catálogo (los packs pasan a ser términos) | seeds + contrato 2.3 | `/admin/packs` sin la columna huérfana |
| T8 | **Exportador Bookwise → WooCommerce** — generador CSV del importador core + historial en `localStorage` + UI en el mantenedor (botón, menú de alcance, barra de sincronización, filtro `Woo:`, selección múltiple, estado por servicio) | independiente del backend (lee `ReferenceStore`) | `services-export.{util,store}.ts` + `packs-list` — ✅ **implementado**, sin commit |
| T9 | Diálogo de **validación previa + vista previa del CSV** (artboard `05-dialogo-exportacion.html`) | T8 | diálogo + specs — ⏳ pendiente |

T2–T5 no necesitan nada de la agenda; T6 es el que cierra la fidelidad con la orden pagada.

---

## 6. Decisiones de seba — CERRADAS (2026-11-03)

| # | Pregunta | Decisión | Consecuencia |
|---|---|---|---|
| D1 | ¿Un atributo por servicio o matriz tipo talla×color? | **Un atributo por servicio**, y hoy ese atributo es **solo `Sesiones`**. Talla/color era un ejemplo de posibilidades, no el alcance. | El diálogo tiene un solo grupo de términos; el modelo queda abierto (atributo con nombre) para agregar otros después. |
| D2 | ¿La variación reemplaza al pack del catálogo? | **La variación es más clara y resuelve el problema de forma más abierta**: se **renuevan los seeds** con el modelo de variaciones y los packs del catálogo se materializan desde un término. | `service_packs` sigue existiendo como materialización (`variation_id`), generado desde el término; los seeds se regeneran. La tabla plana deja de ser la UI. |
| D3 | ¿Pantalla nueva en `/admin/servicios`? | **No**: se usa la vista que ya existe en `/admin/packs` y se agregan los diálogos. Se permite renombrar ruta/componentes si hace más sentido. | Ruta `/admin/packs` intacta; el componente pasa a "Servicios y packs". |
| D4 | Descuentos por volumen 0/10/20% | **Sin defaults silenciosos.** No hay porcentajes precargados fuera de una acción explícita. El front **sugiere añadir variaciones** y, desde 2026-11-03, **el diálogo también puede proponer la escalera de volumen (`✦ Sugerir escalera`), siempre editable y nunca aplicada sola**. Puede que los precios vengan de una **carga masiva** más adelante. | Precio de lista opcional; la escalera se propone solo a pedido, en campos editables, y no se aplica hasta "Calcular precios"; al backend van valores absolutos. Se coordina con el catálogo del WordPress del cliente. |
| D5 | ¿Imagen por servicio o por término? | **Una por servicio.** Por término "ampliaría demasiado el uso de imágenes" y se quiere ir liviano. | `image_url`/`image_thumb_url` viven en el servicio; ningún término tiene imagen propia. |

### Abierto todavía (no bloquea el diseño)

1. **Backfill histórico** de reservas creadas con `service_pack_id` huérfano (criterio del backend).
2. **Storage de la imagen** (CDN propio / S3 / reutilizar la de Woo): se necesitan las dos URLs.
3. Confirmación del backend del shape de variaciones dentro del servicio (opción A) y del
   `variation_id` en `service_packs`.
4. **Permisos `services.*` / `service_packs.*` — KEYS LISTAS, GATING BLOQUEADO (2026-11-03).**
   El backend ya las creó (`8434003` + `cb934eb`): `services.view/manage`, `service_packs.view/manage`;
   admin con `manage` por defecto y **recepcionista en solo lectura**. **Pero cada tenant necesita
   `php artisan permissions:apply-baseline`** para que `/auth/me` las emita: mientras no corra, gatear
   esconde la pantalla para todos (fail-closed). Coordinar con el backend y cablear en el mismo
   release que el baseline.
5. **Estados del servicio — CONFIRMADO (2026-11-03).** `services.status: draft|active|inactive`
   (`active` queda como espejo) y `GET /services?status=…`. Ojo: **`?active=0` ahora devuelve draft +
   inactive**, no solo inactivos. `POST /bookings` rechaza no publicados con `422 service_not_available`.
   La UI puede ya ofrecer el cuarto estado «Borrador» en el filtro cuando se despliegue.
6. **Permisos `services.*` / `service_packs.*` — (texto histórico, reemplazado por el ítem 4).**
   Hallazgo: `src/app/shared/config/abilities.config.ts` **no tiene** `services.view/manage` ni
   `service_packs.view/manage` (sí tiene `pack_sessions.manage`, `client_packs.*`), y `/admin/packs`
   es la **única** ruta del admin **sin `canActivate`** y el **único** ítem del menú **sin `ability`**.
   Consecuencia: hoy la pantalla la ve cualquiera con sesión.
   **Orden obligatorio**: primero el backend debe emitir las keys en
   `/auth/me → permissions` (catálogo `RolePermissionService::CATALOG`); recién entonces el front
   agrega las constantes y pone `abilityGuard(ABILITIES.servicesView)` + `ability: servicesView` en
   el menú. Hacerlo antes **oculta la pantalla a todos** (fail-closed) y es una regresión.
   Matriz pedida: **admin** = `services.manage` + `service_packs.manage` por defecto;
   **staff/profesional** = asignable por rol (RBAC ya existente), sin default.
   Lectura = `services.view` (y `service_packs.view` si el listado de packs se separa).
5. **Estados del servicio: `activo` / `borrador` / `inactivo` — EN STAND-BY (2026-11-03).** Hoy
   `services.active` es un **booleano**, así que «borrador» **no existe** en el backend. Decisión de
   seba: **no se define ahora**; queda pendiente para que el agente lo **coordine con el backend**.
   El diseño (`design/productos-packs/02-lista-tarjetas.html`) muestra los tres estados como
   **objetivo**, con una nota explícita de que el modelo está por definir.
   Propuesta a coordinar (no aprobada): `services.status: 'draft' | 'active' | 'inactive'` o
   `active` + `published_at` nullable; borrador invisible en reserva y en catálogo público; solo en
   el panel; transiciones Borrador→Activo, Activo↔Inactivo; el 409 por «en uso» no aplica a
   borradores; seeds: los `active:true` quedan activos y los `false` inactivos, nadie queda en draft.
   **No implementar el filtro por borrador ni migrar nada hasta que el backend confirme el campo.**

---

## 7. Exportador Bookwise → WooCommerce (CSV de carga masiva) — INVESTIGADO, NO IMPLEMENTADO

Pregunta de seba (2026-11-04): la ausencia del término «1 sesión» es el comportamiento de
**WordPress**; en **Bookwise** el precio de una sesión debe ser válido por sí mismo. Pero cuando
hagamos un **exportador a Woo** en el formato que Woo puede leer para carga masiva, **ahí sí** hay
que emitir el término.

### 7.1 La regla de tres capas (no confundirlas)

| Capa | Quién manda | Regla |
|---|---|---|
| **Presentación Woo** (tienda) | WordPress | Si no hay término «1 sesión», no se muestra precio unitario ni badge. No es nuestro problema. |
| **Modelo Bookwise** | Nosotros | El precio de **una sesión** siempre es un valor propio y autoconsistente: `singleSessionPrice = (variación activa de 1 sesión) ?? services.price`. **Nunca** el mínimo de las variaciones. El selector solo muestra términos reales. |
| **Exportador a Woo** | Nosotros (T8) | **Emitir siempre el término «1 sesión»** para que el producto exportado tenga precio unitario vendible. |

Corolario: si el cliente ya creó un producto en Bookwise «sin pensar en variaciones», Bookwise lo
trata como producto simple (`variations: []`) y `services.price` **es** el precio de una sesión. Al
exportar, ese servicio se convierte en padre `variable` con el término «1 sesión» materializado (o
se exporta `simple` si se prefiere espejo exacto; ver 7.4).

### 7.2 Formato oficial verificado (fuente: WooCommerce «Product CSV Importer and Exporter»,
schema oficial + `plugins/woocommerce/sample-data/sample_products.csv`)

Un **solo CSV** lleva el padre y sus variaciones, en ese orden:

| Fila | `Type` | `Parent` | `Attribute 1 name` | `Attribute 1 value(s)` | `Attribute 1 visible` | `Attribute 1 global` | Precio |
|---|---|---|---|---|---|---|---|
| padre | `variable` | *(vacío)* | `Sesiones` | `1 sesion, 3 sesiones, 6 sesiones` | `1` | `1` (global `pa_sesiones`) | **vacío** |
| variación | `variation` | SKU del padre o `id:123` | `Sesiones` | `1 sesion` | `1` | `1` | `Regular price` = compare_at / `Sale price` = price |

Reglas duras del importador (todas verificadas en la doc oficial):

1. **El padre va antes que sus variaciones.** Obligatorio desde WC 11.1 para convertir
   `simple → variable` en una sola importación; si no se garantiza el orden, hay que hacer **dos**
   importaciones (primero el padre, después las variaciones con «Update existing products
desmarcado).
2. **`Parent`** = SKU del padre, o `id:123` (con prefijo). El export usa SKU cuando puede.
3. **Los valores del padre son la lista completa** separada por comas; **cada variación lleva un
   solo valor**. Si una variación trae más de uno, Woo usa el primero. Un valor vacío en la fila de
   variación significa **«cualquier valor»** (catch-all) — hay que evitarlo.
4. **`Attribute N global = 1`** exige que el atributo global (`pa_*`) **ya exista** en la tienda
destino. `0` = atributo local del producto.
5. **El nombre y el valor del atributo deben coincidir exactamente** entre padre y variación
   (misma capitalización, sin espacios de más).
6. **`Regular price` = precio de lista, `Sale price` = precio de venta** → mapea directo a nuestro
   `compare_at_price` / `price`. Si `compare_at_price` es `null`, **dejar `Sale price` vacío** y poner
   el precio en `Regular price` (un `Sale price` igual al `Regular` crea una «oferta» falsa).
7. **`meta:` solo acepta texto plano — no JSON ni serializado** ⇒ **jamás** escribir
   `_product_attributes` a mano; se usan las columnas `Attribute N …`.
8. **`Published`**: `1` publicado, `0` privado, `-1` borrador, `2` pendiente de revisión.
9. **`Stock`**: número habilita gestión de stock; `parent` = la variación hereda del padre; vacío =
   sin gestión de stock.
10. **`Images`**: solo URLs (la primera es la destacada). El importador core **no** puede cargar
    alt text.
11. **No se puede asignar `ID`** a un producto nuevo; para actualizar se matchea por `ID` o `SKU`
    (con «Update existing products»).
12. Booleans con `1`/`0`. Jerarquía de categorías con `>`.

### 7.3 Trampas confirmadas para nuestro caso

- **Los IDs de término no son portables**: `pa_sesiones` tiene `3-sesiones` = 65 y `6-sesiones` = 66
  en producción, pero 64 y 65 en el local. **Exportar por nombre/slug, nunca por ID.**
- **`pa_sesiones` debe existir en destino.** Su tienda ya lo tiene en producción, pero el local
  **no tiene el término `1-sesion`** (solo 3 y 6): hay que crear el término antes del import, o usar
  `global = 0` (atributo local) y aceptar que no sea reutilizable.
- **Nombres de término inconsistentes en la tienda real**: `1 sesion` (sin tilde, singular) vs
  `3 sesiones` / `6 sesiones`. El exportador tiene que decidir una grafía canónica y **crear los
  términos que falten**; si no, se duplican términos. Propuesta: `1 sesion`, `3 sesiones`,
  `6 sesiones` (respetar lo que ya existe en producción).
- **Bug conocido del importador core**: marcar `global = 1` cuando existe un atributo local del
  mismo nombre hace que la fila se descarte y quede una variación catch-all + un atributo global
  huérfano (PR #67991). Verificar en staging.
- **`virtual`**: los servicios no llevan envío. El schema acepta tipos múltiples separados por
  coma, así que `variation, virtual` / `simple, virtual` es lo esperable, pero **hay que validarlo
  en staging** (no está documentado para filas de variación).
- **Conversión `simple → variable`** requiere «Update existing products» + padre antes que hijos; si
  el mismo SKU ya existe como simple, esta es la única vía de una pasada.

### 7.4 Decisiones abiertas de T8 (para cuando se implemente)

1. **¿Espejo exacto o normalizado?** Un servicio con `variations: []` se puede exportar como `simple`
   (espejo fiel de Woo) o como `variable` con un único término «1 sesión» (lo que pidió seba para la
   carga masiva). Recomendación: **`variable` + término «1 sesión»**, porque el objetivo del
   exportador es el catálogo de la tienda.
2. **¿Quién crea el atributo global y los términos?** Opciones: (a) pre-requisito manual en wp-admin;
   (b) el exportador emite un CSV previo / llama la REST de `products/attributes` y
   `products/attributes/{id}/terms`. Recomendación: (b) vía REST antes del CSV.
3. **SKU**: Woo exige SKU único por variación. Propuesta: `svc-{serviceId}` para el padre y
   `svc-{serviceId}-{totalSessions}` para cada término (estable y re-importable).
4. **¿Imágenes?** El CSV solo acepta URLs; si Bookwise sirve las imágenes por URL pública, se
   pueden usar; si no, quedan sin imagen (el importador no sube archivos locales).

### 7.5 Diseño (2026-11-04): `design/productos-packs/` artboards 04 y 05

Se **extendió** el design existente en vez de crear uno nuevo, porque el mantenedor ya vive ahí
(`02-lista-tarjetas.html` es el elegido e implementado). Dos artboards nuevos:

| Artboard | Qué responde | Tradeoff |
|---|---|---|
| `04-mantenedor-exportador.html` | Dónde queda el exportador: **acción secundaria del título** (`Exportar a Woo`, junto a «Ver packs vendidos»), con menú de **alcance** (catálogo completo / solo los que cambiaron / seleccionados), **barra de estado** de la última exportación («8 servicios · 21 variaciones · atributo global pa_sesiones») y **estado por servicio** al pie de cada tarjeta (al día · con cambios · sin exportar · no se exporta por borrador · se exporta oculto). | El mantenedor gana un eje de información (sincronización) que hay que mantener coherente con el de variaciones. |
| `05-dialogo-exportacion.html` | El diálogo: **validación previa** (bloqueantes vs advertencias: borrador, sin término «1 sesión», sin variaciones, inactivo) + **vista previa de las filas reales del CSV** (padre `variable` antes que las `variation`, columnas del importador core) + destino y términos a crear. | Es un diálogo alto y depende de que la validación previa sea rápida y explicable. |

Decisiones de diseño tomadas: el exportador **no** es una pantalla nueva; el botón es `outlined`
(secundario) porque exportar no es la acción frecuente; la barra de sincronización es **informativa**
(borde azul, no ámbar) para no competir con el banner de sugerencia de variaciones; el aviso «sin
término 1 sesión» aparece **en la tarjeta** (ámbar) además de en el preflight, porque es el dato que
el formato de Woo necesita y que el modelo de Bookwise tolera.

---

## Log
- **L1 (2026-11-03, verbatim, mensaje de seba con las respuestas):** «ok entonces te doy el texto
  sobre algo que trabajamos en una sesion que cerre para actualizarte, revisa gentle-design
  nuevamente porque ya lo use alguna vez, quiza no lo tienes instalado, te respondo ahora las
  preguntas: 1 el atributo por ahora solo es sesiones, lo de talla y color era un ejemplo para darte
  una idea de las posibilidades. 2 Creo que la variacion es mas clara o resuelve el problema de una
  manera mas abierta y clara, entonces al caso yo renovaria los seeds con lo que definas para eso, y
  podria con esto generar una mejor UX/UI para el manejo de productos/packs. 3 Ya tenemos una vista
  que se alcanza asi http://localhost:4200/admin/packs, utiliza esa misma vista creando los dialogos
  necesarios, si quieres renombra la ruta o componentes para que haga mayor sentido. 4 Pienso que
  hablas de los descuentos, no hagas defaults para eso, puede que mas adelante esto venga de una
  carga masiva, puedes presentar en el front una sugestion de añadir variaciones, luego tenemos que
  poder coordinar esto con el catalogo de productos que estara en el subdominio del cliente donde se
  alojara su wordpress. 5 Para salvar espacio, imagen por servicio, si hicieramos por termino (3,6,
  etc sesiones) podriamos ampliar demasiado el uso de imagenes, y en un principio queremos ir mas
  ligeros. Dime si necesitas saber algo mas.»
  → Cierra D1–D5 de la sección 6. (El pedido original de la sesión anterior está en Engram obs. 831.)
- **L2 (2026-11-03):** `gentle-design` **sí está disponible** en este entorno (tool `gentle_design`
  + skill `gentle-design`); la nota vieja de obs. 831 («no existe tooling gentle-design») quedó
  obsoleta. Se corrió el **design system sync** (`design/system.md` + `design/system.html` desde
  `src/styles/*`) y se escribieron 3 artboards en `design/productos-packs/`, servidos en el canvas
  (`http://127.0.0.1:46321/…/d/productos-packs/`).
- **L3 (2026-11-03, verbatim):** «me gustaria que aqui se acceda a la vista que se acceda a la vista
  como esta diseñado en 01-lista-tabla.html asi tenemos lo mejor de dos mundos, y el cliente elige la
  forma que le acomode mas.» → el toggle **Lista ↔ Tarjetas** de `02-lista-tarjetas.html` pasó a ser
  funcional (dos vistas en el mismo artboard, con `aria-pressed`, foco visible y persistencia en
  `localStorage`).
- **L4 (2026-11-03, verbatim):** «me preocupa que esto este implementando una side-bar nueva? es
  consciente el diseño de lo que ya esta implementado?» y luego «esta bien puedes hacer el 2 directo,
  pero luego tienes que estar consciente de que no es para implementar eso, porque ya existe, lo de
  cambiar a services y packs el menu, estoy de acuerdo.»
  → El sidebar de los artboards era **inventado** (logo falso, ítems «Planes»/«Configuración» que no
  están en el menú, «Sucursales» cuando el label real es «Ubicaciones», footer con usuario cuando el
  real es un botón de salir). Se rehace **copiando el shell real** (`admin-layout` + `app-header` +
  `bw-agenda-navigator`) como **contexto visual, no como algo a implementar**.
  **Renombre acordado**: el ítem de menú `nav.packs` («Packs») pasa a **«Servicios y packs»** — es la
  única desviación intencional del shell y es un cambio de una línea en `admin-layout.component.ts`
  + la clave i18n `nav.packs` cuando se implemente.
- **L5 (2026-11-03, verbatim, mensaje de seba):** «la idea en la propuesta de precios es que mientras
  mas sesiones mayor es el dscto, asi podemos presentar ese porcentaje de descuento en el badge sobre
  la imagen del producto.»
  → Aclara el propósito del helper de precios: es un **descuento por volumen** que alimenta el badge
  sobre la imagen. **No** reintroduce porcentajes precargados: la escalera sigue siendo opcional y
  no se aplica sola (D4 se mantiene).
- **L6 (2026-11-03, verbatim):** «1 si iguala el filtro 2 el dialogo puede proponerla editable.»
  → (1) El filtro de estado se iguala en `01-lista-tabla.html` y `02-lista-tarjetas.html`
  (Todos · Activos · Borradores · Inactivos, con la nota de que «Borrador» está por definir).
  (2) **El diálogo SÍ puede proponer la escalera de volumen**: acción explícita `✦ Sugerir escalera`,
  tramos con el % **editable**, resultado recalculado y nada aplicado hasta "Calcular precios".
  Se actualizaron las reglas de §3 y la fila D4 de §6.
- **L7 (2026-11-03, handoff):** se tomó `design/productos-packs/02-lista-tarjetas.html` como
  **artboard elegido** para implementar **T3**. Estado del handoff: `in_progress` en el canvas.
  **Alcance real contra el backend de hoy**: la pantalla se implementa **read-only** porque solo
  existen `GET /services` y `GET /packs` (POST/PATCH → 405). Los **términos se derivan de
  `service_packs`** (`service_id` + `total_sessions` + `price`), el precio del servicio es el precio
  base (no se inventa un término de 1 sesión) y **no se muestran badges de descuento** porque no hay
  `compare_at_price`. El filtro de estado expone **Todos · Activos · Inactivos** (Borrador queda en
  stand-by, §6 ítem 4). Nada de datos falsos, seeds ni botones sin handler.
  Se entregó el encargo a un worker con test-first y `ng build`; el handoff queda abierto hasta
  verificar y resolver el comentario de canvas `6ovngiyn`.
- **L8 (2026-11-03, T3 implementado):** el worker de implementación **falló** después de dejar solo
  `services-terms.util.ts` + su spec; el resto se completó inline. **Handoff de
  `02-lista-tarjetas.html` → `implemented`** con preview `http://localhost:4200/admin/packs`.
  Comentario de canvas `6ovngiyn` **resuelto**.

  **Implementado** (`src/app/features/admin/packs/`): reescritura de `packs-list.component`
  (grilla de tarjetas default + vista lista con sub-fila expandible, toggle persistido por
  `bw:services:vista:<userId>:<tenantId>`, filtro `Todos/Activos/Inactivos`, buscador sin acentos,
  banner de sugerencia descartable, skeletons y dos vacíos distintos), más `services-terms.util.ts`
  (precio por sesión, orden por sesiones, iniciales, normalización de búsqueda) y claves `packs.*`
  en `es.ts`/`en.ts`. `nav.packs` pasó a **«Servicios y packs» / “Services and packs”**.

  **Evidencia**: RED 12 fallos → GREEN **21/21** (`ng test --include='**/packs-list.component.spec.ts'
  --include='**/services-terms.util.spec.ts'`), `ng build` verde (solo warnings preexistentes: budget
  y `luxon` CJS), `git status -- src/` acotado a los 7 archivos de la unidad, **0 literales de color**
  en el SCSS y **0 botones sin handler**.

  **Caché**: la pantalla **no llama la API**: consume `ReferenceStore` (`services()`, `packs()`,
  `loaded()`, `error()`), que ya hidrata el catálogo una vez por sesión (`onInit → loadAll`). Solo pide
  una entidad si nadie la cargó (`ensureReferenceData`), así que entrar a la pantalla **no agrega
  requests**. Tras una escritura futura se refresca con `invalidateServices()`/`invalidatePacks()`.
  3 tests nuevos cubren: no recargar si ya está cargado, pedir cuando no lo está, y mostrar el error
  del store (24/24 en la unidad).

  **T6 paso 1 implementado (2026-11-03, commit `1f22326`)**: en `booking-form-dialog` el servicio y la
  variación son dos selects. Servicio = solo activos; variación = `service_packs` del servicio
  (activos, ordenados por sesiones) con **precio por sesión** y **badge `−%`** contra el precio de 1
  sesión (pack de 1 sesión o precio base). Elegir variación setea `service_pack_id`/duración/precio;
  el **payload de `onSave()` no cambió**. Además, **resumen read-only** del pack activo del paciente
  («1 de 3 usadas», una llamada a `getClientPacks` por cliente, tolerante a error).
  Evidencia: `booking-form-dialog` **61 passed / 2 failed** (los 2 preexistentes de `matchMedia`),
  `ng build` verde, 0 literales de color nuevos. Corregido de paso el placeholder
  `booking_form.service_placeholder` («servicio o pack» → «servicio») que el cambio dejaba obsoleto.
  Sigue bloqueado: selección/linkeo de la sesión N de M, orden secuencial y «Crear variaciones».

  **Contrato recibido del backend (2026-11-03, mensaje `539769daf2c5d92e`)**: confirmados los bloques
  **1** (`POST /bookings` con `client_pack_id`, `pack_session_number` opcional, transaccional, no
  consume al linkear, 6 códigos de error incl. **`pack_client_mismatch`**), **2** (`sessions[]` con
  `scheduled_at` + `remaining_sessions`, aditivo) y **4** (`status: draft|active|inactive`,
  `?status=`, `422 service_not_available`, keys de permisos con baseline por tenant). **Nada
  desplegado**: los commits viven en ramas locales (`5f23ae3`, `988c6d9`, `8434003`, `cb934eb`).
  **Regla**: no cablear hasta el merge/deploy, y el guard de permisos solo después de
  `permissions:apply-baseline`. Bloque **3 (CRUD + variaciones) sigue pendiente** de la autorización
  de su mantenedor. Detalle completo en el proposal, §4ter.

  **Seguimiento al backend (2026-11-03, mensaje `c56eaee7`)**: se reenvió el pedido de lo que
  **bloquea** la implementación, con el contrato explícito:
  1. `POST /bookings` con **`client_pack_id`** + `pack_session_number`, linkeo atómico
     (`pending → scheduled`) y **regla de secuencia** (`422 pack_session_out_of_order`);
  2. **`sessions[]`** en `GET /clients/{id}/packs`, con `attended_at` para la fecha de uso y
     **`scheduled_at`** (nuevo pedido) para la fecha de la sesión programada;
  3. CRUD de servicios + `variations[]` dentro del servicio + `service_packs.variation_id`, con la
     aclaración de **mantener `GET /packs` devolviendo la materialización** para no romper el paso
     "servicio → variación" que el front ya implementa.
  Sin respuesta todavía (el primer mensaje `d4810fc6` tampoco fue respondido).

  **Handoff de implementación (2026-11-03)**: artboard
  `design/reserva-variaciones/01-reserva-variacion.html` → `in_progress`. Alcance real: **servicio →
  variación** (términos = `service_packs` del servicio, activos, ordenados por sesiones) con precio por
  sesión y badge `−%` medido contra el precio de 1 sesión, más un **resumen read-only** del pack del
  paciente («1 de 3 usadas»). **Fuera de alcance por contrato**: elegir/linkear la sesión N de M
  (`client_pack_id`), el orden secuencial forzado y «Crear variaciones» (`POST/PATCH /services` = 405).

  **Diseño nuevo (2026-11-03)**: `design/reserva-variaciones/` — artboard
  `01-reserva-variacion.html` (servicio → **variación** → **sesión pagada**, con «sesión 2 de 3» y el
  estado de cada sesión) y `02-sesiones-paciente.html` (la pestaña **Sesiones** que ya existe en
  `patient-detail-content`, más el detalle por sesión). Depende del contrato 2.6 (`client_pack_id` +
  `sessions[]`); hoy el alta de reserva **no** puede linkear la sesión.

  **Commits (rama `feat/services-packs-variations`, sin push)**: `71b6622` helpers de términos ·
  `44e27a2` pantalla Servicios y packs (tarjetas + lista, i18n, `nav.packs`) · `14e97fc` booking-form
  solo servicios activos · `67e1be7` docs + artboards de productos-packs. Límite de slice: 3 commits,
  ~1.790 líneas autoradas (el SCSS de la pantalla pesa ~580).

  **Decisiones de fidelidad**: los términos se derivan de `service_packs` (no se inventa un término
  «1 sesión» desde el precio base); no hay badge de descuento (sin `compare_at_price`); el filtro
  ofrece **tres** estados (Borrador sigue en stand-by, §6 ítem 4); no hay acciones ni diálogos de
  escritura; el backend devuelve lista plana o envelope `{data}` y el componente normaliza ambos.
- **L9 (2026-11-04, mensaje del backend, bloque 3):** el backend (Bookwise-API) arrancó el bloque 3
  (U3/U4) y pidió (a) el texto verbatim del «punto 3» y (b) validación de sus decisiones. Decisiones
  suyas: `service_variations` tabla propia (id, service_id, name, duration_minutes, price, active,
  deleted_at); `service_packs` + `variation_id` (nullable FK) + `discount_percent` decimal(5,2)
  nullable 0..100; `discount_percent` **informativo** (no calcula el precio) con validación de
  coherencia `expected = variation.price × total_sessions × (1 − discount_percent/100)` → 422
  `pack_discount_mismatch`; soft delete de servicio; una imagen por servicio (mismo pipeline del
  logo, path público-relativo); `POST/PATCH /services` acepta `variations[]` anidado (sin endpoints
  de variación propios); transiciones `draft→active`, `active↔inactive`, `draft→inactive` prohibido
  (422 `service_status_transition_invalid`). **Respuesta del front (mensaje `474b3b34`):** todo OK;
  `variations[]` anidado es la opción A; imagen en paso aparte (`POST /services/{id}/image`); **sí
  necesitamos `description`** (falta la columna); con `status` alcanza para el chip; los 3 códigos
  alcanzan si vienen como `{ error: "<code>" }` a 422. **Aclaración clave:** su `discount_percent`
  reemplaza al `compare_at_price` del pedido (misma cuenta al revés: lista =
  `variation.price × total_sessions`); el front calcula el precio de lista tachado desde
  `variation.price × total_sessions`. Quedó pedida la confirmación de que ese es el único precio de
  lista y el detalle de `pack_variation_mismatch`.
- **L10 (2026-11-04, mensaje del backend, correcciones del bloque 3):** el backend cerró el bloque 3
  con el mantenedor y corrigió el contrato: (1) **no hay `service_variations`**: `service_packs` ES la
  tabla de variaciones y el API las expone como `variations[]` anidado (cada variación:
  `id, term, total_sessions, price, compare_at_price, discount_percent, sku, active`); (2)
  **`pack_variation_mismatch` no existe**; (3) **no hay escritura de packs** (`POST/PATCH/DELETE
  /packs` fuera; la escritura va por `/services` con `variations[]`, `GET /packs` queda read-only);
  (4) **`compare_at_price` explícito por término** (NO `variation.price × total_sessions`): puede ser
  cualquier valor `> price`, `discount_percent = round((1 − price/compare_at_price)*100)` calculado
  en backend, `compare_at_price <= price` → 422 `pack_discount_invalid`; el front usa
  `compare_at_price` directo para el tachado (vuelve al pedido 2.2 original); (5) `DELETE /services`
  → 409 `service_in_use` con `force`, luego soft delete; (6) acepta `description`, `attribute_name`,
  `image_url`/`image_thumb_url`, `GET /services?search=&active=&status=&page=&per_page=`,
  validaciones y shape `{ error }`; (7) **`variations: []` es válido = producto simple** (sin término
  «1 sesión» obligatorio): la suelta sale del término activo de 1 sesión o de `services.price`,
  nunca del mínimo. **Respuesta del front (mensaje `35ed257e`):** todo OK, nada rompe;
  `variations: []` ya cubierto (`referencePerSession` en booking-form-dialog ya hace esa regla); matiz
  UI: hoy el selector se muestra deshabilitado con «Sin variaciones» en vez de ocultarse (se oculta al
  cablear T2); los 5 códigos alcanzan (se agregarán `biz.*` en T2). Códigos finales:
  `service_status_transition_invalid` 422, `pack_discount_invalid` 422, `service_in_use` 409,
  `service_status_invalid` 422, `service_not_available` 422.
- **L11 (2026-11-04, verificación read-only del Woo real):** el backend pidió verificar 4 supuestos
  antes de escribir el esquema. **LocalWP no está disponible** en este entorno
  (`kinesilk-tema.develop` resuelve a `::1` pero nada escucha; sin Docker) y la key WC REST v3 del
  disco da 401. Fuente usada: **WooCommerce Store API pública** de `kinesilk.cl`
  (`/wp-json/wc/store/v1/products`), read-only. **El dump `respaldo wordpress 05-10-2026/…sql`
  está desactualizado** (0 `product_variation`, `sesiones` con `is_variation=0`): no modelar con él.

  **Resultados:** 24 productos → **9 variable + 15 simple**. Los 9 variables usan `pa_sesiones`
  (`1-sesion`, `3-sesiones`, `6-sesiones`); el padre tiene `prices.price` = mínimo (no vacío) y
  `price_range`. **"1 sesión" no es universal**: 8/9 lo tienen, `2917` (producto de prueba) no; y
  `2797`/`2982` solo tienen 2 de los 3 términos. **`variations: []` es caso vivo** (15 simples), con
  duplicación real: «Tatuaje de hasta 3cm» existe como `2793` (25.000, 1 sesión) y `2794` (139.990,
  pack 6) ambos simples; «Hollywood peel» como simple `2796` y variable `2797`; y 2 simples con
  precio 0 (`2783`, `2784`). **Mapeo clave confirmado: `regular_price > sale_price` ==
  `compare_at_price > price`** (5/12 variaciones con descuento real; 7/12 con `regular == sale` →
  `compare_at_price: null`); `price = sale_price ?? regular_price`. **Imágenes**: WP genera
  100/150/300/600/768/1024/1536/2048; la grilla usa `woocommerce_thumbnail` **300×300**; **no existe
  400px** → se recomendó **600×600** para `image_thumb_url`. `duracion` es atributo custom
  inconsistente («30 minutos»/«30 min»/«30 mins») → usar `services.duration_minutes`. El `name` de
  una variación en Woo es el del padre, no `padre - término`. No verificado: `manage_stock` por
  variación ni productos en draft (la Store API no los expone).
- **L12 (2026-11-04, aclaración del mantenedor):** «sin duda cuando no hay el término 1 sesión, no
  aparece como oferta eso es porque estaba en aprendizaje, pero ya tenia claro que si no tiene
  termino al menos en la presentacion del producto, este no muestra o no mostrar el valor de una
  sola sesion».
  → **Regla cerrada, con dos superficies separadas:** (1) **presentación / selector de variaciones**:
  **nunca** fabricar un término «1 sesión»; si no existe, se muestran solo los términos reales y **no
  se muestra precio de sesión suelta** (y sin término unitario **no hay badge `−%`**, porque falta la
  referencia). (2) **reserva de una sesión suelta**: ahí sí aplica la regla del backend (`services.price`
  cuando no hay término de 1 sesión) — es precio de venta, no algo que la ficha exhiba. El front ya
  arma el selector solo con términos reales; falta **ocultar** el select cuando `variations: []`
  (hoy queda deshabilitado con «Sin variaciones») — solo presentación, al cablear T2.

  **Dato nuevo del sitio local** (`kinesilk-tema.develop`, alcanzable vía interop de Windows porque
  WSL→Windows está bloqueado por firewall): el local está **desactualizado** vs producción —
  **31 productos: 28 simple, 1 variable, 1 external, 1 grouped**, contra **24 (15 simple, 9 variable)**
  en producción. El único variable local es `2793 "Tatuaje de hasta 3cm"` con términos **3 y 6
  sesiones (sin 1 sesión)** y un atributo custom `sesiones: "1"` huérfano. **La migración debe salir
  de producción, no del local.**
- **L13 (2026-11-04, verbatim del mantenedor):** «atencion, lo que te confirme es el comportamiento
  en wordpress, puede que de nuestro lado como bookwise el cliente ya haya creado un producto sin
  pensar en las variaciones, nosotros si deberiamos asegurarnos de que en el caso que es una sesion
  el valor corresponde a si mismo, con o sin variacion de 1 sesion, cuando hagamos un exportador
  para wordpress en el formato que este puede leer para hacer carga masiva de productos ahi si
  seria importante que introduzcas el termino, te diria que busques en internet como es esa posible
  carga y tenerla considerada para carga masiva de catalogo mas adelante con estas caracteristicas
  de variacion y todo mas».
  → Se separó **§7** en el documento con la regla de tres capas (presentación Woo / modelo Bookwise /
  exportador) y la investigación del formato oficial de carga masiva. **T8 (exportador CSV a Woo)
  agregada como tarea futura, no implementada.** Hallazgos: un solo CSV con padre `variable` antes
  que sus variaciones `variation` + `Parent` por SKU/`id:`; `Regular price` = `compare_at_price` y
  `Sale price` = `price`; `meta:` no acepta serializado (no se puede escribir `_product_attributes`);
  `Attribute N global = 1` exige que `pa_sesiones` ya exista; **los IDs de término no son portables**
  (65/66 en prod vs 64/65 en local) y el local **no tiene** el término `1-sesion`.
- **L14 (2026-11-04, diseño del exportador):** a pedido del mantenedor («podrias tomar lo que hay y
  ver donde queda el exportador de catalogo como un boton?») se **extendió** `design/productos-packs/`
  con `04-mantenedor-exportador.html` y `05-dialogo-exportacion.html`, en vez de crear un design
  nuevo: el mantenedor ya existe y `02-lista-tarjetas.html` es el artboard elegido. El exportador
  quedó como **acción secundaria del título** con menú de alcance, más una barra de estado de
  sincronización y el estado por servicio al pie de cada tarjeta; el diálogo muestra **validación
  previa + vista previa de las filas del CSV**. Canvas:
  `http://127.0.0.1:45401/…/d/productos-packs/`. **Sin implementar** (sigue siendo T8).
- **L15 (2026-11-04, cierre del backend):** el backend confirmó que **el punto de variaciones cierra sin
  cambios de su lado**: (1) la separación presentación vs reserva **ya está implementada así** —
  `services.price` se materializa desde el término «1 sesión» ACTIVO si existe y si no conserva su
  valor almacenado (**S15**), y es precio de venta en la reserva, no algo que la ficha exhiba;
  `variations: []` es válido (**S18**, producto simple). (2) El badge `discount_percent` sale de
  `compare_at_price` **explícito** (**S10**), nunca del precio del término unitario, así que la regla
  «sin término 1 sesión no hay badge contra referencia unitaria» **se cumple por construcción**.
  (3) Fuente de verdad para la migración = **producción** (`kinesilk.cl`, Store API), no el local
  (1 variable vs 9) ni el dump; `wc_variation_id` y `sku` **ya existen como columnas nullable** listas
  para ese sync. **No hay nada más que verificar.** Con esto el bloque 3 queda cerrado del lado del
  contrato: T2 (modelos + CRUD + imagen + variaciones) se desbloquea cuando ellos desplieguen, y T8
  (exportador CSV) queda como tarea futura ya especificada en §7.
- **L16 (2026-11-04, handoff del artboard 04):** implementado el **exportador de catálogo** en el
  mantenedor real (`/admin/packs`), como **una unidad sin backend**: el CSV se genera en el cliente
  desde `ReferenceStore`, así que no depende del deploy del bloque 3.

  **Nuevo**: `services-export.util.ts` (`buildWooRows`, `buildWooCsv`, `wooTermLabel`,
  `serviceFingerprint`, `WOO_CSV_COLUMNS`), `services-export.store.ts` (historial en
  `localStorage` `bw:services:export:{userId}:{tenantId}`: `lastExportAt` + huellas por servicio;
  `stateFor` → `new|changed|synced`; `counts`). **Extendido**: `packs-list.component.{ts,html,scss}`
  con botón `Exportar a Woo` (menú de alcance: todo / solo los que cambiaron / los seleccionados),
  barra de sincronización, filtro `Woo:`, selección múltiple en tarjetas y en la vista de lista,
  barra de selección y estado por servicio. i18n `packs.export.*`, `packs.sync.*`, `packs.select.*`,
  `packs.woo.*` en es/en **sin voseo**.

  **Decisiones registradas**: SKU `svc-{id}` y `svc-{id}-{totalSessions}`; etiqueta canónica
  `1 sesion` / `{n} sesiones`; `Sale price` **siempre vacío** (no hay `compare_at_price`, §7.2.6);
  precio en `Regular price`; un servicio sin términos activos se exporta `simple`; `recordExport`
  **mezcla** huellas para no perder el estado en lotes parciales; «cambiaron» = `changed + never`;
  el aviso «sin término 1 sesión» solo aparece si hay términos activos y ninguno de 1 sesión.
  **Corregido en revisión**: la fila `variation` llevaba el `Name` del padre; ahora es
  `{servicio} - {término}` (nombre único por fila, como pide el paso 5 del importador).

  **Evidencia**: tests enfocados **42 passed** (13+1 util, 5 store, 23 componente + 1 ajeno);
  `npm run build` verde; **0 literales de color nuevos** en el SCSS. Warning nuevo (no error):
  `packs-list.component.scss` 14,43 kB vs budget 12 kB — el repo ya tiene otro componente por encima.
  **Fuera de alcance declarado**: el diálogo del artboard 05 (queda como **T9**), las columnas
  `Images`/`Stock` del schema, y «Ver historial» (no hay backend de historial).
- **L17 (2026-11-04, comentarios de canvas `phkx8gpu` / `1s55hzmb` / `6hh3vhq5`):** se aplicaron los
  tres comentarios al diseño y se implementaron **dos unidades chicas** en el mantenedor.

  **Diseño.** `04-mantenedor-exportador.html`: afordancia de imagen `.img-btn` (icono de cámara +
  «Cambiar imagen») en la **esquina inferior izquierda** del media — las otras tres están ocupadas
  (badge `−%`, casillero, duración) — **siempre visible** porque en touch no hay hover; el servicio
  sin imagen muestra «Agregar imagen». Se eligió icono explícito y no «click en toda la imagen»
  porque ese click debe abrir el servicio. `01-lista-tabla.html`: el **precio de lista tachado**
  ahora aparece también en el chip de la fila colapsada (`~~$75.000~~ $67.500 −10%`), no solo en la
  columna de la sub-fila, y se agregó un **frame de dispositivo de 390 px** con la spec mobile de la
  lista (tarjetas apiladas, términos en filas, acciones al pie).

  **Implementado (sin commit).**
  1. **Afordancia de imagen** en las tarjetas: `.sp-media__image-btn`, **deshabilitada** con
     `title`/`aria-label` (`packs.image.*` en es/en) porque el backend **no expone**
     `POST /services/{id}/image` ni `image_url` en el servicio. No se simula una acción que fallaría.
     Spec nueva que lo verifica (presente, `disabled`, con razón accesible).
  2. **Vista de lista en mobile (≤767px)**: `thead` oculto, cada `tr` es un bloque apilado con
     `padding-left` para anclar los controles (casillero + desplegable) a la izquierda, `data-label`
     en las celdas de precio base y estado, y la sub-fila de términos pasa a una línea legible por
     término. También `flex-wrap` en `.sp-sync` y `.sp-selbar`.

  **Refactor obligado por el budget**: `packs-list.component.scss` había llegado a **16,47 kB** y
  rompía el build (`anyComponentStyle` error a 15 kB). Se partió en cuatro archivos declarados en
  `styleUrls`: `packs-list.component.scss` (10,34 kB) · `packs-list-table.scss` (4,24 kB) ·
  `packs-list-export.scss` (7,62 kB) · `packs-list-mobile.scss` (2,74 kB). Build **verde y sin el
  warning** de ese componente.

  **Evidencia**: **43 tests** enfocados verdes (24 de `packs-list.component.spec` + 14 util + 5
  store); `npm run build` verde; 0 literales de color nuevos.
- **L18 (2026-11-04, contrato U3/U4 cerrado + bug del envelope):** el backend confirmó el contrato
  final de services/packs commiteado en `feat/services-crud-variations` (**aún sin merge a dev**):
  `GET /services` con envelope `{data, links, meta}`, **`per_page` por defecto 15**, filtros
  `search`/`status`/`active`; `POST`/`PATCH` con `variations[]` (`{id?, term, total_sessions, price,
  compare_at_price?, sku?, active?}`, sync por `id`, ausentes soft-delete); `DELETE ?force=true`;
  `POST /services/{id}/image` → `{image_url, image_thumb_url}` público-relativos. `name` de la
  variación se sirve ya formado. Códigos: 422 `service_status_invalid`,
  `service_status_transition_invalid`, `pack_discount_invalid`, `variation_not_found` (nuevo),
  `image_processing_failed` (nuevo), `service_not_available`; 409 `service_in_use`;
  501 `image_processing_unavailable`.

  **Bug encontrado y corregido en el front** (rompía la agenda): `ServicesApiService.getServices()`
  hacía `http.get<Service[]>` y devolvía el body tal cual. Al pasar el backend a devolver el
  **envelope**, `ReferenceStore.services` quedó con un objeto en vez de un array y la agenda explotaba
  con `this.refStore.services(...).filter is not a function` en `booking-form-dialog:169`. Ahora usa
  `collectPaginatedPages<Service>` (el helper que ya consumen clients/providers/locations), que
  **desenvuelve el envelope, agrega todas las páginas y sigue tolerando el array plano** mientras
  dev no tenga el deploy. Specs: 2 casos (envelope multi-página + array plano legacy) → 6/6 verdes.
  **Lección**: cualquier endpoint que migre a envelope `{data, links, meta}` sin paginar en el front
  deja el `ReferenceStore` con la forma equivocada y rompe todos sus consumidores a la vez.
- **L19 (2026-11-04, T4 implementado):** el diálogo de servicio quedó cableado al contrato real
  (L18) y reemplaza el aviso de solo lectura: `+ Nuevo servicio` y `Editar` (tarjeta y fila) abren
  `bw-service-form-dialog`. Decisiones: `active` es **espejo derivado de `status`** (badge read-only)
  para no poder mandar `draft` + `active:true`; transiciones ofrecidas según estado actual
  (`draft→[draft,active]`, `active→[active,inactive]`, `inactive→[active,inactive]`); término
  sugerido (`1 sesion` / `{n} sesiones`) **nunca auto-aplicado**; imagen se sube **después** de
  guardar (el endpoint necesita el `id`) y en alta el selector queda deshabilitado; al guardar se
  invalidan **`services` y `packs`** (las tarjetas derivan términos de `service_packs`).
  **Evidencia:** 37 tests verdes (packs-list 26 + diálogo 11) y build verde; SCSS del diálogo 8 kB,
  sin partir. **Fuera de alcance declarado:** escalera de volumen, vista previa con selector de
  término, `wc_product_id` y borrado de servicio.

