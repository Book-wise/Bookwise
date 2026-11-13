# Ficha (pestaña del diálogo de reserva)

Diseño: `design/ficha-medica/` (4 artboards) y `design/config-tipos-ficha/` (4 artboards, F2).
Implementación empezada el 2026-11-03.
Estado (2026-11-12): F1-F11 cerradas en código. Verificación de E2E del dominio clínico **pendiente**
(el backend #97 mergeó el 2026-11-12 y era el desbloqueo que pedía L23).

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
- **S4 (seba, verbatim):** «bien si diseñaste algo pero lo importante en realidad es que la imagen se
  puede guardar y luego descargar y que tenga el enlace de descarga o visualizacion de la imagen en el
  pdf, cosa de poder verlo directamente, y que al revisar la ficha tambien le de el enlace para la
  imagen, me di cuenta que tenemos que poder usar un campo de imagen en lo del formulario que se añade
  en ficha» — los campos de la ficha necesitan un tipo **`image`**: subir/guardar la imagen, mostrar un
  enlace de descarga/visualización en el detalle de la ficha, e incluir la imagen o su enlace en el
  PDF generado.
- **S14 (seba, verbatim):** «en el frontende del tab fichas en admin/configuraciones: necesitamos implementar
  las opciones del select: Error de validación — Guardar cambios / Un campo select requiere opciones.
  levantemos un design para eso?» — el editor de campos **no tiene editor de `options`** (nunca lo tuvo,
  ni para `select`), así que un campo `select` no se puede guardar: la API responde con error de
  validación. Hace falta agregar la captura de opciones en el constructor de campos.

## Lo que existe hoy en el producto

- La pestaña **Ficha** ya estaba en `booking-detail-dialog` (6 tabs; en mobile quedan
  `reserva, pago, ficha`) y mostraba un placeholder hardcodeado: «Ficha médica próximamente».
- **No hay dominio clínico en el backend**: no existen `clinical_records` ni
  `clinical_record_types`. `clients` solo tiene `notes`.

## Tasks

| # | Tarea | Estado | Commit |
|---|---|---|---|
| F1 | Pestaña Ficha presentacional: fichas de la reserva + historial + CTA de tipos, con estados vacíos honestos | ✅ hecho | `feat(bookings)` de esta sesión |
| F2 | Configuraciones con pestañas + «Fichas médicas» (lista de tipos + editor de campos) | ✅ hecho | — |
| F3 | Detalle de la ficha detrás de «Ver más detalles» (campos por tipo) | ✅ hecho | `df81d8d` |
| F4 | Contrato backend del dominio clínico (ver abajo) | ✅ hecho | `docs/clinical-records-contract.md` |
| F5 | Servicios API clínicos (`clinical-record-types-api`, `clinical-records-api`) + mapeo de shapes | ✅ hecho | — |
| F6 | `ClinicalRecordTypesStore` por HTTP (load/create/update) | ✅ hecho | — |
| F7 | `ClinicalRecordsStore` por HTTP (loadByClient/create) | ✅ hecho | — |
| F8 | Cablear componentes (diálogo, ficha-tab, form, configuraciones) | ✅ hecho | — |
| F9 | i18n/UX (loading/error/saving, quitar «Sin guardar») | ✅ hecho | — |
| F11 | Editor de `options` para campos `select` en el constructor de tipos (Configuraciones → Fichas) | ✅ hecho | `f4b3ade` (contrato), `c5f7f4b` (diseño), `6b2ea17` |
| F10 | Campo de tipo `image` en la ficha: subir/guardar imagen + enlace en el detalle + enlace/imagen en el PDF | ✅ hecho | `a79aab6`, `07e3d7c` (guarda del ref del servidor) |
- **S15 (seba, verbatim, comentario de canvas sobre el artboard 01 de `design/ficha-tipo-opciones/`):**
  «implementa esto para las opciones» — dirección elegida: **la fila se expande y muestra chips**. Al
  elegir `select` en una fila, debajo aparece el capturador de opciones: **chips removibles** (✕ por
  chip) + input «Agregar opción» donde **Enter agrega** y **Backspace en un campo vacío borra la
  última**. Un contador «N opciones» cierra el bloque. Todo tokenizado, en los tres temas.
- **S16 (seba, verbatim):** «tambien puedes revisar una especie de bug, cuando modifico o el primero o
  el segundo elemento de los campos de la ficha se cambian los dos a la vez, corrijelo» — al editar un
  campo del constructor de tipos se modificaban **dos filas a la vez**. Causa: `makeFieldKey()` usa un
  contador de módulo (`field_1`, `field_2`…) que no se siembra con los campos del tipo cargado, así que
  agregar un campo a un tipo de la API (que ya trae `field_1`) produce **claves duplicadas**, y los
  `update*` buscaban por clave y actualizaban todas las coincidencias. Fix: actualizar **por índice** y
  generar claves **sin colisión** contra los campos existentes.
- **S17 (contrato confirmado por el backend, 2026-11-10):** para un campo `select`, `options` es un
  **array de strings** (no `{label, value}`), **no vacío**: `options: []` equivale a ausente y da 422. El
  error del backend llega ubicado en **`fields.<índice>.options`** (índice del array `fields`, no la
  `key`). `select` es de **selección simple**: `values[campo]` es **un** string validado con `in_array`
  estricto. Por eso, si el usuario borra todos los chips, el **guardado se bloquea en el formulario**
  con el mensaje en ese campo, en vez de dejar reventar el 422.
  Sobre `isNew`: usar `!Number.isInteger(draft.id) || draft.id < 0` (más explícito que `isFinite`); del
  lado API el id es siempre entero positivo (`bigserial`).

## Contrato backend (confirmado — `docs/clinical-records-contract.md`)

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
- **L3 (2026-11-03):** pedido del mantenedor para F2: un gentle-design propio para
  `/admin/configuraciones` que integre la lista de creación/edición de fichas médicas, que son las
  que después se cargan en el selector de fichas de la agenda. Diseño: `design/config-tipos-ficha/`
  con 4 artboards — `01-config-seccion-dialogo.html` (catálogo como tarjeta de Configuraciones +
  diálogo con el constructor de campos), `02-maestro-detalle-builder.html` (pantalla propia
  maestro-detalle con vista previa del formulario), `03-config-acordeon-tarjetas.html` (tarjetas
  expandibles sin salir de Configuraciones) y `04-selector-en-agenda.html` (consumo del catálogo en
  el desplegable de la pestaña Ficha; no es una dirección). Los cuatro usan los tokens de
  `design/system.md` y los datos canónicos del catálogo (5 tipos, 4 activos, 6 campos de la
  evaluación kinésica). Aún no hay artboard elegido.
- **L4 (2026-11-04, comentarios del mantenedor en el canvas):** se aplicaron tres comentarios al
  artboard `02-maestro-detalle-builder.html`: (1) lista de tipos más simple y jerárquica — nombre,
  «N campos · usada en N fichas» y estado como punto + texto en vez de chips; (2) se conserva
  «Usada en N fichas» en la cabecera del editor; (3) el editor muestra los valores contenidos de
  cada campo (nombre editable, tipo, obligatorio) y la única acción por fila es borrar el campo; se
  eliminó la columna de vista previa. Referencia visual del mantenedor: patrón de fichas médicas de
  AgendaPro, sin copiarlo (sin categorías ni «Incompleta/Completa»).
- **L5 (2026-11-04, handoff del artboard 02):** implementado `design/config-tipos-ficha/02-maestro-detalle-builder.html` (artboard elegido). `ConfiguracionesComponent` pasó de grilla de cards a `p-tabs` (Perfil, Apariencia, Negocio principal, Feriados, Fichas médicas — las 3 últimas admin-only). Nueva pestaña `bw-clinical-record-types` (maestro-detalle: lista de tipos + editor de campos) con `ClinicalRecordTypesStore` (signalStore in-memory; arranca vacío porque el backend no expone `clinical_record_types` — contrato F4). Dominio clínico movido a `@models/clinical-record` con `ClinicalRecordType.fields: ClinicalRecordField[]` (`key`, `label`, `type`, `required`, `options`). i18n `settings.clinical_types.*` (es/en). Tests: 16 nuevos (store + componente) + spec de Configuraciones ajustado (stub `ResizeObserver` para `p-tabs`). `npm run build` verde; el suite completo deja 6 fallos pre-existentes ajenos a F2 (calendar-navigation, booking-form-dialog, historial-reserva — ninguno referencia los módulos tocados). Sin commit: el handoff no commitea.
- **L6 (2026-11-04, contrato clínico CONFIRMADO por el backend):** respondieron las tres preguntas y
  el contrato queda cerrado para el catálogo (arrancan por ahí y siguen con `clinical_records`).

  **Decisiones confirmadas:** `fields` va como **columna JSON** en `clinical_record_types` (el editor
  manda el set completo, igual que `variations[]`); **solo `active` (boolean)**, sin `status`/draft
  — el artboard Activa/Inactiva queda tal cual y **no existe** `clinical_record_type_transition_invalid`;
  **profesional** puede crear fichas de sus propias reservas y leer solo las de sus pacientes
  (boundary por `provider_id` del booking + `client_id`), admin ve todo el tenant, recepción sin
  acceso por defecto.

  **Ajustes que no cambian el wire:** **no hay columna `tenant_id`** (database-per-tenant, ADR-0001:
  el tenant ES la BD); `created_by` sí existe como referencia lógica a `users` de CORE.
  `clinical_record_type_in_use` responde **409** (consistente con `service_in_use`), no 422.
  Permisos: `clinical.view`, `clinical.manage`, `clinical_types.manage`, a cablear **después** de
  `permissions:apply-baseline`.

  **Códigos finales:** 409 `clinical_record_type_in_use` · 422 `clinical_record_values_invalid`
  (con detalle por `key` de campo) · 422 `clinical_record_type_not_found`.

  **Pendiente de su respuesta (2 puntos abiertos):** (1) `ClinicalRecordResource` debe incluir
  **`author_name` denormalizado** — el front no puede resolver `created_by` contra `users` de CORE,
  y la tarjeta del historial muestra «quién lo registró»; (2) confirmar si entran **`sort_order`** y
  **`description`** en el tipo (el front ya los modela; el orden importa para el desplegable y la
  descripción se muestra bajo el título).

  **Estado del front:** catálogo y editor de campos ya construidos (UI completa) funcionando con un
  store **en memoria de sesión**; la pestaña Ficha recibe colecciones vacías. Cuando el catálogo esté
  commiteado se reemplaza el store por las llamadas reales sin tocar la UI.
- **L7 (2026-11-04, «Agregar tipo de ficha» + formulario, catálogo en memoria):** pedido del
  mantenedor: el botón de la pestaña Ficha pasa a decir **«Agregar tipo de ficha»**, despliega el
  **selector con los tipos activos del catálogo** y, al elegir uno, **abre el formulario con las
  preguntas que ese tipo define**.

  **Implementado:** `bw-record-form-dialog` (`tabs/ficha/record-form-dialog/`) con `p-dialog` +
  Reactive Forms, que renderiza un control por `ClinicalRecordField.type` (`text` → input,
  `longtext` → textarea, `number` → number, `select` → `p-select` con `options`, `date` → date),
  exige los `required` y guarda en el store de sesión. El botón reusa el `p-menu` existente; con el
  catálogo vacío queda **deshabilitado** con hint y link «Configurar tipos» (se conserva el output
  `configureTypes`).

  **Stores promovidos a dominio** (recomendación del mantenedor): `clinical-record-types.store.ts`
  se movió a `src/app/core/stores/` y ahora es `signalStore({ providedIn: 'root' }, …)` (se quitó el
  `providers` de `ConfiguracionesComponent`); nuevo `clinical-records.store.ts` (root, **en memoria**,
  `create`/`byBooking`/`byClient` con `pendingSync: true`).

  **Honestidad de datos:** mientras no exista la API, los registros creados se marcan con el chip
  **«Sin guardar»** (`bw-chip--warning`) y el diálogo avisa que se guarda solo en la sesión.
  **Evidencia:** 45 tests verdes (ficha-tab + record-form-dialog + clinical-record-types +
  configuraciones + booking-detail-dialog) y `npm run build` verde.

  **Pendiente al llegar la API:** `ClinicalRecordTypesStore.load()/saveDraft()/removeField()` por
  HTTP; `ClinicalRecordsStore.create/byBooking/byClient` por HTTP; rellenar
  `author_name`/`created_by` desde el usuario autenticado; y que el padre
  `booking-detail-dialog` deje de pasar los inputs legacy `records`/`recordTypes`.
- **L8 (2026-11-04, los 3 abiertos resueltos, commit `792f711` en el backend):** (1)
  `ClinicalRecordResource` emite **`author_name`** ya resuelto (string nullable) vía relación
  `creator` sobre `created_by` → `users` de CORE, eager-loaded en list/show/store/update; **también
  sigue yendo `created_by`** (id) por si se usa para permisos → se agregó al modelo del front como
  opcional. (2) **`sort_order` y `description` sí van**, en `clinical_record_types`, aceptados en
  `POST`/`PATCH`; el listado ordena por `sort_order` y después `name`. (3) **El orden de `fields`
  se preserva** tal cual llega el array JSON: el editor manda el set completo en orden y así se sirve.

  Con esto el contrato clínico queda **completamente cerrado**; falta sólo su merge/deploy para
  reemplazar los stores en memoria por HTTP. **Preguntado:** si `GET /clinical-record-types` incluye
  `fields` por tipo en el listado (el editor de campos lo necesita; si no, sería N+1) y cuál es el
  `per_page` por defecto.
- **L9 (2026-11-10, cableado a la API):** la API clínica ya está en `origin/develop` de
  Bookwise-API (`79ef31d`); contrato cerrado en `docs/clinical-records-contract.md`. Se arranca el
  cableado en `feat/ficha-medica-api` (worktree `.worktrees/ficha-medica-api`): servicios API + stores
  por HTTP + componentes. F3 (detalle de ficha) queda **fuera de este cableado**: hay un WIP
  (`wip(ficha-medica)` en `feat/billing-wizard-steps`) que lo atiende.
- **L10 (2026-11-10, cableado completo):** F5–F9 implementados. Servicios API
  (`ClinicalRecordTypesApiService`, `ClinicalRecordsApiService`) + specs; `ClinicalRecordTypesStore`
  (load/saveDraft POST-PATCH) y `ClinicalRecordsStore` (loadByClient/create) por HTTP; `ClinicalRecord`
  normalizado (`client_id`, `values`, `title` desde `record_type.name`, sin `pendingSync`); componentes
  cableados (diálogo dispara load, ficha-tab lee history del store, record-form-dialog guarda async,
  catálogo con carga/error/reintentar); i18n actualizada (quitado «Sin guardar»). Evidencia: build
  verde y specs clínicos verdes (29 tests) más ficha/record-form-dialog/booking-detail-dialog verdes.
- **L11 (2026-11-10, merge a develop):** `feat/ficha-medica-api` rebaseada sobre `develop` (sin
  conflictos; lo único que le faltaba era `bccf25c`, docs de pack-sessions) y mergeada por
  fast-forward (`4d3caf4`). Verificación completa: `npm run build` verde; suite **1012 pass / 7 fail**,
  los 7 preexistentes y ajenos a ficha médica (calendar-navigation 1, historial-reserva 3,
  booking-form-dialog 2, booking-detail-dialog 1 por timeout de keep-alive). Único ítem abierto del
  dominio: **F3** (detalle de ficha tras «Ver más detalles»), que vive en el WIP `wip(ficha-medica)`
  de `feat/billing-wizard-steps`. Pendiente de deploy: `dev.bookwise.cl` no expone aún los endpoints
  clínicos (gate PHP 8.3.6 < 8.3.36, escalado a devops); el dev local (`127.0.0.1:9999`) sí los tiene.
- **L12 (2026-11-10, gentle-design del detalle inline):** el usuario pidió que F3 no abra un segundo
  diálogo, sino que el detalle quede inline dentro del mismo diálogo de reserva. Diseño
  `design/ficha-detalle-inline/` con 3 direcciones: `01-master-detalle.html` (el detalle reemplaza la
  lista con breadcrumb «volver»), `02-acordeon-inline.html` (la ficha se expande en su tarjeta) y
  `03-panel-lateral.html` (lista + detalle en dos columnas). El artboard elegido se implementará como
  F3, reemplazando el `record-detail-dialog` (p-dialog aparte) del WIP `3dd4d33`.
- **L13 (2026-11-10, campo de imagen en la ficha):** el usuario pidió un campo de tipo `image` en el
  formulario de ficha (S4): que la imagen se pueda subir y guardar, que el detalle de la ficha muestre
  un enlace de descarga/visualización, y que el PDF generado incluya la imagen o su enlace. Es un
  requisito nuevo sobre el contrato clínico cerrado: hoy `ClinicalRecordFieldType` es
  `text|longtext|number|select|date` y `values` es JSON plano. Falta definir el storage de imagen para
  clinical-records con Bookwise-API (el contrato L6 lo anticipó como «storage propio, mismo pedido que
  la imagen del servicio»).
- **L14 (2026-11-10, contrato F10 image decidido):** el backend confirmó el contrato de imagen y lo
  implementa en un PR. `fields[].type` acepta `image` (sin `options`; `required` no se evalúa en
  create/update). Subida `POST /clinical-records/{id}/image` (multipart `key`+`file`, jpeg|png|webp ≤10MB,
  dos tamaños, re-subir reemplaza). Lectura `GET /clinical-records/{id}/image/{key}` → binario con auth,
  **sin URL pública** (fetch+blob con Bearer para `<img>`). El detalle agrega `images` (rutas relativas);
  el listado no. PDF: `GET /clinical-records/{id}/pdf` (dompdf, embebe imágenes) — el front no arma el PDF.
  `values[key]` de un campo `image` es gestionado por el server (422 `clinical_record_image_managed`).
- **L15 (2026-11-10, decisión: sin enlaces de imagen en el PDF):** el usuario preguntó si conviene poner
  el enlace de la imagen dentro del PDF. **No.** El endpoint de imagen exige Bearer + `clinical.view`,
  y un PDF es portátil: lo abre Acrobat, se reenvía, se imprime; el lector no tiene sesión, así que el
  link daría 401/403 y quedaría inútil. Además, hacerlo público para que el link «funcione» sería una
  fuga de datos de salud por URL adivinable (en el ejemplo de S3 tenía sentido porque la URL era
  pública/firmada; acá no). **Regla**: en el PDF las imágenes van **embebidas** por la API (dompdf reads
  del disco privado) y **sin links**; el enlace «Ver/Descargar imagen» vive sólo en la app autenticada
  (`fetch`+blob con Bearer). Si alguna vez se quieren links compartibles, la vía es
  `temporarySignedRoute` (URL firmada de vida corta), no un endpoint público: otro contrato.
- **L16 (2026-11-10, F3 implementada — handoff de `design/ficha-detalle-inline/01-master-detalle.html`):**
  `bw-record-detail` (nuevo, inline, sin `p-dialog`) reemplaza la lista dentro de la misma pestaña. Modo
  lectura: breadcrumb «‹ Volver a las fichas» + «Editar ficha»/«Imprimir ficha», tarjeta con título en
  mayúsculas, meta (fecha · autor) y `dl` sólo con campos con valor. Modo edición: el mismo Reactive Forms
  dinámico del diálogo de captura (helpers compartidos `record-form-fields.ts` + `record-format.ts`),
  cabecera reducida a «‹ Volver» y «Guardar cambios»/«Cancelar» al pie; Guardar hace
  `ClinicalRecordsStore.update` (PATCH `values`) y vuelve a lectura. `openRecord` (output viejo) eliminado.
  Evidencia: `ng build` verde; **29 tests verdes** (ficha-tab 11, record-detail 10, store 2,
  record-form-dialog 6 de PRESERVE por el helper compartido) + booking-detail-dialog 12. Commits:
  `044b152` (diseño + contrato F10) y `df81d8d` (implementación). Desvíos conscientes: (a) sin `.bw-chip`
  «Sesión N de M» porque `ClinicalRecord` no lo trae (no se inventó dato); (b) si el tipo no está en el
  catálogo, se muestran las claves crudas y «Editar ficha» queda deshabilitado; (c) «Imprimir ficha»
  sigue con `window.print()` + TODO de `GET /clinical-records/{id}/pdf` hasta F10.

- **L17 (2026-11-10, contrato F10 implementado en el backend — PR #95):** `Book-wise/Bookwise-API#95`
  (`feat/clinical-record-images`) abre el contrato acordado en L14: tipo `image` sin `options` con
  `required` no evaluado, `POST /clinical-records/{id}/image` (multipart `key`+`file`, `clinical.manage`
  + scoping), `GET .../image/{key}` (`clinical.view`, `Cache-Control: private, no-store`),
  `GET .../pdf` (imágenes embebidas, sin links) y `images` sólo en el detalle. Verificado: 13 tests del
  feature (89 assertions), suites clínicas 34 verdes, Pint OK.
  **Dos detalles que condicionan el front:** (1) `images[key]` viene **`null`**, no omitido, cuando el
  campo existe sin subir nada → señal de «sin imagen» sin llamar al endpoint; (2) la descarga responde
  **404 (no 403)** cuando la ficha no es visible (mismo criterio que `GET /clinical-records/{id}`) →
  el front trata 404 como «no hay imagen»; el **403 sólo aparece al subir** sobre un paciente que no es
  tuyo → se trata como «no aplica», no como error técnico.
  El backend además cerró un agujero de su propia revisión: la descarga aceptaba cualquier clave y podía
  apuntar a una ruta arbitraria del disco; ahora sólo sirve claves declaradas `image` y rutas bajo
  `clinical/` sin `..`, con test que falla si se quita la guarda.
- **L18 (2026-11-10, F10 implementada — handoff de `design/ficha-detalle-inline/01-master-detalle.html`):** cableado
  completo contra el contrato de #95, sin esperar el merge. Modelo: `ClinicalRecordFieldType` suma `'image'` y
  `ClinicalRecord.images`. API: `uploadImage(id, key, file)` (multipart `key`+`file`), `getImageBlob(id, key)` y
  `getPdf(id)` (`responseType: 'blob'`), con `images` en la normalización. Store: `uploadImage` con el helper
  `replaceRecord` compartido con `update`. `buildRecordForm` **omite** los campos `image`, así que `values` nunca
  lleva una clave de imagen (evita el 422 `clinical_record_image_managed`). Detalle: lectura por blob +
  object URL (revocada al destruir y al cambiar de ficha), «Ver imagen»/«Descargar», estado «Sin imagen» para
  path `null`/ausente/404, subida inmediata en edición con tope de 10 MB inline y 403 como aviso neutro;
  «Imprimir ficha» pide el PDF y abre el blob (fallback `window.print`). Captura: el campo `image` es una nota
  «se agrega después de guardar», sin control. Configuraciones: `image` en `FIELD_TYPES` y «No aplica» en
  `required`. Evidencia TDD (RED en árbol base → GREEN): 12 + 7 + 4 + 19 + 7 + 11 = **60 tests verdes**, más
  `ng build` verde. Commit `a79aab6`.
  **Pendiente propuesto (fuera de las superficies del worker):** `ClinicalRecordTypesStore.updateFieldType`
  debería limpiar `options` cuando el tipo deja de ser `select`; hoy cambiar `select` → `image` deja el array
  `options` viejo en el payload. No hay verificación E2E posible hasta que mergee #95.
- **L19 (2026-11-10, mini calendario del sidebar en mobile):** el usuario reportó que en el drawer mobile no se
  veía el `bw-agenda-navigator`. Causa: el template lo renderizaba con `@if (!isMobile() && !effectivelyCollapsed())`
  y `isMobile()` es `innerWidth < 992`, así que en mobile **no se montaba nunca**. Cambiado a
  `@if (!effectivelyCollapsed() && (!isMobile() || mobileMenuOpen()))`: en mobile se monta sólo con el drawer
  abierto; en desktop queda igual. Segundo problema: `.sidebar` es flex column con `overflow: hidden` y sólo
  `.sidebar-nav` scrolleaba (`flex: 1`), así que al entrar el widget en un viewport corto header + nav + widget
  + footer no entraban y el widget quedaba recortado. En el drawer ahora scrollea el sidebar completo y la nav
  pasa a `flex: 0 0 auto`. Sin spec del layout (no existe `admin-layout.component.spec.ts`): verificación por
  build + revisión visual. Commit `2c5ff93`.
- **L20 (2026-11-10, #95 mergeado — F10 desbloqueada para E2E):** Bookwise-API mergeó
  `feat/clinical-record-images` en `develop` (`82565ea`); las rutas `GET .../image/{key}`,
  `POST .../image` y `GET .../pdf` ya están en `routes/api.php`. Los dos detalles del contrato que
  condicionan el front siguen vigentes (`images[key]` = `null` sin subir; descarga 404 = no visible,
  403 sólo al subir). **Limitación conocida confirmada por el mantenedor:** las fichas **no se
  restauran**, así que el soft delete borra también los archivos de imagen; si algún día el front
  ofrece «restaurar ficha», la ficha vuelve **sin imágenes** y hay que decirlo en la UI.
  Nota de entorno: un probe sin token a `127.0.0.1:9999/api/v1/clinical-records` devolvió **500**, no
  401 — probablemente falten las migraciones del feature en la BD local o el token; a verificar por
  el lado del backend antes del E2E.
- **L21 (2026-11-10, E2E real contra el backend local + bug encontrado):** con el BE levantado hice el
  E2E del contrato con curl (login `admin@kinesilk.cl`, tenant Kinesilk). **Confirmado**: `images[key]`
  = `null` antes de subir; `POST /clinical-records` sin la clave image → 201; mandar `values[key]` de un
  campo image → **422 `clinical_record_image_managed`**; key inválida → **422
  `clinical_record_image_key_invalid`**; multipart `key`+`file` → 200; `GET .../image/{key}` → 200 con
  `Cache-Control: no-store, private`; `author_name` resuelto.
  **Hallazgos**: (1) la API **sí escribe** `values[key] = { full, thumb }` con rutas internas del disco
  cuando la imagen se subió — el front pintaba **`[object Object]`** en el detalle; **corregido** con
  test RED→GREEN (los campos `image` se excluyen de `visibleFields` y `hasValue` descarta objetos).
  (2) `POST /clinical-records` (create) devuelve `images: null`, no el mapa como el detalle.
  (3) La descarga sirve la versión **optimizada webp** (subí PNG de 70 KB, bajó 11,5 KB webp).
  (4) Cualquier request sin token devuelve **500 `Route [login] not defined`** en vez de 401 (no es del
  dominio clínico; me hizo creer que faltaban migraciones). Los cuatro puntos se reportaron al backend.
- **L22 (2026-11-10, F11: opciones de `select`):** el editor de campos de Configuraciones **nunca tuvo**
  editor de `options`, así que un campo `select` no se puede guardar (la API responde «Un campo select
  requiere opciones»). Diseño `design/ficha-tipo-opciones/` con 3 direcciones: `01-fila-expandible-chips`
  (la fila crece y muestra chips), `02-textarea-una-por-linea` (textarea, una por línea) y
  `03-popover-por-campo` (botón «Opciones (N)» que abre un popover con la lista editable). Sin artboard
  elegido todavía.
- **L23 (2026-11-10, PR #97 del backend cierra los 4 hallazgos del E2E):** (1) las claves `image` **dejan
  de aparecer en `values`** — `images` queda como única fuente de verdad, así que `values` sólo trae
  campos normales; se descartó `image_refs` por el mismo motivo (dos fuentes = el problema). (2) `POST` y
  `PATCH` devuelven **las mismas claves que el detalle**, `images` incluido (el listado sigue sin él, S4),
  con un test que compara las formas para que no vuelvan a divergir. (3) el **500 `Route [login] not
  defined`** era un bug pre-existente: sin `Authorization` **ni `Accept: application/json`** el guard
  intentaba redirigir a la ruta web `login`; ahora el render de `AuthenticationException` devuelve
  **401 JSON siempre**. (4) la descarga optimizada (webp ≤1600 px, sin endpoint de original) es **lo
  esperado**; nombrar la descarga por el mime del blob es correcto.
  **Consecuencia en el front:** el filtro de `record-detail` (excluir campos `image` de `visibleFields` y
  descartar objetos en `hasValue`) **se queda** como guarda defensiva: funciona con el contrato viejo y
  con el nuevo, y expresa la intención (una imagen no es un campo de texto). El test se reescribió para
  decir que protege la forma pre-#97. Pendiente: **rehacer el E2E** cuando #97 esté mergeado.
- **L24 (2026-11-10, #96 mergeado):** `Route::pattern('id', '[0-9]+')` en las **54 rutas** (`b18899a`, CI
  Unit 36 + Postgres 1261/6693). `PATCH /clinical-record-types/undefined` ahora es **404**, no 500, y el
  comportamiento queda distinguible: **404** = el id no existe / no es válido; **422** = validación del
  payload. Sirve de red de seguridad para el bug del `isNew` mientras se aplica el fix del front.
  #97 sigue abierto (CI); el E2E completo se rehace cuando mergee.
- **L25 (2026-11-12, cierre administrativo de F10/F11 y desbloqueo del E2E):** la tabla de tareas
  estaba atrasada respecto del código: **F11** está implementado en `6b2ea17` (chips por fila sobre el
  contrato de `f4b3ade`, dirección de `c5f7f4b`) y **F10** en `a79aab6` más la guarda de
  `07e3d7c`. El pendiente real de L23 se desbloqueó: el **PR #97 del backend mergeó el 2026-11-12**,
  así que **rehacer el E2E del dominio clínico** contra el contrato nuevo sigue abierto como verificación
  (no como código). El front no cambió por ese merge: la guarda defensiva de `record-detail` se queda.
  **Decisión de entrega (usuario, verbatim):** «arranca el PR actualiza los docs y pushea la rama luego
  los slices, dale» — PR de suite primero (PR #47), después slices encadenados: fixes sales/historial,
  clinical API, F3+F10, F11, sidebar, billing.
