```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:c9e2bee58189b0faae9677ac9a679c8b0ec1f9c381aadf675fb63452c3cc3542
verdict: fail
blockers: 0
critical_findings: 0
requirements: 3/4
scenarios: 5/7
test_command: npx ng test --no-watch
test_exit_code: 1
test_output_hash: sha256:0f2631e2ab3bc03a25a6cca699e058c7f4603f590afe32194b9eb0600d3f5480
build_command: npx ng build
build_exit_code: 0
build_output_hash: sha256:3e2ea6398a73a434e10e3da58650cfb7962afc57eabd4b6ee4a54470ae71ae8c
```

## Verification Report

**Change**: admin-general-lock
**Version**: N/A (delta spec)
**Mode**: Standard (strict_tdd: false)
**Scope**: Frontend lock only (tasks 1.1–1.9). Requirement 4 (backend companion) is intentionally out of scope.
**Branch**: `test/integration-rbac-tenant-switch` @ `6fb159b` (lock merged from `fdde5bf`)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 13 |
| Tasks complete | 9 |
| Tasks incomplete | 4 |

- Frontend tasks 1.1–1.9: **9/9 complete** (committed `fdde5bf`, merged `6fb159b`; no diff to the four component files between `fdde5bf` and `HEAD`).
- Backend companion tasks 2.1–2.4: **0/4 complete** — intentionally out of scope (Bookwise-API handoff, spec Requirement 4 marked `Status: NOT IMPLEMENTED`).

### Build & Tests Execution
**Build**: ✅ Passed (exit 0)
```text
$ npx ng build
Application bundle generation complete. [10.513 seconds]
Output location: /home/seba/codingProjects/Bookwise/dist/bookwise
EXIT=0
```
Only pre-existing warnings (initial-bundle budget, provider-availability style budget, luxon CommonJS). No errors.

**Tests**: ❌ 606 passed / 6 failed / 0 skipped (612 total, 52 files)
```text
$ npx ng test --no-watch
 Test Files  3 failed | 49 passed (52)
      Tests  6 failed | 606 passed (612)
   Duration  32.76s
EXIT=1
```
Observed failures (exactly the declared pre-existing baseline, none in files touched by this change):
1. `calendar-navigation.service.spec.ts` — `calls router.navigate with /admin/calendar` (intermittent)
2. `booking-form-dialog.component.spec.ts` — `window.matchMedia is not a function` (2 tests)
3–5. `historial-reserva.component.spec.ts` — `ctx.bookingsShowingCount is not a function` (3 tests)

**Baseline comparison**: declared baseline = 6 pre-existing failures. Observed after = **6 failures, identical files and identities. New failures attributable to this change: 0.** The bar is "no new failures vs baseline", and it is met.

**Focused covering spec**: ✅ `role-permissions.component.spec.ts` — 17/17 passed, 1 file.
```text
$ npx ng test --no-watch --include 'src/app/features/admin/roles/role-permissions.component.spec.ts'
 Test Files  1 passed (1)
      Tests  17 passed (17)
EXIT=0
```

**Coverage**: ➖ Not available (no coverage threshold configured).

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Lock the admin_general permission matrix | Toggle is a no-op for admin_general | `role-permissions.component.spec.ts > locks the admin_general matrix: toggles are a no-op` | ✅ COMPLIANT |
| Lock the admin_general permission matrix | Save is blocked for admin_general | `role-permissions.component.spec.ts > never calls the store when saving the locked admin_general role` | ✅ COMPLIANT (empty-draft variant not exercised — see SUGGESTION) |
| Other roles remain editable | Non-locked role toggles and saves normally | `role-permissions.component.spec.ts > still toggles and saves a non-locked role normally` | ✅ COMPLIANT |
| Explain why the matrix is locked | Lock indicator explains the rule | `role-permissions.component.spec.ts > renders the lock indicator only for the locked role` | ⚠️ PARTIAL (note + `pi pi-lock` + i18n copy asserted; disabled checkbox/save state not asserted at runtime) |
| Explain why the matrix is locked | Indicator is absent for other roles | `role-permissions.component.spec.ts > renders the lock indicator only for the locked role` | ⚠️ PARTIAL (absence asserted; enabled checkbox/save state not asserted at runtime) |
| Backend rejects a reduced admin_general set | Direct PATCH is rejected | (none — backend companion, intentionally NOT IMPLEMENTED) | ❌ UNTESTED (out of scope, expected) |
| Backend rejects a reduced admin_general set | Reset stays consistent with the invariant | (none — backend companion, intentionally NOT IMPLEMENTED) | ❌ UNTESTED (out of scope, expected) |

**Compliance summary**: 5/7 scenarios have passing runtime coverage (3 COMPLIANT, 2 PARTIAL); 2 UNTESTED are the intentionally-unsatisfied backend companion.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Lock the admin_general permission matrix | ✅ Implemented | `togglePermission()` early-returns when `isAdminGeneralLocked()` (`role-permissions.component.ts:99-101`); `save()` early-returns before dedupe/confirmation/persist (`:133-138`). |
| Other roles remain editable | ✅ Implemented | Guards only trigger when `selectedRole()?.slug === ADMIN_GENERAL_ROLE`; `staff` path unchanged. |
| Explain why the matrix is locked | ✅ Implemented | Template renders `.permissions-lock` + `pi pi-lock` + `roles.permissions.admin_general_locked` only under `isAdminGeneralLocked()` (`role-permissions.component.html:44-51`); `[disabled]="isAdminGeneralLocked()"` on `p-checkbox` (`:63`) and save `p-button` (`:77`); `.permissions-lock` styles present (`scss:96-111`); i18n key added to `es.ts:855` and `en.ts:799`. |
| Lock derives from shared constant | ✅ Implemented | `import { ADMIN_GENERAL_ROLE } from './role-guards'` (`:13`); computed compares against `ADMIN_GENERAL_ROLE` (`:74`). No hardcoded `'admin_general'` string literal in the component logic or template (only the i18n key `...admin_general_locked` and a doc comment). |
| Backend rejects a reduced admin_general set | ⛔ Not implemented | Expected. Spec Requirement 4 honestly records `Status: NOT IMPLEMENTED — backend companion (Bookwise-API) ... Currently unsatisfied`. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Single source of truth: reuse `ADMIN_GENERAL_ROLE` from `role-guards.ts` | ✅ Yes | Same constant as the assignment-tab lock; both cannot drift. |
| Derived lock signal `isAdminGeneralLocked` from `selectedRole` | ✅ Yes | `computed(() => this.selectedRole()?.slug === ADMIN_GENERAL_ROLE)`. |
| Guard `togglePermission(key, checked)` as early return | ✅ Yes | Draft never mutated for the locked role. |
| Guard `save()` before dedupe/confirmation/persist | ✅ Yes | No store call and no confirmation dialog. |
| Template: `[disabled]` on checkboxes and save button; `.permissions-lock` block | ✅ Yes | Both bindings present and keyed off the same signal. |
| i18n `roles.permissions.admin_general_locked` in `es.ts` and `en.ts` | ✅ Yes | Neutral Spanish copy matches the spec exactly; English copy present. |
| Backend companion in `RoleController::assignPermissions` | ⛔ Pending | Out of scope for this frontend verification. |

### Issues Found
**CRITICAL**: None attributable to this change. The canonical envelope is `fail` solely because `npx ng test --no-watch` exits `1` (the 6 declared pre-existing failures in unrelated specs; zero new failures) and because Requirement 4 / its 2 scenarios are intentionally unsatisfied (backend companion, explicitly out of scope). No in-scope defect was found.

**WARNING**:
1. Scenario "Lock indicator explains the rule" is PARTIAL: the spec requires the permission checkboxes and save button to be *disabled* while `admin_general` is selected, but no runtime assertion checks the disabled state. The static template binding is correct; only the test is incomplete.
2. Scenario "Indicator is absent for other roles" is PARTIAL: absence of the lock note is asserted, but the "checkboxes and save button are enabled" half is not asserted.
3. Requirement 4 (backend) remains unsatisfied. Expected and documented in the spec; tracked as the Bookwise-API handoff (tasks 2.1–2.4). The frontend lock is UX-only and is not a security boundary.

**SUGGESTION**:
1. Add an assertion that the save `p-button` and a `p-checkbox` are disabled for `admin_general` and enabled for a non-locked role (closes both PARTIAL scenarios).
2. Extend the "save is blocked" spec to also call `save()` with an empty draft, covering the spec's explicit "including with an empty draft" clause.

### Verdict
**FAIL (canonical, baseline-driven)** — The in-scope frontend lock (tasks 1.1–1.9) is correct: it is implemented, derives from the shared `ADMIN_GENERAL_ROLE` constant, and its covering spec passes 17/17 with **zero new failures** against the 6-failure baseline. The canonical envelope is `fail` because the required test command exits non-zero (6 pre-existing, unrelated failures) and because Requirement 4 and its 2 scenarios are intentionally unsatisfied (backend companion, out of scope). No in-scope defect was found; this is not archive-ready until the baseline suite is green and the backend companion ships.
