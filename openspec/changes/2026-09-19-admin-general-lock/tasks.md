# Tasks: Admin General Permission Lock

Refs: `AGI` = admin-general-inviolability.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~116 frontend (committed `fdde5bf`: 110 insertions, 6 deletions) + ~30 backend companion (estimate) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Decision needed before apply | No |

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

**Note**: the frontend slice is already implemented and committed, so there is no
frontend apply work left. The only remaining work is the backend companion in a
separate repository (Bookwise-API) and is handed off; it does not consume this
change's apply budget.

## Frontend — DONE (commit `fdde5bf`)

- [x] 1.1 Import `ADMIN_GENERAL_ROLE`; add `isAdminGeneralLocked` computed from `selectedRole` (AGI:lock).
- [x] 1.2 Guard `togglePermission()` as a no-op for the locked role (AGI:toggle).
- [x] 1.3 Guard `save()` as a no-op: no store call and no confirmation dialog (AGI:save).
- [x] 1.4 Disable the permission checkboxes and the save button; render the `.permissions-lock` note with `pi pi-lock` (AGI:explain).
- [x] 1.5 Add `.permissions-lock` styles (AGI:explain).
- [x] 1.6 Add i18n `roles.permissions.admin_general_locked` to `es.ts` and `en.ts` (AGI:explain).
- [x] 1.7 Add 4 specs: locked toggle is a no-op, `save()` does not call the store, `staff` still toggles and saves, lock indicator renders only for `admin_general` (AGI:toggle, save, editable, explain).
- [x] 1.8 Re-point 4 pre-existing save specs to `staff` because the default selected role is `admin_general` and is now intentionally blocked (AGI:editable).
- [x] 1.9 `npx ng test --no-watch` green.

## Backend Companion — PENDING (Bookwise-API handoff)

- [ ] 2.1 `RoleController::assignPermissions`: reject when the target role slug is `admin_general`, before any detach/attach (AGI:backend-reject).
- [ ] 2.2 Return a typed 4xx — 422 `admin_general_locked` preferred, 403 acceptable (AGI:backend-reject).
- [ ] 2.3 Feature test: direct PATCH with a reduced set → 4xx and permissions unchanged (full catalog) (AGI:backend-reject).
- [ ] 2.4 Verify `POST /v1/roles/{id}/permissions/reset` restores the full catalog for `admin_general` (AGI:backend-reset) — verification only, no code change expected.
