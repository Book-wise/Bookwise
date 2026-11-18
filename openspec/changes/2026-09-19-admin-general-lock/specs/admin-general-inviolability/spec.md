# Delta for Admin General Inviolability

## Purpose

`admin_general` always derives the full permission catalog, so its permission set
must never be editable — not even by an `admin_general` holder editing its own
role. This capability states that invariant for both layers: the frontend matrix
(implemented, commit `fdde5bf`) and the backend API (companion, NOT implemented).

## ADDED Requirements

### Requirement: Lock the admin_general permission matrix

**Status: Implemented (frontend, commit `fdde5bf`).**

The role-permissions matrix MUST treat `admin_general` as read-only. Toggling a
permission while `admin_general` is selected MUST NOT change the draft. The save
control MUST NOT dispatch `PATCH /v1/roles/{id}/permissions` for `admin_general`,
even if a stale draft reached the save path.

#### Scenario: Toggle is a no-op for admin_general

- GIVEN `admin_general` is the selected role and the catalog is ready
- WHEN the admin toggles any permission checkbox
- THEN the draft still equals the role's current permissions
- AND no change is queued for save

#### Scenario: Save is blocked for admin_general

- GIVEN `admin_general` is the selected role
- WHEN the admin triggers save, including with an empty draft
- THEN `RolesStore.updateRolePermissions` is never called
- AND no confirmation dialog is opened

### Requirement: Other roles remain editable

The matrix MUST keep its existing behavior for every role whose slug is not
`admin_general`: toggles update the draft and save sends the deduped key set.

#### Scenario: Non-locked role toggles and saves normally

- GIVEN a role other than `admin_general` is selected, for example `staff`
- WHEN the admin toggles a permission and saves
- THEN the draft reflects the toggle
- AND `PATCH /v1/roles/{id}/permissions` is sent with the deduped key set

### Requirement: Explain why the matrix is locked

The UI MUST render a visible lock indicator whose copy explains WHY
`admin_general` cannot be edited: it always holds every permission. The indicator
MUST render only for `admin_general`, and the permission checkboxes and save
button MUST be disabled while it is selected.

#### Scenario: Lock indicator explains the rule

- GIVEN `admin_general` is the selected role
- WHEN the matrix renders
- THEN a lock note with a lock icon is visible
- AND the permission checkboxes and the save button are disabled
- AND the note resolves `roles.permissions.admin_general_locked` (neutral Spanish:
  "El rol Admin General siempre tiene todos los permisos y no se puede editar.")

#### Scenario: Indicator is absent for other roles

- GIVEN a non-locked role is selected
- WHEN the matrix renders
- THEN no lock indicator is rendered
- AND the permission checkboxes and save button are enabled

### Requirement: Backend rejects a reduced admin_general set

**Status: NOT IMPLEMENTED — backend companion (Bookwise-API). Currently
unsatisfied: `RoleController::assignPermissions` has no `admin_general` guard and
accepts the PATCH, applying detach+attach.**

The API MUST reject any `PATCH /v1/roles/{id}/permissions` that targets a role
whose slug is `admin_general`, before mutating data. The rejection MUST NOT change
the role's permissions; `admin_general` MUST remain the full catalog, consistent
with `RolePermissionService::baselineForRole('admin_general')`.

#### Scenario: Direct PATCH is rejected

- GIVEN an authenticated `admin_general` holder with `role:admin` + `scope:roles:write`
- WHEN they `PATCH /v1/roles/{admin_general_id}/permissions` with a reduced key set
- THEN the API rejects the request with a typed 4xx error
- AND `admin_general`'s permissions are unchanged (full catalog)

#### Scenario: Reset stays consistent with the invariant

- GIVEN the existing `POST /v1/roles/{id}/permissions/reset`
- WHEN it targets `admin_general`
- THEN the restored set is the full catalog

## Notes

The frontend lock is **UX-only**: it prevents the request from the UI but is not a
security boundary. The backend requirement above is what actually closes the hole.
Until it ships, a direct API call can still reduce `admin_general`.
