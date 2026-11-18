# Mantenedores de profesionales y sucursales (CRUD + RBAC por acción)

Implementar los **mantenedores** de profesionales y sucursales: crear y modificar desde sus
vistas y diálogos, mostrar el resultado y las consecuencias de cada acción, y gatear cada
acción por permiso (inicialmente solo administradores).

## Estado al cerrar (2026-10-27) — IMPLEMENTADO Y VERDE

- Árbol limpio; commits `c2c55ed` (fix del listado paginado) y `8021fb9` (mantenedores).
- `ng build` verde; `ng test` **728 pass / 6 fail** (los 6 preexistentes y ajenos).
- `booking-detail-dialog` aparecía como 7º fallo bajo carga paralela. **Corrección posterior**: en
  esta máquina falla también **aislado** (9/11) y falla igual en un worktree limpio sobre `ad3b7be`
  sin los cambios de la segunda tanda, así que es **preexistente y ajeno**, no flakiness de carga
  ni regresión de este trabajo.
- **Pusheado** a `origin/feat/contract-catchup` (`5aebf50..ad3b7be`) el 2026-10-27, por decisión
  del usuario.

## Cierre de pendientes (2026-10-27, sesión 2)

Segunda tanda sobre el mismo feature: corregir los 3 hallazgos *informational* del review
`review-ae52cee6185c5e67` y cerrar el paginador declarado como pendiente.

### Resultado

- Commits: `c4c41c8` `fix(api)` agregación de páginas + código de cuota de sucursales ·
  `7dfedb9` `fix(providers)` CTA de cuota y escritura parcial · `601c99a` `feat(lists)` paginador
  de 10 · y el `docs(odd)` de este archivo. **Sin push**.
- `ng build` **verde**. `ng test` **745 pass / 8 fail**, y los 8 están atribuidos: 6 preexistentes
  (calendar-navigation 1, historial-reserva 3, booking-form-dialog 2) + 2 de
  `booking-detail-dialog`, verificados como preexistentes en un worktree limpio sobre `ad3b7be`.
- **Bug real encontrado al escribir el test de cuota de sucursales**: `isCapacityLimitError()`
  solo reconocía `account_tenant_limit_reached` y `tenant_professional_limit_reached`. El
  `tenant_location_limit_reached` que dispara el CTA de `location-dialog` **nunca** matcheaba, así
  que esa rama era código muerto y el 403 caía como toast genérico. Los códigos viven ahora en
  `CAPACITY_LIMIT_ERROR_CODES` y el spec cubre los tres.
- El `per_page` de fetch va en **100** (`LIST_PAGE_SIZE`, tope duro del API 1–100) y la UI
  muestra **10** filas por página.

## Corrección de contrato (2026-10-27, sesión 3) — el listado NO trae envelope

El backend avisó que `per_page` en `/providers` y `/locations` quedó validado como entero
**1–100** (fuera de rango → 422 `errors.per_page`) y, al responder la duda, **confirmó con
prueba contra la app real** algo que este doc tenía al revés: ambos endpoints devuelven
**array plano en la raíz**, sin `{data, links, meta}`.

Causa en el backend: los dos `index` hacen `return response()->json(Resource::collection($paginator))`;
`ResourceCollection::toArray()` devuelve la lista plana y `json_encode` la emite tal cual. El
envelope lo agrega `PaginatedResourceResponse`, que vive en `toResponse()` y **nunca se ejecuta**
porque el controlador no retorna la colección.

**Consecuencia en el frontend (P0)**: `c2c55ed` (ya en `origin`) tipó `{data, links, meta}` y hace
`map(res => res.data)` → con array plano `res.data` es `undefined` → **las dos listas quedaban
vacías** contra el API real. Los tests no lo detectaron porque **mockeaban el envelope**: el spec
codificaba la suposición equivocada. Nada de esto lo podía ver el review, porque es un hecho de
contrato, no un defecto visible en el código.

**Arreglo** (`collect-paginated.ts`): el helper acepta las dos formas
(`Array.isArray(res) ? res : res.data`), pide `per_page=100` y detecta el fin de lista por página
corta (`rows.length < per_page`) cuando no hay `meta`, o por `meta.last_page` cuando el backend
mande el envelope. Así el cliente sirve antes y después del fix del API, sin tocarlo de nuevo.

**Pedido al backend**: devolver la colección con `->response()` (o sin envolver en
`response()->json(...)`) para que exista `meta.last_page` y la paginación real sea posible. Hoy el
cliente solo puede pedir la página y deducir el final por tamaño.

## Estado (2026-10-27) — IMPLEMENTADO (T4 sigue abierta en un punto)

Contrato cerrado por el backend y UI implementada. **Build verde** y suite **728 pass / 6 fail**
(los 6 preexistentes y ajenos: calendar-navigation 1, historial-reserva 3, booking-form-dialog 2;
`booking-detail-dialog` falla solo bajo carga paralela y pasa aislado 11/11).

Los 4 bloqueantes están **resueltos por el mantenedor de `Bookwise-API`** (re-verificados por
él contra `develop` @ `c16410c`, no contra mi lectura). Queda un solo ítem con dependencia
viva: la key de `PATCH /providers/{id}/roles`, que el backend todavía tiene que mergear.

## Specs

- S1 (usuario, verbatim): "necesitamos implementar la creacion/modificacion y resultados de
  accion de profesionales y de locations en sus respectivas vistas y dialogos, considerando
  las consecuencias y permitiendoselo solo a los usuarios administradores inicialmente. Es
  decir implementar los mantenedores, con RBAC y control de permisos para la accion."
- S2 (usuario, verbatim): "Puedes dejar esto añadido a la lista de tareas, y coordinándolo
  con el agente de Backend para asegurar la consistencia de contratos y permisos."
- S3 (usuario, verbatim): "1 corrije/actualiza 2 termina esos pendientes" — 1 = corregir el
  doc que decía "Sin push"; 2 = terminar los pendientes declarados (los 3 hallazgos del
  review y el paginador).
- S4: el CTA de cuota (`capacityError`) **no puede quedar pegado**: se limpia al reabrir el
  diálogo y cuando la operación siguiente sale bien.
- S5: el guardado de edición **nunca es silencioso**: sin ninguna de las dos keys se avisa con
  error, y si los datos se guardaron y los roles fallaron el mensaje lo dice (escritura
  parcial explícita, no "falló el guardado").
- S6: las listas de profesionales y sucursales **no truncan**: el store carga todas las
  páginas y la UI pagina de a 10.

## Tasks

- ✅ T1 [S2] Cerrar contrato con `Bookwise-API`. — HECHO (respuesta del mantenedor, ver
  "Contrato cerrado").
- ✅ T2 [S1] Alinear `providers-api.service` / `locations-api.service` con la forma real de
  listado. — HECHO, y **corregido** en la sesión 3: la forma real es **array plano**, no
  `{data, links, meta}` (ver «Corrección de contrato»).
- ✅ T3 [S1] Alta de profesional: botón "Nuevo profesional" gated + `openCreate()` +
  `location_id` **requerido solo al crear** (`ProviderUpdateRequest` lo trata `sometimes`, así
  que un profesional legacy sin sucursal sigue siendo editable). — HECHO (+3 specs).
- ✅ T4 [S1] Edición de profesional con roles: **hecho con `providers.roles`**. La acción de
  editar se abre con `providers.manage` **o** `providers.roles`; cada bloque del diálogo se
  habilita por separado y el guardado manda solo lo que el usuario puede cambiar (un guardado
  "solo roles" no toca datos y viceversa). Key `providers.roles` agregada a `ABILITIES`.
  — HECHO (+2 specs).
- ✅ T5 [S1] Sucursales: rama de cuota (`tenant_location_limit_reached` → CTA de upgrade) y
  diálogo de `force` i18n. El copy de `force` ahora dice la verdad del backend: las reservas
  existentes **no se modifican**. — HECHO.
- ✅ T6 [S1] RBAC por acción: `bwIfAbility` en crear/editar/(des)activar de ambas entidades
  (`providers.manage`, `locations.manage`), `canEditProvider` con `hasAnyPermission` para el
  caso "manage O roles". — HECHO.
- ✅ T7 [S1] Consecuencias: 409 de profesional **sin bypass** (copy: "reasigna o cancela esas
  reservas antes de desactivarlo: esta acción no admite forzar"), `force` solo en sucursales
  con su conteo de reservas. — HECHO.
- ✅ T8 [S1] Tests + `ng build` + `ng test`. — HECHO.
- ✅ T9 [S1] Work-unit commits (`c2c55ed`, `8021fb9`). — HECHO.
- ✅ T10 [S3] Corregir el doc: la línea "Sin push" ya no es cierta. — HECHO.
- ✅ T11 [S4] Reset de `capacityError` en `provider-dialog`, `location-dialog` y `providers-list`
  (al reabrir el diálogo y al completar una operación con éxito) + specs. — HECHO.
- ✅ T12 [S5] `saveEdit` sin no-op silencioso (toast `providers.save_not_permitted`) y mensaje
  explícito de escritura parcial (`providers.save_roles_failed_partial`) + i18n es/en + specs.
  — HECHO.
- ✅ T13 [S5] Reescribir los 2 specs de RBAC por sección para asertar comportamiento observable
  (requests + `saved`) en vez de señales internas. — HECHO.
- ✅ T14 [S6] Paginador real: los services agregan todas las páginas (`meta.last_page`, tope de
  seguridad 40 páginas) y las dos listas paginan de a 10 con `p-paginator` (tabla y tarjetas
  móviles). — HECHO.

### Lo que queda declarado como pendiente (no silenciado)

- **Atomicidad real del guardado de edición**: datos y roles son dos PATCH distintos; si el de
  roles falla después del de datos, la escritura queda parcial y ahora se **avisa** como tal.
  Cerrarlo de verdad requiere un endpoint atómico en `Bookwise-API` (pedido al backend, fuera
  del alcance del frontend).
- **Reasignación masiva**: no existe endpoint; mover profesionales es uno por uno.
- **Backfill de la key en tenants provisionados**: `php artisan permissions:apply-baseline`.
  Si un `admin_location` no ve la acción de roles o recibe 403, falta ese paso en su tenant.
- **Costo de arranque**: los consumidores de `refStore.providers()`/`locations()` ahora reciben
  la lista completa (antes venían truncados a 25), así que en tenants grandes el bootstrap hace
  varias requests paginadas (tope duro: 40 páginas / 1000 registros). Si eso molesta, el paso
  siguiente es paginar server-side por pantalla en vez de hidratar todo el store.

## Deuda informativa del review (2026-10-27)

El review `review-9f1c39c6e4f1fdb5` (23 archivos / 1136 líneas, tier medium) aprobó el candidato
y dejó **6 hallazgos `informational`**. Ninguno bloquea; dos son deuda real de paginación:

| id | sev | ubicación |
|---|---|---|
| `R3-COLLECT-TIMEOUT` | WARNING | `collect-paginated.ts:58-70` — falta timeout/cancelación del agregador |
| `R3-PAGE-CLAMP` | WARNING | `locations-list.component.ts:76-79` — sin clamp: si el total baja, la página queda vacía |
| `R3-COVERAGE-GAPS` | WARNING | `locations-list.component.spec.ts:238-257` — la paginación no cubre la vista de tarjetas |
| `R3-PAGE-NO-UPPER-BOUND` | SUGGESTION | `providers-list.component.ts:120-122` |
| `R3-CTA-CLEAR-REMOVAL` | SUGGESTION | `providers-list.component.ts:316-319` |
| `R3-CAPACITY-CODES` | SUGGESTION | `http-error.service.ts:51-59` |

**Estado de entrega**: los 6 commits de la tanda están **pusheados** a
`origin/feat/contract-catchup` (`ad3b7be..e84fcc8`); el árbol publicado es idéntico al revisado.
Los dos fixes chicos de esta deuda están **cerrados**: `R3-PAGE-CLAMP` / `R3-PAGE-NO-UPPER-BOUND`
(clamp de página vía `effect` en ambas listas) y `R3-COLLECT-TIMEOUT` (`timeout` por página en
`collect-paginated.ts`). Los demás hallazgos (`R3-COVERAGE-GAPS`, `R3-CTA-CLEAR-REMOVAL`,
`R3-CAPACITY-CODES`) siguen abiertos en `odd/tasks/pendientes.md`.

## Contrato cerrado (respuesta del mantenedor, 2026-10-27)

1. **Ciclo de vida: solo `active`.** No habrá endpoints DELETE para `/providers` ni
   `/locations`; `SoftDeletes` está declarado pero sin uso. Preserva el histórico de reservas.
2. **`force` en profesionales: bloqueo DURO, no es un olvido.** `ProviderController.php:216-218`
   dice explícitamente que un `force` suelto se descarta porque `ProviderUpdateRequest` no
   tiene esa regla. Un profesional con reservas futuras responde 409 y **hay que resolver esas
   reservas primero**: la UI guía ese camino, **no** ofrece un botón de forzar.
3. **`PATCH /providers/{id}/roles` → habilidad NUEVA `providers.roles`** (mergeada en
   `develop` @ `6626fd9`). **No** se usó `providers.manage`: la spec `location-scope` exige que
   `admin_location` (nivel 70) pueda administrar roles de los profesionales de su sucursal, pero
   su baseline no incluye `providers.manage`; gatear con `manage` habría bloqueado justo al rol
   que la spec manda habilitar. `permissions.includes('providers.roles')` es el criterio para
   mostrar la acción de reasignar roles en la UI.
4. **Granularidad: `view` + `manage` + `roles` en profesionales**, `view` + `manage` en
   sucursales. No habrá `create/update/delete` por entidad (implicaría catálogo nuevo, baseline
   de 107 permisos, backfill y cambios en la matriz).

Detalles de `providers.roles` que hay que respetar en la UI:

- La ruta exige **además** `scope:providers:write`; el scope se evalúa primero (token sin scope
  → `forbidden`, no `permission_required`).
- Rechazo: `403 { error: 'permission_required', detail }` — mismo envelope que el resto.
- La tienen `admin_general`, `admin_local` y `admin_location`; **no** `recepcionista`, `staff` ni
  readonly.
- `min_level` 80 a propósito: `admin_location` **tiene** la habilidad pero **no puede
delegarla** a otros usuarios (403 A5).
- ⚠️ **Operativo**: en tenants ya provisionados la key se materializa con
  `php artisan permissions:apply-baseline` (paso explícito, no automático en deploy). Si el
  usuario es `admin_location` y el botón no aparece o da 403, **falta ese backfill en ese
  tenant**; avisar al backend para que lo corra (en la DB de dev ya está verificado).

Datos verificados para no inventar copy:

- **Listado paginado**: **array plano en la raíz** (sin `data`/`links`/`meta`), `per_page`
  default **15** y **validado 1–100** (fuera de rango → 422 `errors.per_page`). Sin `meta` no se
  puede saber la última página: el cliente la deduce por página corta.
- ✅ T15 [S6, corrección] `collect-paginated.ts` tolerante a array plano **y** envelope,
  `per_page=100`, fin de lista por página corta o `meta.last_page`, con specs propios contra la
  forma real. — HECHO.
- **`location_id` obligatorio** al crear profesional ("La sucursal es obligatoria.").
- **Teléfono de profesional: texto libre `max:50`, NO E.164.** Las **sucursales no tienen
  teléfono**. No reutilizar el contrato de `accounts.billing_phone`.
- **`force` en sucursales**: sin `force` → 409 `{error: deactivation_conflict, message,
  requires_confirmation: true, affects: {bookings: N}}`; con `force: true` procede y deja
  auditoría `Log::warning('Sucursal desactivada por fuerza mayor')`.
- **Reasignación masiva: no existe.** Solo `PATCH /providers/{id}` con `location_id`, uno por uno.

## Evidencia (mapa verificado 2026-10-27)

Frontend:

| Pieza | Hallazgo |
|---|---|
| `providers-list.component.ts` | list/view/edit/toggle; **create inalcanzable**; **sin gating** de abilities (solo guard de ruta `providersView`) |
| `provider-dialog.component.ts` | `create|edit|view`; envía `location_id` **solo si no es null** (backend lo exige); usa `pInputText` para teléfono, no `bw-phone-input` |
| `locations-list.component.ts` | create/edit/toggle + 409 → `force`; botón de alta ya gateado con `locationsManage`; **sin DELETE** |
| `location-dialog.component.ts` | sin rama `isCapacityLimitError`; strings de `force` hardcodeados en español |
| `providers-api` / `locations-api` | GET/POST/PATCH completos; **sin delete** |
| `abilities.config.ts` | `providers.view|manage`, `locations.view|manage` — **sin granularidad create/update/delete** |
| Resultados de acción | toast global con `summary: res.message` + `HttpErrorService` (mapea `biz.*` y `errors{}`); 409 con diálogo bloqueante |

Backend (`Bookwise-API` @ `develop`):

| Pieza | Hallazgo |
|---|---|
| Rutas | GET/POST/PATCH para ambas; **DELETE no existe** |
| `ProviderStoreRequest` | `first_name`/`last_name`/`email` requeridos + `location_id` **requerido** |
| `LocationStoreRequest` | `name` + `region_id` requeridos; `address`/`city` **nullable** |
| `force` | `LocationUpdateRequest` lo acepta; `ProviderUpdateRequest` **no** → profesional con reservas futuras nunca se puede desactivar |
| `PATCH /providers/{id}/roles` | solo `scope:providers:write`, **sin `permission:providers.manage`** |
| Cuota | `403 {error, limit, current, detail}`; aplica a crear **y reactivar** |
| Conflictos | `409 deactivation_conflict` con `affects.bookings[]`; sucursal acepta `force`, profesional no |

## Log

- L1 (usuario, verbatim): "necesitamos implementar la creacion/modificacion y resultados de
  accion de profesionales y de locations en sus respectivas vistas y dialogos, considerando
  las consecuencias y permitiendoselo solo a los usuarios administradores inicialmente. Es
  decir implementar los mantenedores, con RBAC y control de permisos para la accion. Puedes
  dejar esto añadido a la lista de tareas, y coordinándolo con el agente de Backend para
  asegurar la consistencia de contratos y permisos."
- L2 (exploración): mapa completo del frontend y del backend. Se confirma el gap conocido del
  alta de profesional y aparecen tres bloqueos nuevos: `force` ausente en provider update,
  `roles` sin permission key, y forma de listado paginada que el FE tipa como array.
- L3 (decisión de proceso): no se implementa UI antes de cerrar el contrato (§2.1, §2.2, §2.4,
  §2.5 del proposal). El pedido FE→BE quedó escrito para pasárselo al agente de backend.
- L4 (backend, respuesta al pedido): 1) ciclo de vida **solo `active`**, sin DELETE;
  2) **`force` sigue siendo bloqueo duro** en profesionales —es decisión, no olvido—, hay que
  resolver las reservas primero y la UI no debe ofrecer forzar; 3) la key en
  `PATCH /providers/{id}/roles` **se agrega en backend** (pendiente de merge, avisan al
  mergear); 4) granularidad **`view` + `manage`**, sin create/update/delete por entidad.
  Datos: listado paginado default 15 sin tope validado; `location_id` obligatorio; teléfono de
  profesional texto libre ≤50 (no E.164) y sucursales sin teléfono; `force` de sucursal deja
  auditoría; no hay reasignación masiva.
- L5 (backend, cierre): punto 3 resuelto con **habilidad propia `providers.roles`** (no
  `providers.manage`), mergeada en `develop` @ `6626fd9`; suite Postgres 1071 passed y
  `LocationScopeAuthorityTest` cubre 200 en su sucursal, 403 A5 al delegar y 403 A7 fuera de
  scope. Backfill en tenants existentes = `php artisan permissions:apply-baseline` (explícito).
- L6 (usuario): "yo haria los page mas pequeños de cualquier manera" → `per_page` en **25** en
  ambos listados (el backend no valida ni acota el parámetro).
- L7 (bug encontrado al implementar): el `location_id` requerido sin condición rompía la
  **edición** de profesionales legacy sin sucursal (el backend solo lo exige al crear). Se pasó
  a un validador `locationRequiredWhenCreating`, calcado de `rolesRequiredWhenEditing`.
- L8 (usuario, verbatim): "continuamos?" → se pushearon los 3 commits pendientes
  (`5aebf50..ad3b7be`) por decisión del usuario.
- L9 (usuario, verbatim): "1 corrije/actualiza 2 termina esos pendientes" → se abre esta
  segunda tanda: doc, los 3 hallazgos *informational* del review y el paginador declarado.
- L10 (backend, aviso de contrato, verbatim): "`per_page` quedó acotado en dos listados que ya
  consumen (...) `N` debe ser entero **1–100**. Fuera de rango (...) ahora responde **422**
  `errors.per_page` (...)". Sin impacto inmediato: el cliente manda un valor fijo.
- L11 (backend, respuesta a la duda sobre la forma, verbatim): "en `develop` (`36d9f15`) ambos
  endpoints devuelven **array plano en la raíz**, NO el envelope `{data, links, meta}` (...)
  `ResourceCollection::toArray()` devuelve la lista plana (...) el envelope lo agrega
  `toResponse()`, que **nunca se ejecuta** (...)". Confirma el P0 de listas vacías.
- L12 (usuario, decisión): "Arreglar el cliente ya (tolerante a ambas formas)" → T15, sin esperar
  el despliegue del fix del API.
