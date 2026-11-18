# Fase B — cierre del RBAC por capacidad (2026-10-19)

Cierra el pendiente T5 de `odd/tasks/rbac-frontend.md`: cablear los gates de UI por
**permission key** y dejar `is_admin_*` solo donde expresa relación de negocio.

## Specs

- **S1** — "Migrar gates `is_admin_general`/`is_admin_local` a `hasAbility(...)`"
  (T5 de `odd/tasks/rbac-frontend.md`).
- **S2** — "El backend ya hizo ese movimiento en F7 A (salió `role:admin`, deniega con
  `permission:locations.manage`, `providers.manage`, `sales.manage`, `roles:read/write`)".
- **S3** — "El backend como autoridad final — el 403 `permission_required` sigue siendo el
  fallback; el front solo oculta/deshabilita por UX, nunca es la fuente de verdad de
  seguridad."
- **S4** — "No tienes permiso para esta acción. Solicita acceso a tu administrador."
- **S5** — `ABILITIES` es la única fuente de los keys: "los componentes y el menú referencian
  `ABILITIES.x`, nunca el literal."

## Criterio aplicado (decisión de cierre)

`is_admin_general` / `is_admin_local` / `is_admin_location` son **flags de rol de negocio**
(relación usuario↔cuenta/tenant), no permission keys. Se migran SOLO los gates de
**capacidad funcional**; se conservan donde expresan **relación de negocio**:

| Consumidor | Hoy | Decisión |
|---|---|---|
| `app.routes.ts` (admin hijos) | sin guard de permiso | **cablear `abilityGuard`** (S1/S2) |
| `locations-list` "Nueva sucursal" | visible para todos | `*bwIfAbility=ABILITIES.locationsManage` |
| `providers-list` "Nuevo profesional" | visible para todos | `*bwIfAbility=ABILITIES.providersManage` |
| `businesses-list.isAdminGeneral` | señal sin uso en el template | **eliminar** (código muerto) |
| `business-edit.canManage` | `isAdminGeneral \|\| isAdminLocal` | **conservar**: gestiona ESTE negocio, no el tenant activo; no hay key en el catálogo |
| `subscription-inactive-dialog.isOwner` | `isAdminGeneral` | **conservar**: dueño de la CUENTA (relación de negocio) |
| `profile.businessRoleLabel` / `memberRoleLabel` | flags `is_admin_*` | **conservar**: son labels de identidad, no gates |

No existe permission key para "gestionar negocio/tenant" en el catálogo del backend
(13 keys: bookings/clientes/providers/roles/settings). Migrar esos tres últimos a
`hasPermission` sería fail-closed y rompería la UI.

## Tasks

- **T1** (S1, S2, S5) — ✅ Cablear `abilityGuard` en `app.routes.ts`: locations, providers,
  calendar, clients, roles, configuraciones.
- **T2** (S1, S5) — ✅ `*bwIfAbility` en "Nueva sucursal" (`locationsManage`).
  ⚠️ `providers-list` NO tiene acción de alta inline (`dialogMode='create'` sin trigger): se
  descarta esa mitad para no inventar un gate que no existe.
- **T3** (S1) — ✅ Eliminar `isAdminGeneral` muerto de `businesses-list`.
- **T4** (S3) — ✅ Tests: `app.routes.spec.ts` (24 casos) + `bw-if-ability.directive.spec.ts` (3).
- **T5** — ✅ Verificación: `ng build` verde; specs tocados verdes; suite completa 680/688 con
  8 fallos en archivos NO tocados (6 deterministas + 2 flaky bajo carga, pasan en aislamiento).

## Resultado de verificación

| Check | Resultado |
|---|---|
| `ng build` | verde (solo warnings de budget preexistentes) |
| `app.routes.spec.ts` | 24/24 |
| `bw-if-ability.directive.spec.ts` | 3/3 |
| `businesses-list.component.spec.ts` | 3/3 |
| Suite completa | 680/688 — 8 fallos ajenos: `calendar-navigation`, `booking-form-dialog` (matchMedia), `historial-reserva` (6 deterministas, fallan también en aislamiento) + `providers-list`/`booking-detail-dialog` (flaky bajo carga; 26/26 verdes en aislamiento) |

Sin commits: el usuario no los pidió y hay trabajo de billing sin commitear en archivos
compartidos (`app.routes.ts`, i18n).

Pendiente de validación con backend vivo: confirmar que los roles no-admin reciben sus
permission keys en `/auth/me` (el gate es fail-closed: sin la key, la sección desaparece).

## Log

- **L1** — Pedido (verbatim): "dale cierra la fase B".
- **L2** — Hallazgo de alcance: `providers-list` no expone alta inline; `businesses-list.isAdminGeneral`
  era código muerto; el catálogo del backend no tiene key de "gestionar negocio" (13 keys), por lo
  que `business-edit.canManage`, `subscription-inactive-dialog.isOwner` y los labels de `profile`
  se conservan como relación de negocio, no como capacidad funcional.
