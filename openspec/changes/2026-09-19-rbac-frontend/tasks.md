# Tasks: RBAC Frontend — Slug Migration + Matrix

Refs: `RA`=roles-assignment, `RPM`=role-permissions-matrix.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1600 (A ~300, C ~1300) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (A) → PR 2 (C) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Work Units

| Unit | Goal | PR / base | Focused test | Runtime harness | Rollback |
|---|---|---|---|---|---|
| A | Slug-key consumers; fix calendar filter, invariant, 422 | PR 1 / main | `npx ng test --no-watch` | `/admin/calendar`: `staff` provider listed | Revert PR 1; bug returns |
| C | Tabs + matrix, `RolesStore`, catalog, 409/422/404 | PR 2 / PR 1 | `npx ng test --no-watch` | `/admin/roles` → Permisos renders, saves | Revert PR 2; migration intact |

## A — Slug migration (ONE atomic commit)

One commit: the compiler can't catch `.name`-as-key; fixtures are the detector.

- [x] 1.1 `models/index.ts`: `Role` → `{id,slug,name,permissions}`; drop `label`; add `PermissionItem`, `PermissionGroup`, `RolePermissionsResponse` (RA:keying).
- [x] 1.2 `role-meta.ts`: key by slug; `hasAttentionRole` matches staff slugs (RA:filter).
- [x] 1.3 `role-guards.ts`: rename to slug; logic unchanged (RA:invariant).
- [x] 1.4 `roles-api.service.ts`: `assignProviderRoles(id, slugs)` (RA:assign).
- [x] 1.5 `roles.component.ts/.html`: rename to slugs; `roleLabel(role)`, `roleDesc(role)`, `track role.slug` (RA:list).
- [x] 1.6 `providers-list.component.ts/.html`: filter/chips by `role.slug` (RA:filter).
- [x] 1.7 `provider-dialog.component.ts/.html`: `roleNames`→`roleSlugs` (RA:invalid).
- [x] 1.8 Migrate 7 spec fixtures to `{id,slug,name,permissions:[]}` (design D8).
- [x] 1.9 Assert `roleLabel` fallback and calendar filter (RA:fallback, filter).
- [x] 1.10 `npx ng test --no-watch` green; commit A atomically.

## C — Permission matrix

Assignment tab keeps working before the matrix lands.

- [x] 2.1 `http-error.service.ts`: export `isOnboardingRequired(err)` (RA:409).
- [x] 2.2 `roles.store.ts` (new): roles/catalog signals; `loadRoles()` 409→`/onboarding`; cached `loadCatalog()`; `updateRolePermissions` patches from `res.data.permissions` (RPM:preselect).
- [x] 2.3 `roles-api.service.ts`: add `getPermissionCatalog()`, `updateRolePermissions(id, permissions)`.
- [x] 2.4 `roles.component.ts/.html`: `p-tabs` shell, `providers: [RolesStore]`, one `loadRoles()` (RA:list).
- [x] 2.5 `roles-assignment.component.ts/.html` (new): extract slug-keyed UI; keep block-empty, dedupe, 422 revert+refetch (RA:empty, invalid).
- [x] 2.6 `role-permissions.component.ts/.html/.scss` (new): master-detail, dynamic groups/items, preselect, save (RPM:catalog, preselect).
- [x] 2.7 `permissionLabel`/`permissionGroupLabel` i18n + backend fallback (RPM:fallback).
- [x] 2.8 Gate matrix/save on non-empty catalog; error state + retry (RPM:unavailable).
- [x] 2.9 Confirm via `p-confirmDialog` before empty save; no optimistic state; dedupe (RPM:empty, save).
- [x] 2.10 422/404: reset draft, `loadRoles()` refetch, `httpError.handle` (RPM:422).
- [x] 2.11 Persistent deferred-enforcement warning; no restore control (RPM:warning).
- [x] 2.12 `i18n/es.ts`/`en.ts`: `biz.onboarding_required(.detail)`, `roles.tabs.*`, `roles.permission.*`, `roles.permission_group.*`, `roles.permissions.*`.
- [x] 2.13 New `http-error.service.spec.ts`: truth table.
- [x] 2.14 New `roles.store.spec.ts`: load, 409 redirect, cache, patch-on-200, 422 rethrow.
- [x] 2.15 New `role-permissions.component.spec.ts`: render, fallback, preselect, dedupe, empty-confirm, revert+refetch, banner, no restore, catalog error/zero-groups.
- [x] 2.16 New `roles-assignment.component.spec.ts`; update `roles.component.spec.ts` for tabs.
- [x] 2.17 Update `roles-api.service.spec.ts` for catalog + update.
- [x] 2.18 `npx ng test --no-watch` green; commit C.
