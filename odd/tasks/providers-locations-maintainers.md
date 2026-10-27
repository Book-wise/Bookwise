# Mantenedores de profesionales y sucursales (CRUD + RBAC por acción)

Implementar los **mantenedores** de profesionales y sucursales: crear y modificar desde sus
vistas y diálogos, mostrar el resultado y las consecuencias de cada acción, y gatear cada
acción por permiso (inicialmente solo administradores).

## Estado al cerrar (2026-10-27) — IMPLEMENTADO Y VERDE

- Árbol limpio; commits `c2c55ed` (fix del listado paginado) y `8021fb9` (mantenedores).
- `ng build` verde; `ng test` **728 pass / 6 fail** (los 6 preexistentes y ajenos).
- `booking-detail-dialog` aparece como 7º fallo bajo carga paralela pero **pasa aislado 11/11**:
  flakiness conocida del repo, no regresión de este trabajo.
- Sin push (decisión del usuario).

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

## Tasks

- ✅ T1 [S2] Cerrar contrato con `Bookwise-API`. — HECHO (respuesta del mantenedor, ver
  "Contrato cerrado").
- ✅ T2 [S1] Alinear `providers-api.service` / `locations-api.service` con la forma real de
  listado (`{data, links, meta}`, `per_page` sin tope server-side). — HECHO.
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

### Lo que queda declarado como pendiente (no silenciado)

- **Sin paginador en la UI**: `per_page` quedó en 25 (a pedido del usuario, páginas chicas) y
  las listas no paginan, así que **más de 25 registros se truncan**. Un paginador real es el
  siguiente paso natural.
- **Reasignación masiva**: no existe endpoint; mover profesionales es uno por uno.
- **Backfill de la key en tenants provisionados**: `php artisan permissions:apply-baseline`.
  Si un `admin_location` no ve la acción de roles o recibe 403, falta ese paso en su tenant.

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

- **Listado paginado**: `{data, links, meta}`, `per_page` default **15** y **sin validación ni
  tope server-side** → mandar un valor razonable, no depender de 1000.
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
