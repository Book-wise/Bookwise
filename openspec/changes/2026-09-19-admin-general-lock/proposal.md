# Proposal: Admin General Permission Lock (Inviolability)

## Intent

`admin_general` is the role that must always see and do everything. Its permission
set is catalog-derived: `RolePermissionService` documents *"admin_general derives
from the catalog so it is always the full set."* That intent is enforced nowhere.
A direct `PATCH /v1/roles/{id}/permissions` accepts a reduced set for
`admin_general`, and until commit `fdde5bf` the UI let an `admin_general` holder
uncheck its own permissions and save. This change formalizes the rule as a
spec-level invariant, records the shipped frontend lock, and hands the missing
backend guard to the API team as a companion.

## Scope

### In Scope
- Frontend lock (DONE, `fdde5bf`): matrix toggles and save are no-ops for
  `admin_general`; checkboxes and save button disabled; lock note explains why.
- A spec that states the invariant for BOTH layers.
- Backend companion (PENDING, Bookwise-API): `assignPermissions` MUST reject a
  reduced set for `admin_general`.

### Out of Scope
- RBAC enforcement middleware (still deferred; editing the matrix does not change
  real access).
- The "restore baseline" button (`POST /roles/{id}/permissions/reset` now exists,
  but is a separate change).
- Any `src/` edit: the frontend work is already committed.

## Capabilities

### New Capabilities
- `admin-general-inviolability`: `admin_general`'s permission set is never
  editable — the UI blocks the edit and the API rejects it.

### Modified Capabilities
- None.

**Why a new capability and not a delta on `role-permissions-matrix`:** the
invariant spans two layers (Angular UI + Laravel API), while
`role-permissions-matrix` is a frontend-only capability. More importantly, the
base `openspec/specs/role-permissions-matrix/` does not exist yet — it lives only
inside the unarchived `2026-09-19-rbac-frontend` change. A `MODIFIED` delta needs
a stable target in `openspec/specs/`; writing one would couple archive ordering
and could be lost if this change archives first. A standalone capability archives
independently and gives the backend requirement a proper home.

## Approach

Frontend: derive `isAdminGeneralLocked` from the single `ADMIN_GENERAL_ROLE`
constant in `role-guards.ts`; early-return in `togglePermission()` and `save()`;
bind `[disabled]` on the checkboxes and save button; render a `.permissions-lock`
note with `pi pi-lock`. Backend handoff: reject at the top of
`RoleController::assignPermissions` when the role slug is `admin_general`, before
any detach/attach.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/features/admin/roles/role-permissions.component.ts` | Done | `isAdminGeneralLocked`; guards in toggle/save |
| `src/app/features/admin/roles/role-permissions.component.html` | Done | Disabled controls + lock note |
| `src/app/features/admin/roles/role-permissions.component.scss` | Done | `.permissions-lock` styles |
| `src/app/core/i18n/es.ts`, `en.ts` | Done | `roles.permissions.admin_general_locked` |
| `src/app/features/admin/roles/role-permissions.component.spec.ts` | Done | 4 lock specs + 4 save specs re-pointed to `staff` |
| Bookwise-API `RoleController::assignPermissions` | Pending | Reject a reduced `admin_general` set |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Frontend lock mistaken for a security boundary | High | Spec marks it UX-only; backend requirement is explicit |
| Backend guard never ships | Med | Handoff task + spec requirement flagged NOT IMPLEMENTED |
| `admin_general` slug drift | Low | Single `ADMIN_GENERAL_ROLE` constant shared by both locks |

## Rollback Plan

Revert `fdde5bf` to restore an editable matrix (the backend hole remains either
way). No data migration and no schema change. The backend guard, once shipped, is
independently revertible and leaves `admin_general` at its catalog baseline.

## Dependencies

- Backend companion owned by the API team (Bookwise-API).
- `ADMIN_GENERAL_ROLE` in `role-guards.ts` (existing).
- Frontend commit `fdde5bf` on `feat/rbac-frontend-02-permission-matrix`.

## Success Criteria

- [ ] `admin_general` toggles do not change the draft; `save()` never calls the store.
- [ ] Non-locked roles toggle and save unchanged.
- [ ] The lock indicator and copy render only for `admin_general`.
- [ ] Backend `assignPermissions` rejects a reduced `admin_general` set (PENDING).
- [ ] `npx ng test --no-watch` is green.
