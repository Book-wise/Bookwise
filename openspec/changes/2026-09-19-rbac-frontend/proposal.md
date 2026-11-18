# Proposal: RBAC Frontend — Slug Migration + Permission Matrix

## Intent

The front keys business roles by `role.name`, but the backend sends `name` as display ("Administrador General") and `slug` as the stable key ("admin_general"). This is a **live bug**: `hasAttentionRole()` compares `'Staff'` against `['staff','staff_readonly']`, so the admin calendar's provider list is empty today; `role-guards.ts` never matches `admin_general`, silently breaking the uniqueness invariant; and `PATCH /providers/{id}/roles` sends display names → 422. At the same time, the backend now exposes an editable role→permission matrix with no frontend UI. This change fixes the keying bug and adds the matrix.

## Scope

### In Scope
- **A. Slug migration**: key all role consumers by `slug`; `Role` becomes `{id, slug, name, permissions}` and `label` is removed. 8 production files + ~7 specs.
- **C. Permission matrix UI**: tabs in `/admin/roles` ("Asignación" | "Permisos"), master-detail (6 roles left, grouped checkboxes right), per-role save via `PATCH /v1/roles/{id}/permissions`. Catalog rendered dynamically from `GET /v1/roles/permissions`.
- **Error handling**: 409 `onboarding_required` → onboarding redirect; 422/404 → revert + refetch.

### Out of Scope
- `POST /v1/roles/{id}/permissions/reset` — endpoint not implemented (approved, pending BE).
- 403 proactive detection via token `abilities` — `/auth/me` and login don't expose them yet.
- All billing work.

## Capabilities

### New Capabilities
- `role-permissions-matrix`: view and edit a role's permissions from a dynamic grouped catalog.

### Modified Capabilities
- `roles-assignment`: roles keyed by `slug`; list/assignment handle 409 onboarding; `label` removed; a professional must still hold ≥1 role.

## Approach
- Migrate keying as one atomic work unit (models → meta/guards → consumers → API service → specs); partial migration leaves the invariant broken.
- Extend `RolesApiService` with `getPermissionCatalog()` and `updateRolePermissions(id, keys)`; new standalone signal-based matrix component under `features/admin/roles/`.
- Never hardcode the 5 groups or 13 keys — render the catalog dynamically.
- `roleLabel` falls back to the backend `name` when no i18n key exists.
- No optimistic state; confirm before clearing all permissions; dedupe keys before sending.
- Strong banner: editing permissions does **not** yet change real access (enforcement deferred).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/core/models/index.ts` | Modified | `Role` → `{id, slug, name, permissions}`; drop `label` |
| `src/app/features/admin/roles/role-meta.ts` | Modified | `ROLE_META`, `ATTENTION_ROLES`, `hasAttentionRole` keyed by slug |
| `src/app/features/admin/roles/role-guards.ts` | Modified | Guard by slug |
| `src/app/features/admin/roles/roles.component.ts` + `.html` | Modified | Selection, validation, `roleLabel`/`roleDesc`, track |
| `src/app/features/admin/providers/providers-list.component.ts` | Modified | Filter/labels by slug |
| `src/app/features/admin/providers/provider-dialog/provider-dialog.component.ts` | Modified | `roleNames` form by slug |
| `src/app/features/admin/calendar/full-calendar.component.ts` | Modified | `hasAttentionRole` filter |
| `src/app/core/services/api/roles-api.service.ts` | Modified | Send slugs; add catalog + permissions methods |
| `src/app/features/admin/roles/*` | New | Tabs + master-detail matrix |
| 7 specs with `{id, name:'staff', label}` fixtures | Modified | Slug fixtures |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Partial migration breaks invariant | Med | Atomic work unit; role-guards specs |
| Catalog `label` Spanish-only vs bilingual app | Med | i18n by key + fallback (see assumption) |
| Stale tokens lack `roles:read/write` → 403 | High | Document re-login; actionable error |
| >400-line budget | High | Chained PRs: A (migration) then C (matrix) |

## Open Assumption
Catalog `label` is Spanish-only display and explicitly **not** a contract. Proposed: the front translates by permission key via i18n, falling back to the backend `label` for unknown keys. **Not confirmed with the backend.**

## Rollback Plan
Revert the slug-migration commit to restore `name`-keying (the bug returns but the app works); revert the matrix commit to remove the tabs. Changes are isolated to the listed files; no data migration.

## Dependencies
- Backend already ships `GET /v1/roles`, `GET /v1/roles/permissions`, `PATCH /v1/roles/{id}/permissions`.
- Users must re-login after deploy for `roles:read`/`roles:write`.

## Success Criteria
- [ ] Admin calendar lists providers holding `staff`/`staff_readonly`.
- [ ] `PATCH /providers/{id}/roles` sends slugs; valid selections no longer 422.
- [ ] `admin_general` cannot be removed or reassigned.
- [ ] Matrix renders the full catalog dynamically and saves per role.
- [ ] 409 redirects to onboarding; 422/404 revert and refetch.
- [ ] `npx ng test --no-watch` is green.
