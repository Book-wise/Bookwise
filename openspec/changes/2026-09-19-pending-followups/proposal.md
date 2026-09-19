# Pending follow-ups — 2026-09-19

Estado al cerrar la sesión del 2026-09-19. Lo que entró a `develop` (local) y lo
que queda por hacer, con su origen y su contexto.

Contrato del backend: `Bookwise-API` `develop` en `c6a7a30`.
Respuestas del BE: `openspec/changes/2026-09-19-be-rbac-contract-handoff/proposal.md`.

---

## Lo que entró

Los tres entregables consolidados en una sola branch y mergeados a `develop`:

| Change | Qué aportó | Verificación |
|---|---|---|
| `2026-09-19-rbac-frontend` | Slug migration, matriz de permisos, lock `admin_general`, responsive, iconos Lucide + `bw-role-badge` | Unidades A y C verificadas |
| `2026-09-19-tenant-switch-reactivity` | Prefs user+tenant, `reloadAll`, scope derivado, coordinador, wiring, rotación de token, toast | **Sin verify formal** (ver abajo) |
| `2026-09-19-admin-general-lock` | Lock de `admin_general` en la matriz (front) | Verificado; el backend ya cerró la guarda |
| Billing | Facturación fuera del sidebar, solo en el menú de cuenta | Build + tests |

---

## 1. Verificación manual — ✅ CERRADA (2026-09-19)

Confirmado por el mantenedor en el navegador:

- [x] **`/admin/calendar`** → la agenda carga y **aparecen las reservas**.
- [x] **`/admin/roles` en mobile** → la página está OK (select + label, layout).
- [x] **Cambio de negocio** → no desloguea, la identidad se actualiza y la agenda
      se re-scopea.

No reportado explícitamente (si algo se ve raro, reabrir): el detalle de la pestaña
**Permisos** en desktop y el grupo de **radios** en Asignación.

## 2. `tenant-switch-reactivity` sin `verify-report`

Los 7 slices se implementaron y cada uno pasó build + tests con 0 fallos nuevos,
pero **la cadena nunca pasó por `sdd-verify`**. Corresponde correrlo para dejar el
change cerrado formalmente (y, si aplica, archivar).

## 3. Acciones derivadas de las respuestas del BE

### 3.1 Manejar el 422 `admin_general_locked` (chico)

El BE ya cerró la guarda: un `PATCH /roles/{id}/permissions` sobre `admin_general`
con un set que **diverge** del baseline devuelve **422 `{ error: 'admin_general_locked' }`**,
antes de tocar el pivot.

Hoy el front bloquea la edición (UX), pero si igual llega un 422 hay que manejarlo
**defensivamente**: toast + re-fetch de la matriz. **No** tratarlo como 403.

### 3.2 Botón "Restaurar valores por defecto" (chico/medio)

`POST /v1/roles/{id}/permissions/reset` — contrato confirmado:

- Restaura el **baseline del rol** (detach total + attach baseline). **No** re-corre el seeder.
- **Idempotente**, tenant-scoped.
- Errores: `401` · `403` · `409 onboarding_required` · `404 role_not_found`.
- **200**: `{ message, data: { role_id, slug, permissions: [keys] } }`.

Construir el botón con confirmación y, al 200, actualizar la matriz con `data.permissions`.
El diseño original lo tenía como "out of scope porque el endpoint no existía" — eso quedó inválido.

### 3.3 Un rol por profesional (feature nueva, decisión de producto ya tomada)

El BE **no** impone la regla: `AssignProviderRolesRequest` acepta **0..N** y
`effectivePermissionsFor` calcula la **unión**. La decisión del mantenedor es:

- Un profesional **siempre tiene exactamente UN rol**; `active`/`inactive` es estado
  de membership, **no** "sin rol". **0 roles NO es válido.**
- `assignRoles` **debe** tener invariante de `admin_general` (el BE no lo protege; el
  FE sí vía `applyAdminGeneralInvariant`) — **hueco real del backend**.

Trabajo FE:
- [ ] Selector de **rol asignable en el alta de profesional**.
- [ ] Aviso de **cupo del plan/negocio** al crear profesionales.
- [ ] La UI sigue bloqueando vacío y multi-rol por su cuenta hasta que el BE lo imponga.

### 3.4 Enforcement de la matriz (C6) — preparar, no implementar

El BE tiene el SDD `enforce-permission-matrix` en marcha (PR1 implementado, sin verificar):

- Middleware `permission:` que consulta `role_permission` del tenant en **tiempo real**.
- `/auth/me` expondrá **`permissions: string[]`** (top-level).
- Error: **403** `{ error: 'missing_permissions', detail, missing: [keys] }`.

Trabajo FE (preparatorio):
- [ ] Consumir `permissions` / `abilities`.
- [ ] Guards y directivas por permiso.
- [ ] Manejar el 403 con `detail` + `missing` ("no tenés permisos para: x, y, z").
- [ ] **Quitar el banner `roles.permissions.warning`** cuando el enforcement aterrice —
      hoy dice la verdad y debe seguir ahí hasta entonces.

### 3.5 `inactive` (membership)

`loginTokenAbilities` y `effectivePermissions` **no respetan `inactive`** (caen al set
técnico, amplio si es admin). Acordado: `inactive` → **0 abilities/permisos** de tenant.
Los estados de subscription (`paused`/`past_due`) son **ortogonales** — cortar acceso por
impago va en una capa de subscription, nunca tocando `tenant_memberships.status`.

Trabajo FE: si el usuario queda `inactive`, asumir **sin acceso** al negocio (el BE va a
fallar fail-closed).

## 4. Deuda técnica / consistencia

- [ ] **`providers-list` y `provider-dialog`** todavía renderizan los roles como chip con
      **punto** de color, no con `bw-role-badge`. Migrarlos para que la fuente de verdad del
      render sea una sola.
- [ ] **Iconos**: `users` (staff) se parece al icono de la nav **Profesionales** (`pi-users`).
      Evaluar si conviene cambiarlo.
- [ ] **Seeders demo**: el BE borró 12 seeders demo (`711424e`) mientras el mantenedor pidió
      conservar los datos de desarrollo en seeds reproducibles. **Reconciliar.**
- [ ] **`TenantDemoSeeder`** no está cableado a nada y no seteaba `providers.user_id`.
- [ ] **Aislamiento de tests en Bookwise-API**: el borrador del fix (namespace
      `bookwise_test_t_`, aserciones duras, reportar leaks) quedó **sin commitear** en la
      branch del BE. Confirmar que el BE lo adoptó o rehacerlo.
- [ ] **`feat/business-management-backup`** tiene 3 commits únicos vs `develop`; revisar y
      borrar si ya no hacen falta.

## 5. Rama de integración descartable

`test/integration-rbac-tenant-switch` fue una branch de pruebas para ver todo junto.
Su contenido ya está en `develop`; se puede borrar.
