# Design: RBAC Frontend — Slug Migration + Permission Matrix

## Technical Approach

Ship two chained work units. **A — slug migration**: make `slug` the only role
identity across models, helpers, consumers, service, and specs; this fixes the
live bug independently. **C — permission matrix**: turn `/admin/roles` into a
`p-tabs` shell ("Asignación" | "Permisos"), backed by a feature-scoped
`RolesStore` that owns the tenant role list and the tenantless permission
catalog. Role identity is `slug` everywhere; `name` is display-only with an
i18n-key fallback. Mutations are never optimistic — state patches only from the
server response.

## Architecture Decisions

### D1 — Component structure
- `RolesComponent` (route unchanged) becomes the **tab shell**: `activeTab`
  signal, `p-tabs` (reused from `primeng/tabs`, as in `booking-detail-dialog`),
  `providers: [RolesStore]`, one `loadRoles()` call.
- **New** `roles-assignment.component.*`: the current select/checkboxes/cards UI
  extracted, now slug-keyed. Extraction **preserves existing behaviors**: block
  saving an empty set, dedupe slugs before sending, and on 422 revert local state
  then refetch provider roles.
- **New** `role-permissions.component.*`: master-detail matrix (roles list left,
  dynamic grouped checkboxes right, save, warning banner).
- Tabs are in-page state → no `app.routes.ts` change.

### D2 — State management
**New `RolesStore` (`@ngrx/signals`), feature-scoped** on the shell.

| State | Content |
|---|---|
| `roles`, `rolesLoading`, `rolesError`, `rolesLoaded` | `GET /v1/roles` |
| `catalog`, `catalogLoading`, `catalogError`, `catalogLoaded` | `GET /v1/roles/permissions` |
| `loadRoles()` | 409-aware, redirects |
| `loadCatalog()` | lazy + cached (no-op when `catalogLoaded`) |
| `updateRolePermissions(id, keys)` | returns `Observable`; patches `roles` from `res.data.permissions` |

Rationale vs `ReferenceStore`: that store is root because providers/locations/
clients feed many screens. The catalog and matrix are read by exactly one
screen; root scope would add invalidation policy for no benefit. The catalog is
tenantless and static (~13 items), cached for the store's lifetime and
refetched on the next visit. Promote to root only if a second consumer appears.

### D3 — Service API
Signatures below. `RolesApiService` **throws the raw `HttpErrorResponse`**; no
typed result. Every repo service does this and `HttpErrorService` consumes
`HttpErrorResponse`; a typed result would fork the error pipeline.

### D4 — Error handling
- New pure predicate exported from `http-error.service.ts`:
  `isOnboardingRequired(err)` → `err.status === 409 && err.error?.error === 'onboarding_required'`.
- `RolesStore.loadRoles()` checks it and calls `router.navigate(['/onboarding'])`
  (Router injected into the store); no toast. Per-screen, not an interceptor — a
  global 409 interceptor would hijack unrelated conflicts.
- Add i18n `biz.onboarding_required` (+`.detail`) so the misleading
  "Conflicto de horario" fallback can never surface.
- 422/404 on save: the draft was never optimistic, so revert = reset the draft
  from the unchanged store role; then `loadRoles()` refetch; then
  `httpError.handle`. Empty-set save is gated by `ConfirmationService` +
  `p-confirmDialog` (pattern from `payment-tab.component`).
- Catalog unavailable: when `loadCatalog()` errors OR returns zero groups, the
  Permisos tab renders an error/empty state (i18n message + retry) and the
  **matrix MUST NOT render** — the matrix and its save control are gated on a
  non-empty `catalog`. Assignment tab is unaffected (catalog is matrix-only).

### D5 — i18n for the catalog
Item `roles.permission.<key>` via `lang.has()`; miss → backend `item.label`;
empty → raw key. Groups have no backend label, so `roles.permission_group.<group>`;
miss → raw `group` slug. Resolved by component methods `permissionLabel(item)` /
`permissionGroupLabel(group)`, mirroring `roleLabel`. A brand-new backend key
renders immediately from `label` with no front change.

### D6 — Atomic migration order
1. `core/models/index.ts` (types). 2. `role-meta.ts`, `role-guards.ts` (rename
params to slug; logic already slug-valued). 3. `roles-api.service.ts`.
4. Consumers: assignment, `providers-list`, `provider-dialog`. 5. Specs/fixtures.

The compiler is **not** a guardrail (`.name` still exists as display), so steps
1–5 ship in one commit. The fixture migration is the real detector: fixtures go
from `{ id, name:'staff', label }` to the true shape
`{ id, slug:'staff', name:'Staff', permissions: [] }`, turning any remaining
`.name`-as-key test RED. `full-calendar.component.ts` needs no change (it passes
`p.roles` straight to `hasAttentionRole`); only its spec's fixtures change.

### D7 — `roleLabel`/`roleDesc`
Take the role object: slug for the key, `name` for fallback.
`roleLabel(role: Pick<Role,'slug'|'name'>)`, `roleDesc(role: Pick<Role,'slug'>)`.
Template ripple: `track role.slug`, `roleMeta(role.slug)`, `roleLabel(role)`,
`isRoleLocked(role.slug)`, `isRoleChecked(role.slug)`,
`onRoleChange($event, role.slug)`. Rename identity vars for clarity:
`selectedRoleNames`→`selectedRoleSlugs`, `currentProviderRoles`→slug set,
provider-dialog `roleNames`→`roleSlugs` (+HTML). Largest diff contributor, but
find/replace inside files already touched.

### D8 — Testing
Standard Mode (strict TDD off). See table.

## Data Flow

```
/admin/roles → RolesComponent (shell, p-tabs)
   │ providers:[RolesStore]
   ├─ Asignación → RolesAssignmentComponent ─┐ reads roles/catalog signals
   └─ Permisos   → RolePermissionsComponent ─┘
        RolesStore ──GET /v1/roles───────────  (409 → /onboarding)
                   ──GET /v1/roles/permissions (cached)
                   ──PATCH /v1/roles/{id}/permissions → patch roles[].permissions
   RolesAssignment ──ReferenceStore.assignProviderRoles(id, slugs)── PATCH /providers/{id}/roles
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `core/models/index.ts` | Modify | `Role {id,slug,name,permissions}`; add `PermissionItem`, `PermissionGroup`, `RolePermissionsResponse` |
| `core/services/http-error.service.ts` | Modify | export `isOnboardingRequired` |
| `core/services/api/roles-api.service.ts` | Modify | add `getPermissionCatalog`, `updateRolePermissions` |
| `features/admin/roles/role-meta.ts` | Modify | slug-keyed `roleMeta` / `hasAttentionRole` |
| `features/admin/roles/role-guards.ts` | Modify | slug params + JSDoc (logic unchanged) |
| `features/admin/roles/roles.component.ts/.html/.scss` | Modify | becomes tab shell |
| `features/admin/roles/roles.store.ts` | Create | feature store: roles, catalog, mutation, 409 |
| `features/admin/roles/roles-assignment.component.ts/.html` | Create | extracted assignment UI |
| `features/admin/roles/role-permissions.component.ts/.html/.scss` | Create | master-detail matrix |
| `core/i18n/es.ts`, `en.ts` | Modify | `biz.onboarding_required(.detail)`, `roles.tabs.*`, `roles.permission.*`, `roles.permission_group.*`, `roles.permissions.*` |
| `features/admin/providers/providers-list.component.ts/.html` | Modify | slug filter/options |
| `features/admin/providers/provider-dialog/*.ts/.html` | Modify | `roleSlugs` form |
| 7 specs (see D8) | Modify | slug fixtures + new expectations |

## Interfaces / Contracts

```ts
export interface Role { id: number; slug: string; name: string; permissions: string[]; }
export interface PermissionItem { key: string; label: string; }
export interface PermissionGroup { group: string; items: PermissionItem[]; }

// RolesApiService
getRoles(): Observable<Role[]>;                                 // GET /v1/roles → r.data (array)
getPermissionCatalog(): Observable<PermissionGroup[]>;          // GET /v1/roles/permissions → r.data
updateRolePermissions(roleId: number, permissions: string[]):   // PATCH /v1/roles/{id}/permissions
  Observable<{ message?: string; data: { role_id: number; slug: string; permissions: string[] } }>;
assignProviderRoles(providerId: number, slugs: string[]): Observable<{ data: Role[] }>;

// http-error.service.ts
export function isOnboardingRequired(err: HttpErrorResponse): boolean;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `isOnboardingRequired` truth table | new spec |
| Unit | `RolesStore`: load, 409 redirect, catalog cache, patch-on-200, 422 rethrow | new `roles.store.spec.ts` |
| Unit | Matrix: dynamic render, label fallback, preselect, dedupe, empty-confirm, revert+refetch, banner, no restore, catalog error/zero-groups → empty state and no matrix | new `role-permissions.component.spec.ts` |
| Component | Assignment (moved) + shell tabs | modified `roles.component.spec.ts` + new assignment spec |
| Component | providers-list, provider-dialog, full-calendar slug fixtures | modified specs |
| Service | catalog + update methods | modified `roles-api.service.spec.ts` |

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable-file classification,
or process integration. The only routing behavior is an in-SPA
`router.navigate(['/onboarding'])` on a typed API error; no route-table change.

## Migration / Rollout

Two work units / chained PRs: **A** slug migration (independently shippable,
fixes the live bug), then **C** matrix. No data migration. Rollback: revert A
(bug returns, app works) or C (tabs removed). Users re-login for
`roles:read`/`roles:write`.

## Open Questions

- [ ] Catalog `label` is Spanish-only and not a contract (unconfirmed with BE);
      the i18n-key + fallback strategy contains the risk.
- [ ] Confirm the exact catalog key list at implementation time to seed
      `roles.permission.*`; unknown keys fall back to `label`.
