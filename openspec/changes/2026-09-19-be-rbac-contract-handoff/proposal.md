# Handoff BE → FE — Contrato RBAC y trabajo pendiente (2026-09-19)

Estado del backend: `develop` en `c6a7a30` (Bookwise-API). Análisis de BE completo en
Engram (`architecture/rbac-ui-only-rules`) y en OpenSpec del backend
(`openspec/changes/enforce-permission-matrix/`).

---

## 1. `admin_general` (permisos) — ✅ CERRADO

`PATCH /v1/roles/{id}/permissions` sobre `admin_general` con un set que **diverge** del
baseline ahora devuelve **422**:

```json
{ "error": "admin_general_locked", "detail": "..." }
```

- La guarda corre **después del 404** de rol y **antes** de la transacción: el pivot
  `role_permission` **nunca se toca**.
- Un PATCH con el set **completo** (== baseline) sigue devolviendo **200** (no-op idempotente).
- El **reset no necesita guarda**: restaura el baseline, y para `admin_general` el baseline
  es el catálogo completo.
- Commit: `c6a7a30` (cambio archivado `2026-09-19-lock-admin-general-permissions`).

**Acción FE:** manejar el 422 `admin_general_locked` de forma defensiva (toast + re-fetch de
la matriz), aunque la UI ya bloquee la edición. **No** tratarlo como 403.

---

## 2. Un rol por profesional — ⚠️ PENDIENTE (decisión de producto)

La regla **NO está documentada** como producto y el BE hoy hace lo opuesto:

- `AssignProviderRolesRequest` acepta **0..N** roles (`present` + `array`, sin cardinalidad).
- `[]` limpia todos los roles **a propósito**.
- `RolePermissionService::effectivePermissionsFor` calcula la **unión** de roles.
- Datos reales: **0 usuarios con >1 rol por tenant** (no hay legacy que romper).

**Decisión del mantenedor (2026-09-19):**
- Un profesional **siempre tiene exactamente UN rol** al crearse; `active`/`inactive` es un
  estado aparte (membership), **no** "sin rol". **0 roles NO es válido.**
- `assignRoles` **debe tener invariante de `admin_general`**: un PATCH no puede degradarlo
  (hoy el BE **no** lo protege; el FE sí vía `applyAdminGeneralInvariant`). **Hueco real.**
- El FE debe poder **ver los roles asignables al crear el profesional**, y la cantidad de
  profesionales debe **entrar en el cupo del plan/negocio** activo de su cuenta.

**Acción FE:** registrar como feature — selector de rol asignable en el alta de profesional +
aviso de cupo del plan. El contrato del endpoint todavía **no cambió** (sigue aceptando 0..N),
así que la UI debe seguir bloqueando el vacío y el multi-rol por su cuenta hasta que el BE lo imponga.

---

## 3. Enforcement de la matriz (C6) — 🔄 EN CURSO

Ya **no está fuera de alcance**: el SDD `enforce-permission-matrix` está en marcha
(proposal + spec + design + tasks + PR 1 implementado, aún sin verificar).

- Middleware `permission:` que consulta `role_permission` del tenant activo en **tiempo real**
  (sin re-login); `scope:` se mantiene como gate grueso.
- Error propuesto: **403** `{ error: 'missing_permissions', detail, missing: [keys] }` — para
  que el FE muestre "no tenés permisos para: x, y, z".
- `/auth/me` expondrá `permissions: string[]` (top-level) para que el FE gatee por permiso.

**Acción FE:** preparar (sin implementar aún) — consumir `permissions`/`abilities`, guards y
directivas por permiso, manejo del 403 con `detail` + `missing`, y quitar el banner
`roles.permissions.warning` cuando el enforcement aterrice.

---

## 4. Reset de permisos — ✅ CONFIRMADO

`POST /v1/roles/{id}/permissions/reset`:

- Restaura el **baseline del rol** (detach total + attach baseline). **NO** re-corre el seeder.
- **Idempotente** y tenant-scoped.
- Errores: `401` sin token · `403` sin `scope:roles:write`/no-admin · `409 onboarding_required`
  · `404 role_not_found`.
- **200:** `{ message, data: { role_id, slug, permissions: [keys] } }`.

**Acción FE:** construir el botón "Restaurar valores por defecto" (con confirmación) usando este
endpoint; al 200, actualizar la matriz con `data.permissions`.

---

## Bonus — `inactive` (membership)

El BE validó que **NO existe** camino automático pago→subscription→`membership.inactive`
(lo prohíbe ADR-0002). Pero hay inconsistencia: `loginTokenAbilities` y
`effectivePermissions` **no respetan `inactive`** (caen al set técnico, amplio si es admin).

**Recomendación acordada:** `inactive` → **0 abilities/permisos** de tenant. Los estados de
subscription (`paused`/`past_due`) son **ortogonales** — si se quiere cortar acceso por impago,
va en una capa de subscription, nunca tocando `tenant_memberships.status`.

**Acción FE:** si el usuario queda `inactive`, el FE debe asumir **sin acceso** al negocio
(no solo ocultar UI): el BE va a fallar fail-closed.
