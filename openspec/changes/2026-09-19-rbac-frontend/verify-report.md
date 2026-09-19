```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:e4d4f891f388c4185d9d82d7ff9f533133fa1417df95954cbf937b641b104113
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 11/11
test_command: npx ng test --no-watch --include=src/app/core/services/http-error.service.spec.ts --include=src/app/features/admin/roles/roles.store.spec.ts --include=src/app/features/admin/roles/roles.component.spec.ts --include=src/app/features/admin/roles/roles-assignment.component.spec.ts --include=src/app/features/admin/roles/role-permissions.component.spec.ts --include=src/app/core/services/api/roles-api.service.spec.ts
test_exit_code: 0
test_output_hash: sha256:e4d4f891f388c4185d9d82d7ff9f533133fa1417df95954cbf937b641b104113
build_command: npx ng build
build_exit_code: 0
build_output_hash: sha256:7fbf7819c9a54288b09c8b84b87aea8ba7db53c6b4bfc55f15db876ec6c3cc71
```

## Verification Report — Unit C (Permission Matrix) — RE-VERIFICATION

**Change**: 2026-09-19-rbac-frontend
**Work unit verified**: C — permission matrix ONLY (this section), re-verified at the current HEAD. Unit A (slug migration) is preserved in the appendix and was verified separately.
**Version**: N/A (frontend-only delta; `role-permissions-matrix` + `roles-assignment`)
**Mode**: Standard (`strict_tdd: false`)
**Branch / commit**: `feat/rbac-frontend-02-permission-matrix` @ `57b367c` (`fix(admin): emit permission-save toast on the global key`); previously verified parent `9a7988c` (Unit C), grandparent `b4bbd98` (Unit A)
**Date**: 2026-09-19

### Why this is a re-verification

Unit C was first verified at `9a7988c`. A follow-up fix, `57b367c`, was committed afterwards, so the verified candidate changed and the previous evidence no longer attests the current tree. This section re-verifies Unit C at HEAD.

**Delta under test (`57b367c` vs `9a7988c`)** — exactly two files, +18 / −0:

| File | Change |
|------|--------|
| `src/app/features/admin/roles/role-permissions.component.ts` | Added `key: 'global'` to the success `messageService.add` call in `persist()` (line 153). |
| `src/app/features/admin/roles/role-permissions.component.spec.ts` | Added the regression test `emits the success toast on the global key so the app shell renders it` (+17 lines). |

**Root cause (confirmed by source inspection)**: the admin layout renders ONLY `<p-toast key="global" position="top-right" [life]="4500" />` (`src/app/layouts/admin-layout/admin-layout.component.html:1`; the provider layout is identical). PrimeNG routes a message to the toast whose `key` matches the message's `key`. The success message omitted `key`, so it was routed to the keyless toast that is never rendered — the message was silently lost. The user hit this in manual testing.

### Scope

This report verifies **Unit C** only. Authoritative Unit C totals: **6 requirements / 11 scenarios**, drawn from the retrieved specs:

| Spec | Requirements in Unit C | Scenarios in Unit C |
|------|------------------------|---------------------|
| `role-permissions-matrix` | 4 (all) | 9 (all) |
| `roles-assignment` (Unit C portion) | 2 requirement portions (`List business roles` 409; `Assign roles to a provider` 422) | 2 (`Tenantless admin`; `Invalid selection rejected by the API`) |
| **Total** | **6** | **11** |

`role-permissions-matrix` requirement/scenario breakdown: View the permission catalog (3), View a role's current permissions (2), Replace a role's permission set (3), Enforcement warning and no restore control (1).

The `roles-assignment` slug-keying requirements were verified in Unit A and are **not** re-counted here. Regression of the extracted assignment component (block-empty, dedupe, 422) is reported under the `Assign roles to a provider` requirement, which is the Unit C portion of that requirement.

**Explicitly out of scope (not defects)**: `POST /v1/roles/{id}/permissions/reset` and any "restore baseline" UI (backend endpoint does not exist); proactive 403 detection via token `abilities` (backend does not expose them yet). Both are confirmed absent, which is correct.

### Delta Verification — the toast key fix

**1. Is the fix correct and complete?**

| Check | Result |
|-------|--------|
| Success toast now carries `key: 'global'` | ✅ `role-permissions.component.ts:153` — `key: 'global'` present inside the `next()` `messageService.add({ severity: 'success', summary, detail, key: 'global', life: 4000 })`. |
| No OTHER `messageService.add` call in the Unit C components is missing its key | ✅ Confirmed. The roles feature emits exactly one toast: `role-permissions.component.ts:149` (now keyed). `roles.store.ts` emits none. `roles.component.ts` (shell) and `roles-assignment.component.ts` emit none directly. |
| Error path toasts are keyed | ✅ `role-permissions.component.ts` and `roles-assignment.component.ts` delegate errors to `HttpErrorService.handle()`. `HttpErrorService.toToastConfig()` returns `{ ...config, key: 'global' }` unconditionally (`http-error.service.ts:97`), and the offline/reconnect toasts carry `key: 'global'` (lines 109, 126). So error toasts were never affected. |

The fix is a **one-line, complete** correction. No sibling call site shares the defect.

**2. Is the regression test a real guard or a tautology?**

**Verdict: REAL GUARD — not a tautology.**

The assertion is:
```ts
expect(messageService.add).toHaveBeenCalledWith(
  expect.objectContaining({ severity: 'success', key: 'global' }),
);
```

Reasoning: `expect.objectContaining({...})` is an asymmetric matcher that requires the received object to contain every specified property. If the received object lacks `key`, the property check fails and the assertion throws. The pre-fix object is `{ severity: 'success', summary, detail, life }` — it has **no** `key` property — so the matcher cannot match it. The test therefore goes RED without the fix and GREEN with it.

This was proven empirically in an isolated Vitest run that reproduced both exact shapes and the identical matcher call (no repository mutation): the pre-fix shape (no `key`) made the assertion throw; the post-fix shape (with `key: 'global'`) passed. 2/2 checks passed. A tautology would require the assertion to hold regardless of the `key` property; it does not.

Additionally, `expect(messageService.add).toHaveBeenCalledTimes(1)` binds the guard to the single success emission, so a future second unkeyed toast would also fail.

**3. No regression to previously verified Unit C behavior**

Focused Unit C specs at `57b367c`:

```text
npx ng test --no-watch \
  --include=src/app/core/services/http-error.service.spec.ts \
  --include=src/app/features/admin/roles/roles.store.spec.ts \
  --include=src/app/features/admin/roles/roles.component.spec.ts \
  --include=src/app/features/admin/roles/roles-assignment.component.spec.ts \
  --include=src/app/features/admin/roles/role-permissions.component.spec.ts \
  --include=src/app/core/services/api/roles-api.service.spec.ts
→ Test Files  6 passed (6)
  Tests       47 passed (47)
  exit code   0
```

This is **same-or-better** than the previous Unit C run (6 files / 46 tests / 0 failures at `9a7988c`): +1 passing test (the new regression test) and zero new failures. Every previously verified Unit C behavior still passes.

### Completeness

| Metric | Value |
|--------|-------|
| Unit C tasks total | 18 (2.1–2.18) |
| Unit C tasks complete | 18 |
| Unit C tasks incomplete | 0 |

`tasks.md` marks 2.1–2.18 `[x]`, consistent with the commit contents and the apply-progress observation. Unit A tasks 1.1–1.10 remain `[x]` and were verified in the appendix.

### Build & Tests Execution

**Build**: ✅ Passed
```text
npx ng build → exit 0. "Application bundle generation complete."
Warnings (pre-existing, not introduced by this change): initial bundle budget 500 kB exceeded
by 329.38 kB (total 829.38 kB); provider-availability.component.scss budget 12 kB exceeded by
1.52 kB; module 'luxon' used by admin-dashboard is not ESM (CommonJS bailout note).
Output location: /home/seba/codingProjects/Bookwise/dist/bookwise
```

**Tests (focused Unit C specs — envelope evidence)**: ✅ 47 passed / ❌ 0 failed / ⚠️ 0 skipped
```text
npx ng test --no-watch \
  --include=src/app/core/services/http-error.service.spec.ts \
  --include=src/app/features/admin/roles/roles.store.spec.ts \
  --include=src/app/features/admin/roles/roles.component.spec.ts \
  --include=src/app/features/admin/roles/roles-assignment.component.spec.ts \
  --include=src/app/features/admin/roles/role-permissions.component.spec.ts \
  --include=src/app/core/services/api/roles-api.service.spec.ts
→ Test Files  6 passed (6)
  Tests       47 passed (47)
  exit code   0
```

**Tests (full aggregate suite — baseline bar)**: ❌ 38 failed / ✅ 498 passed (536) / 4 failed files (47)
```text
npx ng test --no-watch → exit 1
Test Files  4 failed | 43 passed (47)
     Tests  38 failed | 498 passed (536)
```

Observed failure set, per file, is **exactly** the documented pre-existing set:

| Spec file | Failures | Root cause |
|-----------|----------|------------|
| `full-calendar.component.spec.ts` | 32 | `NG0201: No provider found for ActivatedRoute` — pre-existing TestBed defect |
| `historial-reserva.component.spec.ts` | 3 | pre-existing (`ctx.bookingsShowingCount is not a function`) |
| `booking-form-dialog.component.spec.ts` | 2 | pre-existing (`window.matchMedia is not a function`) |
| `calendar-navigation.service.spec.ts` | 1 | pre-existing (`queryParams: undefined` arg) |
| **Total** | **38** | |

**Baseline bar — "no new failures vs baseline"**: ✅ MET.

| Run | Failed | Passed | Total |
|-----|--------|--------|-------|
| Unit A verify (`b4bbd98`) | 38 | 463 | 501 |
| Unit C verify (`9a7988c`) | 38 | 497 | 535 |
| **Unit C re-verify (this run, `57b367c`)** | **38** | **498** | **536** |

Failure count is **identical (38)**, same 4 files, same root causes; the pass count grew by exactly **+1** (the new regression test). Zero new failures, zero fixed, so the aggregate baseline holds. The 4 failing files are untouched by this change and fail for pre-existing reasons. A non-green aggregate suite is therefore **not** a CRITICAL for this unit; the correct bar — no new failures — holds.

**Coverage**: ➖ Not available / not configured for this scoped run (Angular `@angular/build:unit-test` builder; no coverage report requested).

### Spec Compliance Matrix

#### `role-permissions-matrix` (4 requirements / 9 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| View the permission catalog | Catalog rendered dynamically | `role-permissions.component.spec.ts > renders the catalog groups and items dynamically (no hardcoded values)` | ✅ COMPLIANT |
| View the permission catalog | Unknown key falls back to backend label | `role-permissions.component.spec.ts > resolves permission labels via i18n with backend label and raw-key fallbacks` | ✅ COMPLIANT |
| View the permission catalog | Catalog unavailable | `role-permissions.component.spec.ts > renders an error state with retry and hides the matrix when the catalog errors` + `renders an empty state and hides the matrix when the catalog has zero groups` | ✅ COMPLIANT |
| View a role's current permissions | Role permissions preselected | `role-permissions.component.spec.ts > preselects the first role permissions by default` + `reselects the draft when another role is chosen` | ✅ COMPLIANT |
| View a role's current permissions | Tenantless admin | `roles.store.spec.ts > redirects to onboarding on 409 onboarding_required (no generic error)` + `roles.component.spec.ts > redirects to onboarding when GET /v1/roles responds 409 onboarding_required` + `http-error.service.spec.ts > isOnboardingRequired` truth table | ✅ COMPLIANT |
| Replace a role's permission set | Save edited permissions | `role-permissions.component.spec.ts > dedupes keys before sending the PATCH` + `emits the success toast on the global key so the app shell renders it` + `roles.store.spec.ts > patches the role from res.data.permissions on success` + `roles-api.service.spec.ts > PATCHes /roles/{id}/permissions with { permissions: [...] }` | ✅ COMPLIANT |
| Replace a role's permission set | Clearing all permissions requires confirmation | `role-permissions.component.spec.ts > requires confirmation before clearing all permissions` | ✅ COMPLIANT |
| Replace a role's permission set | 422 or 404 reverts and refetches | `role-permissions.component.spec.ts > reverts the draft and refetches roles on 422` (+ `roles.store.spec.ts > re-throws the raw HttpErrorResponse (e.g. 422) without touching state`) | ✅ COMPLIANT |
| Enforcement warning and no restore control | Warning and no restore | `role-permissions.component.spec.ts > shows the persistent deferred-enforcement warning and no restore control` | ✅ COMPLIANT |

#### `roles-assignment` (Unit C portion, 2 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| List business roles | Tenantless admin | `roles.store.spec.ts > redirects to onboarding on 409 onboarding_required (no generic error)` + `roles.component.spec.ts > redirects to onboarding when GET /v1/roles responds 409 onboarding_required` | ✅ COMPLIANT |
| Assign roles to a provider | Invalid selection rejected by the API | `roles-assignment.component.spec.ts > reverts the selection and refetches providers on 422` | ✅ COMPLIANT |

**Compliance summary**: **11/11 in-scope scenarios compliant** — every scenario has a covering test that passed at runtime (0 UNTESTED, 0 FAILING). The new regression test now also guards the success-toast emission of "Save edited permissions". Regression of the extracted assignment component is proven: `roles-assignment.component.spec.ts > blocks saving an empty selection (no PATCH)` and `> dedupes slugs before sending the PATCH`.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Catalog rendered dynamically (no hardcoding) | ✅ Implemented | `role-permissions.component.html` iterates `@for (group of catalog(); track group.group)` and `@for (item of group.items; track item.key)`. The component holds no group names, item keys, or counts; the only permission-key strings in production code are the i18n label keys in `core/i18n/{es,en}.ts`. |
| Label resolution (i18n → backend label → raw key) | ✅ Implemented | `permissionLabel(item)`: `roles.permission.<key>` via `lang.has()`, else `item.label \|\| item.key`. `permissionGroupLabel(group)`: `roles.permission_group.<group>` via `lang.has()`, else raw `group` slug. Matches design D5. |
| Role permissions preselected by slug | ✅ Implemented | `selectedRoleSlug` signal + `selectedRole` computed (`roles.find(r => r.slug === slug) ?? roles[0]`); `draft` is a `linkedSignal` re-derived from `role.permissions`. Templates use `track role.slug`; `selectRole(role)` stores `role.slug`. `name` is display-only. |
| Replace-save semantics, no optimistic state | ✅ Implemented | `save()` sends `[...new Set(this.draft())]` (deduped full set) via `store.updateRolePermissions(role.id, keys)`. The store patches `roles` **only** on the 200 response from `res.data.permissions` (`roles.store.ts` lines 107–118). No local optimistic mutation exists; on error the draft is reset from the unchanged store role. |
| **Success toast keyed to the rendered toast** | ✅ Implemented (fixed in `57b367c`) | `persist()` success branch adds `key: 'global'`, matching the only rendered toast (`admin-layout.component.html:1` `<p-toast key="global">`). Without it the message was silently dropped. Guarded by the new regression test. |
| Clear-all requires confirmation | ✅ Implemented | `save()` with an empty deduped set routes to `confirmClear()`, which calls `ConfirmationService.confirm`; `persist(role, [])` runs only inside the `accept` callback. |
| 422/404 revert + refetch | ✅ Implemented | `persist()` error handler: `this.draft.set([...role.permissions])` then `this.store.loadRoles()` (GET `/v1/roles` refetch) then `httpError.handle(err, …)`. Both 422 and 404 flow through the same error branch. |
| 409 `onboarding_required` not generic | ✅ Implemented | `isOnboardingRequired(err)` is a pure predicate (`status === 409 && err.error?.error === 'onboarding_required'`). `RolesStore.loadRoles()` redirects via `router.navigate(['/onboarding'])` and leaves `rolesError` null; no toast is emitted. |
| Catalog unavailable gate | ✅ Implemented | Template: `@else if (catalogError() \|\| !catalogReady())` renders `.catalog-state` with the i18n error/empty message and a retry button; the `.matrix` and `.save-btn` render only in the `@else` branch. `catalogReady()` = `catalog().length > 0`. |
| Enforcement warning present, no restore control | ✅ Implemented | `p-message severity="warn" [text]="lang.t('roles.permissions.warning')"` renders unconditionally at the top of the template (outside the catalog gate). No `restore`/`reset` control or `.restore-baseline` element exists anywhere in the roles feature; the reset endpoint is not referenced. |
| Assignment preserved (block-empty, dedupe, 422) | ✅ Implemented | `roles-assignment.component.ts` re-implements the extracted UI: `save()` blocks an empty set and an invalid slug set, dedupes via `new Set`, enforces the `admin_general` invariant, and on error reverts `selectedRoleSlugs` to `currentProviderSlugs()` then calls `refStore.invalidateProviders()` + `httpError.handle`. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 — tab shell, `providers: [RolesStore]`, one `loadRoles()`, in-page tabs | ✅ Yes | `RolesComponent` is the `p-tabs` shell; `providers: [RolesStore]`; a single `loadRoles()` in `ngOnInit`; no `app.routes.ts` change. New `roles-assignment` and `role-permissions` components created. |
| D2 — feature-scoped `RolesStore`; catalog cached, lazy, patch-on-200 | ⚠️ Partial (documented, unchanged) | Store shape, `loadCatalog()` cache/no-op, and `updateRolePermissions` patch-on-200 all match. **Deviation still present at HEAD**: both `p-tabpanel`s mount eagerly (`roles.component.html` lines 13–20, no `lazy`/`@if` guard), so `RolePermissionsComponent.ngOnInit → loadCatalog()` fires the tenantless `GET /v1/roles/permissions` on every `/admin/roles` visit, even when the user never opens Permisos. No spec scenario is violated (the scenario requires the call, not its timing). Recorded as WARNING. |
| D3 — service throws raw `HttpErrorResponse`; no typed result | ✅ Yes | `RolesApiService` methods return the raw HTTP observable; `updateRolePermissions` re-throws in the store; `HttpErrorService` consumes `HttpErrorResponse`. |
| D4 — `isOnboardingRequired` predicate, per-screen 409, 422/404 revert+refetch, catalog gate, `p-confirmDialog` | ✅ Yes | All implemented as specified. Confirmation uses `ConfirmationService` provided at component level (PrimeNG 21 is not `providedIn: 'root'`). The `57b367c` toast-key fix is consistent with D4's error-toast path, which already forced `key: 'global'` in `HttpErrorService.toToastConfig()`. |
| D5 — i18n by key with backend/raw fallbacks | ✅ Yes | `permissionLabel` / `permissionGroupLabel` mirror `roleLabel`. Catalog i18n keys seeded from the backend source of truth (13 keys, 5 groups), resolving design Open Question #2; the UI still renders dynamically. |
| D8 — Standard Mode testing strategy | ✅ Yes | All 6 new/modified spec layers from the D8 table exist and pass. One documented deviation: `roles-assignment.component.scss` was added (design listed only `.ts/.html`) because Angular emulated encapsulation requires moving the assignment/card styles out of the shell scss. Style-only; no spec impact. |

### Issues Found

**CRITICAL**: None. (0 blockers, 0 critical findings; all 11 in-scope scenarios have passing covering tests, and the `57b367c` fix is verified correct, complete, and guarded.)

**WARNING**:
1. **Catalog is fetched eagerly, not lazily (D2 intent) — STILL PRESENT at `57b367c`.** Both `p-tabpanel`s mount eagerly, so `RolePermissionsComponent.ngOnInit` calls `loadCatalog()` on `/admin/roles` load. A user who only uses the Asignación tab still triggers the tenantless `GET /v1/roles/permissions`. This violates the *intent* of D2's "lazy" catalog but no spec scenario (timing is not asserted by the spec). Fix would be to gate the load on tab activation or render the panel lazily. Not introduced or worsened by the fix commit.
2. **Manual runtime harness not re-executed after the fix.** The tasks table specifies `/admin/roles` → Permisos tab renders and saves. The user's manual testing surfaced the lost-toast defect that `57b367c` fixes; the step still cannot be driven headlessly and is recorded below as pending. It is **not** claimed as verified here.

**SUGGESTION** (non-blocking test polish):
- The permission-item i18n test uses fixtures whose `label` equals the i18n value (`'Ver turnos'` for both), so it cannot distinguish the i18n path from the backend-label fallback for items. The fallback path *is* proven (`custom.thing` → `'Custom Thing'`; empty label → raw key), and the group i18n path *is* distinct (`'bookings'` → `'Turnos'`). Using distinct values would prove item-level i18n precedence.
- The 404 branch of "422 or 404 reverts and refetches" shares the 422 error handler but has no dedicated test; a 404 case would harden the clause.
- No test injects a brand-new *unknown group* into the catalog to assert it renders with the raw-slug fallback; the method-level test (`permissionGroupLabel('unknown_group')`) covers the resolver, but a render-level assertion would fully exercise "a new group renders without a code change".

### Manual Verification Step (PENDING — user action required)

| Step | Expected | Status |
|------|----------|--------|
| Open `/admin/roles`, switch to the **Permisos** tab with a tenant that has the permission catalog seeded, change permissions and save | The matrix renders the grouped catalog, the active role's permissions are preselected, saving persists, **the success toast is visible**, and the deferred-enforcement warning is visible | ⏳ PENDING — cannot be driven headlessly; requires a browser + running backend. The toast-visibility part is the specific defect `57b367c` fixes and is now guarded by a unit test. |

This step is **not verified** by this report. It must be executed by the user before Unit C is considered runtime-validated.

### Verdict

**PASS WITH WARNINGS** — The re-verification at `57b367c` confirms the `key: 'global'` fix is correct and complete: the success toast is now routed to the only rendered `<p-toast key="global">`, and no other Unit C toast call site is unkeyed. The regression test is a **real guard, not a tautology** — `expect.objectContaining({ severity: 'success', key: 'global' })` cannot match an object lacking `key`, proven empirically on both exact shapes. All 6 Unit C requirements and all 11 in-scope scenarios still have covering tests that passed at runtime (0 UNTESTED, 0 FAILING); the focused Unit C run is 6 files / 47 tests / 0 failures (same-or-better than 46 at `9a7988c`), and `npx ng build` exits 0. The full aggregate suite is 38 failed / 498 passed (536) — exactly the documented pre-existing 38-failure baseline, zero new failures, +1 net passing test. Warnings are the unchanged eager (non-lazy) catalog fetch relative to D2's intent and the pending manual `/admin/roles` runtime check. The reset endpoint / restore-baseline UI and proactive 403 detection are correctly absent per the declared out-of-scope set.

---

## Appendix — Unit A verification (previously completed; scope preserved)

```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:52933970d261873759fd5f7e8a1ce35cc36a4ffa9d09d31a4a54061740dfe98a
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 4/4
scenarios: 6/6
test_command: npx ng test --no-watch --include=src/app/features/admin/roles/roles.component.spec.ts --include=src/app/features/admin/roles/role-guards.spec.ts --include=src/app/features/admin/roles/role-meta.spec.ts --include=src/app/core/services/api/roles-api.service.spec.ts --include=src/app/features/admin/providers/providers-list.component.spec.ts --include=src/app/features/admin/providers/provider-dialog/provider-dialog.component.spec.ts --include=src/app/core/stores/reference.store.spec.ts
test_exit_code: 0
test_output_hash: sha256:52933970d261873759fd5f7e8a1ce35cc36a4ffa9d09d31a4a54061740dfe98a
build_command: npx ng build
build_exit_code: 0
build_output_hash: sha256:0979e879334b08ce6d8164d9544c1b039adba776a7bfcf6d00fa8ce22ffd3bd2
```

### Verification Report

**Change**: 2026-09-19-rbac-frontend
**Work unit verified**: A — slug migration ONLY (Unit C — permission matrix — is NOT implemented and is explicitly out of this verification)
**Version**: N/A (frontend-only delta; `roles-assignment` capability)
**Mode**: Standard (`strict_tdd: false`)
**Branch / commit**: `feat/rbac-frontend-01-slug-migration` @ `b4bbd98` (17 files, +242 / −158)
**Date**: 2026-09-19

#### Scope

This report verifies the `roles-assignment` delta only, and only the part owned by work unit A (tasks 1.1–1.10). The delta spec contains **4 requirements / 8 scenarios**. Two scenarios belong to Unit C per `tasks.md` and are **deferred, not defects**:

- `List business roles / Tenantless admin` (409 `onboarding_required` redirect) — Unit C task 2.1/2.2.
- `Assign roles to a provider / Invalid selection rejected by the API` (422 revert + refetch) — Unit C task 2.5.

The `role-permissions-matrix` capability is entirely Unit C and was not read for compliance beyond the shared delta spec. The Unit A authoritative totals are therefore **4 requirements / 6 scenarios**, all verified below.

#### Completeness

| Metric | Value |
|--------|-------|
| Unit A tasks total | 10 (1.1–1.10) |
| Unit A tasks complete | 10 |
| Unit A tasks incomplete | 0 |
| Unit C tasks total | 18 (2.1–2.18) |
| Unit C tasks complete | 0 — out of scope, not verified |

`tasks.md` marks 1.1–1.10 `[x]` and 2.1–2.18 `[ ]`, consistent with the apply-progress claim and the commit contents. Unit A is a single atomic commit as required by design D6.

#### Build & Tests Execution

**Build**: ✅ Passed
```text
npx ng build → exit 0. "Application bundle generation complete."
Warnings (pre-existing, not introduced by this change): initial bundle budget 500 kB exceeded
by 329.38 kB (total 829.38 kB); provider-availability.component.scss budget 12 kB exceeded by
1.52 kB; module 'luxon' used by admin-dashboard is not ESM (CommonJS bailout note).
Output location: /home/seba/codingProjects/Bookwise/dist/bookwise
```

**Tests (focused migrated specs — envelope evidence)**: ✅ 101 passed / ❌ 0 failed / ⚠️ 0 skipped
```text
npx ng test --no-watch \
  --include=.../roles/roles.component.spec.ts \
  --include=.../roles/role-guards.spec.ts \
  --include=.../roles/role-meta.spec.ts \
  --include=.../api/roles-api.service.spec.ts \
  --include=.../providers/providers-list.component.spec.ts \
  --include=.../providers/provider-dialog/provider-dialog.component.spec.ts \
  --include=.../stores/reference.store.spec.ts
→ Test Files  7 passed (7)
  Tests       101 passed (101)
  exit code   0
```

**Tests (full aggregate suite — baseline bar)**: ❌ 38 failed / ✅ 463 passed (501) / 4 failed files (43)
```text
npx ng test --no-watch → exit 1
Test Files  4 failed | 39 passed (43)
     Tests  38 failed | 463 passed (501)
```

Observed failure set, per file, is **exactly** the documented pre-existing set:

| Spec file | Failures | Root cause |
|-----------|----------|------------|
| `full-calendar.component.spec.ts` | 32 | `NG0201: No provider found for ActivatedRoute` — pre-existing TestBed defect |
| `historial-reserva.component.spec.ts` | 3 | pre-existing |
| `booking-form-dialog.component.spec.ts` | 2 | pre-existing |
| `calendar-navigation.service.spec.ts` | 1 | pre-existing (`queryParams: undefined` arg) |
| **Total** | **38** | |

**Baseline bar — "no new failures vs baseline"**: ✅ MET. Re-run confirms **38 failed / 463 passed (501)**, matching the apply-phase controlled pair (**38 before, 38 after, zero added, zero fixed**). The 4 failing files are not part of this change (only `full-calendar.component.spec.ts` was touched, and only its role fixtures — the failures are `NG0201` at TestBed creation, independent of fixture shape). A non-green aggregate suite is therefore **not** a CRITICAL for this unit; the correct bar is zero new failures, which holds.

**Coverage**: ➖ Not available / not configured for this scoped run (Angular `@angular/build:unit-test` builder; no coverage report requested).

#### Spec Compliance Matrix (Unit A in-scope scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Roles are keyed by slug | Providers filtered by slug | `role-meta.spec.ts > hasAttentionRole > matches a provider holding staff by slug` (+ `staff_readonly`, + `rejects … only role is recepcionista`) | ✅ COMPLIANT |
| Roles are keyed by slug | Role display fallback | `roles.component.spec.ts > falls back to the backend name when the slug has no i18n key` | ✅ COMPLIANT |
| List business roles | Admin general lists roles | `roles.component.spec.ts > renders the six business roles` + `roles-api.service.spec.ts > getRoles > unwraps { data: Role[] }` | ✅ COMPLIANT |
| Assign roles to a provider | Assign roles successfully | `roles.component.spec.ts > assigns roles via the store and updates the canonical store state` + `roles-api.service.spec.ts > PATCHes /providers/{id}/roles with { roles: [...] }` | ✅ COMPLIANT |
| Assign roles to a provider | Empty selection is blocked | `roles.component.spec.ts > blocks saving an empty selection (no PATCH)` + `provider-dialog.component.spec.ts > blocks saving when the roles set is empty (no requests)` | ✅ COMPLIANT |
| admin_general is unique and non-removable | Removing admin_general is blocked | `roles.component.spec.ts > blocks removing admin_general (no PATCH)` + `role-guards.spec.ts > re-adds admin_general when the holder attempts to remove it` + `provider-dialog.component.spec.ts > re-adds admin_general when its holder tries to remove it` | ✅ COMPLIANT |

**Compliance summary**: 6/6 in-scope scenarios compliant — every scenario has a covering test that passed at runtime (0 UNTESTED, 0 FAILING in scope). 2 further delta scenarios are deferred to Unit C by `tasks.md` (409 onboarding; 422 revert+refetch) and are excluded from the authoritative total, not counted as defects.

#### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Roles keyed by slug; `label` gone | ✅ Implemented | `Role` is now `{ id, slug, name, permissions }`; `label` removed. New `PermissionItem`, `PermissionGroup`, `RolePermissionsResponse` added for Unit C use. |
| No consumer uses `name` as identifier | ✅ Implemented | Grep over `src/app` finds no remaining `role.name` / `r.name` identity usage, no `roleNames` / `selectedRoleNames`. Remaining `.name` uses are display-only (`roleLabel` fallback, provider first/last name, location name). `RoleOption.value` is `r.slug`. |
| `roleLabel` fallback to backend `name` | ✅ Implemented | `roleLabel(role: Pick<Role,'slug'\|'name'>)` → `roles.role.${slug}` via `lang.has`, else `role.name`; identical in `roles.component.ts`, `providers-list.component.ts`, `provider-dialog.component.ts`. i18n keys exist for the 6 slugs, so only unknown slugs fall back. |
| Calendar filter matches by slug | ✅ Implemented | `role-meta.ts > hasAttentionRole(roles?: { slug: string }[])` matches `ATTENTION_ROLES = ['staff','staff_readonly']` against `role.slug`; `full-calendar.component.ts > providerOptions` filters `p.active && hasAttentionRole(p.roles)`. Live bug (matching `'Staff'` vs `['staff','staff_readonly']`) is fixed. |
| `admin_general` invariant matches by slug | ✅ Implemented | `role-guards.ts` unchanged logic, renamed params; `ADMIN_GENERAL_ROLE = 'admin_general'`; `isAdminGeneralLocked(current, slug)` returns `slug === ADMIN_GENERAL_ROLE`; `applyAdminGeneralInvariant` re-adds for holders / drops for non-holders and collapses duplicates. Callers pass `role.slug` / `r.slug`. |
| Assignment sends slugs | ✅ Implemented | `RolesApiService.assignProviderRoles(id, slugs)` sends `{ roles: slugs }` to `PATCH /providers/{id}/roles`. `roles.component.save()` sends `selectedRoleSlugs`; `provider-dialog` sends `raw.roleSlugs` through `applyAdminGeneralInvariant`. Empty set blocked before any request; `onRoleChange` uses a `Set` and the invariant collapses duplicates, so no duplicate slugs are sent. |
| 409 handling left unchanged (expected) | ✅ Confirmed unchanged | `http-error.service.ts` exports no `isOnboardingRequired`; `roles.component.loadData()` still routes errors through `httpError.handle`. No `onboarding_required` i18n keys exist. This is the expected Unit A state — the 409 redirect is Unit C. |
| Spec fixtures migrated to true shape | ✅ Implemented | 6 existing specs + `reference.store.spec.ts` use `{ id, slug, name, permissions: [] }`; `role-meta.spec.ts` added. Fixture migration is the detector design D6 relies on to turn any missed `.name`-as-key RED. |

#### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D6 — Atomic migration order (models → meta/guards → service → consumers → specs) | ✅ Yes | One commit `b4bbd98`; compiler not treated as guardrail; fixtures migrated in the same commit. |
| D6 — `full-calendar.component.ts` needs no change (passes `p.roles` to `hasAttentionRole`) | ✅ Yes | Production calendar component unchanged; only its spec fixtures changed. |
| D7 — `roleLabel(role)` / `roleDesc(role)`; `track role.slug`; identity renames | ✅ Yes | All three consumers use the role object; templates use `track role.slug`, `roleMeta(role.slug)`, `isRoleLocked(role.slug)`, `isRoleChecked(role.slug)`, `onRoleChange($event, role.slug)`. `selectedRoleNames`→`selectedRoleSlugs`; dialog control `roleNames`→`roleSlugs`. |
| D7 — `currentProviderRoles` → slug set | ✅ Yes | Renamed to `currentProviderSlugs` (a `Set<string>` of slugs); no external references. |
| D8 — "7 specs" | ⚠️ Deviation (documented) | Only 6 existing specs held `Role` object fixtures; a new `role-meta.spec.ts` was added to cover the calendar-filter scenario, so 7 spec files are touched in total. Consistent with apply-progress. |

#### Issues Found

**CRITICAL**: None. (0 blockers, 0 critical findings.)

**WARNING**:
1. **Integration-level calendar coverage is blocked by a pre-existing defect.** The slug filter in `full-calendar.component.ts > providerOptions` is proven only at the unit level (`role-meta.spec.ts` calls `hasAttentionRole` directly). `full-calendar.component.spec.ts` fails wholesale with `NG0201: No provider found for ActivatedRoute`, so the component's own filtered `providerOptions` cannot be observed in that spec. The behavior is correct by source inspection + unit test, but the component-level assertion is absent. Not caused by this change; fixing the TestBed (`ActivatedRoute` provider) would close the gap.
2. **Manual runtime harness not executed.** The tasks table specifies `/admin/calendar` should list `staff` providers. This cannot be automated headlessly and is recorded below as a pending manual step; it is **not** claimed as verified.

**SUGGESTION** (non-blocking test polish):
- No test asserts slug deduplication at the `roles.component.save()` boundary directly; dedupe is structurally guaranteed by the `Set` in `onRoleChange` and by `applyAdminGeneralInvariant` (covered by `role-guards.spec.ts > collapses duplicates when re-adding`). A direct assertion would harden the "duplicate slugs MUST NOT be sent" clause.
- `roles.component.spec.ts > renders the six business roles` asserts the count (6) and label count (6) but not that the rendered identity is `slug`; the slug keying is instead proven by the fixture shape + `role-meta.spec.ts`.

#### Manual Verification Step (PENDING — user action required)

| Step | Expected | Status |
|------|----------|--------|
| Open `/admin/calendar` with a tenant that has at least one active provider holding `staff` (or `staff_readonly`) | The provider appears in the professionals selector (previously empty) | ⏳ PENDING — cannot be driven headlessly; requires a browser + running backend |

This step is **not verified** by this report. It must be executed by the user before the change is considered runtime-validated.

#### Verdict

**PASS WITH WARNINGS** — All 4 Unit A requirements are implemented and all 6 in-scope scenarios have covering tests that passed at runtime (0 UNTESTED, 0 FAILING); the focused migrated-spec run is 7 files / 101 tests / 0 failures, and `npx ng build` exits 0. The full aggregate suite re-run is 38 failed / 463 passed (501) — exactly the documented pre-existing baseline (zero new failures, zero fixed), so it is not a CRITICAL for this unit. Warnings are the pre-existing `full-calendar` TestBed defect that blocks integration-level calendar coverage and the pending manual `/admin/calendar` runtime check. The 2 remaining delta scenarios (409 onboarding, 422 revert+refetch) are Unit C scope and were not expected here.
