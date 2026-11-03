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
6. La vista previa tiene un **selector de término** (para Kinesilk, Sesiones: 1 / 3 / 6): el badge
   `−X%`, el precio, el precio de lista tachado y el precio por sesión siguen al **término elegido**.
   La imagen es la misma para todos (una por servicio). Un término sin precio de lista se previsualiza
   **sin badge**.
7. Avisos (no bloqueantes): término sin precio; precio por sesión mayor que el del término de menos
   sesiones; falta el término de 1 sesión si se quiere vender individual.
8. Al guardar se envían **valores absolutos**; el backend revalida (`compare_at_price > price`, 422
   si no) y calcula `discount_percent`.

### Coordinación con el catálogo de WordPress (pendiente, no bloquea el diseño)

Los términos son los mismos que el negocio ya vende en el catálogo de su WordPress
(subdominio del cliente): el backend ya tiene `services.wc_product_id`, y más adelante esto puede
venir de una **carga masiva** en vez de carga manual una por una. Por eso el precio de lista se
modela como dato de entrada, no como regla de promoción.

---

## 4. Agenda: cómo se ve "sesión 3 de 6"

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
| T4 | Diálogo de servicio con términos + escalera de descuento por volumen opcional (vacía por defecto) + validaciones | T2, T3 | diálogo + specs (precio por sesión y escalera son lógica pura → testeable) |
| T5 | Quick-create del form de reserva adaptada al `POST /services` real (sin romper el flujo) | T2 | fix + manejo de 405 mientras no exista |
| T6 | Agenda: `client_pack_id` + selector de sesión "N de M" | contrato 2.6 | form de reserva + badge en el evento |
| T7 | Retirar la tabla plana de packs del catálogo (los packs pasan a ser términos) | seeds + contrato 2.3 | `/admin/packs` sin la columna huérfana |

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
4. **Permisos `services.*` / `service_packs.*` y el orden del gating — PENDIENTE (2026-11-03).**
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
