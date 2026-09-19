# Design: Admin General Permission Lock

## Context

The rule already exists in intent — `RolePermissionService` documents that
`admin_general` derives from the catalog and is always the full set. The frontend
half shipped in commit `fdde5bf`; the backend half does not exist. This design
records what was implemented and specifies the pending backend companion.

## Implemented Approach (Frontend)

- **Single source of truth**: reuse `ADMIN_GENERAL_ROLE` from `role-guards.ts`,
  the same constant the assignment-tab lock uses, so the two locks cannot drift.
- **Derived lock signal**:
  `readonly isAdminGeneralLocked = computed(() => this.selectedRole()?.slug === ADMIN_GENERAL_ROLE);`
- **Guard `togglePermission(key, checked)`**: early return when locked, so the
  draft is never mutated.
- **Guard `save()`**: early return before dedupe, confirmation, and persist, so
  the store is never called and no dialog opens.
- **Template**: `[disabled]="isAdminGeneralLocked()"` on the `p-checkbox` items and
  the save `p-button`; a `.permissions-lock` block with `pi pi-lock` and the
  `roles.permissions.admin_general_locked` copy.
- **i18n**: `roles.permissions.admin_general_locked` added to `es.ts` and `en.ts`.

### Why these choices

- **Derived from `selectedRole`, not a route or input flag**: selection changes
  without a reload, so a derived signal stays correct while a static flag would
  go stale.
- **Guard both `togglePermission` and `save`**: defense in depth. Disabling the
  control is presentation; the method guards make a stale draft or a programmatic
  call unable to persist.
- **Reuse `role-guards.ts`**: one definition of the `admin_general` identity.

## Backend Companion Design (PENDING — Bookwise-API)

**Location**: `RoleController::assignPermissions`.

- Load the target role; when `$role->slug === 'admin_general'`, return a typed
  4xx **before** any detach/attach.
- Preferred status: **422** with an error code such as `admin_general_locked`, so
  the client can surface an actionable message. **403** is also defensible if the
  team treats it as a forbidden action rather than a validation failure.
- The rejection must be a no-op on data — no partial detach/attach.
- Rationale: the client lock is UX-only, so the API is the real security boundary.
  `baselineForRole('admin_general')` already returns the full catalog, so rejecting
  edits keeps the model and behavior consistent.
- **Do not change** `resetPermissions`: resetting `admin_general` is safe because it
  restores the full catalog.

### Request flow

```
UI (locked)     ── no request ─────────────────────────► (nothing)
direct client   ── PATCH /v1/roles/{admin_general}/permissions ──► assignPermissions
                    ├─ slug === admin_general → 4xx, no detach/attach
                    └─ otherwise             → detach + attach (unchanged)
```

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, or executable classification. The
relevant security note is the authorization boundary itself: the client lock is
not one; the backend guard is.

## Testing Strategy

| Layer | What | Where |
|-------|------|-------|
| Unit (done) | Locked toggle is a no-op; `save()` never calls the store; `staff` still toggles and saves; indicator renders only for `admin_general` | `role-permissions.component.spec.ts` (`fdde5bf`) |
| Backend (pending) | Direct PATCH with a reduced set → 4xx and permissions unchanged (full catalog) | Bookwise-API feature test |

## Open Questions

- [ ] Backend status code: typed 422 (`admin_general_locked`) vs 403. Decide with
      the API team at handoff.
