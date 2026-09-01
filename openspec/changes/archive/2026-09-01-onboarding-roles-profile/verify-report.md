```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:8cb33c0e188ec66ac4ca8c54335974e8e95a22312d16be38a7650ad4adabac67
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 8/8
scenarios: 14/14
test_command: npx ng test --no-watch --include='src/app/core/services/api/auth-api.service.spec.ts' --include='src/app/core/services/api/businesses-api.service.spec.ts' --include='src/app/core/services/api/roles-api.service.spec.ts' --include='src/app/core/services/auth.service.spec.ts' --include='src/app/core/guards/onboarding.guard.spec.ts' --include='src/app/features/auth/verify-email/verify-email.component.spec.ts' --include='src/app/features/admin/onboarding/onboarding.component.spec.ts' --include='src/app/features/admin/profile/profile.component.spec.ts' --include='src/app/features/admin/roles/roles.component.spec.ts'
test_exit_code: 0
test_output_hash: sha256:6062345724ce5c332d03730a050464806772b1b9d81febbff1736652c520cf63
build_command: npx ng build
build_exit_code: 0
build_output_hash: sha256:8db7f80f7969f4cb6d86e4703952e3ffb80b76d2ab61a1d2169420fcf37a2efa
```

## Verification Report

**Change**: onboarding-roles-profile
**Version**: N/A (frontend-only change; specs added in this change)
**Mode**: Standard (`strict_tdd: false` — verified in `openspec/config.yaml`)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 21 |
| Tasks complete | 21 |
| Tasks incomplete | 0 |

All tasks marked `[x]` in `tasks.md`; apply-progress reports 21/21. Task completion is consistent with the implementation present in the working tree.

### Build & Tests Execution
**Build**: ✅ Passed
```text
npx ng build → exit 0. "Application bundle generation complete."
Warnings (pre-existing, not from this change): initial bundle 500kB budget exceeded by 322.13 kB (total 822.13 kB, under the 1MB maximumError, so exit stays 0); module 'luxon' used by admin-dashboard is not ESM (CommonJS bailout note).
Output location: /home/seba/codingProjects/Bookwise/dist/bookwise
```

**Tests**: ✅ 30 passed (9 files) / ❌ 0 failed / ⚠️ 0 skipped
```text
npx ng test --no-watch (9 scoped --include spec files) →
  Test Files  9 passed (9)
       Tests  30 passed (30)
  Duration    2.99s
```

**Coverage**: ➖ Not available / not configured (`@angular/build:unit-test` builder; no coverage report requested in this verify scope).

**Note on expected counts**: The apply-progress/run notes describe "10 spec files / 31 tests". The actual change (verified via `git diff --name-only develop HEAD -- '*.spec.ts'`) touches **9** spec files and the scoped run produces **30** passing tests. The "31/31" figure appears to be an over-count in the apply-progress doc, not a missing test or a code defect. All 30 tests for the 9 changed spec files pass in isolation.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| onboarding-account / Email verification | Valid token | `verify-email.component.spec.ts > calls verifyEmail with the token and shows the success state` | ✅ COMPLIANT |
| onboarding-account / Email verification | Invalid or expired token | `verify-email.component.spec.ts > shows the error state for an invalid token` + `... when no token is provided` | ✅ COMPLIANT |
| onboarding-account / Business onboarding | Invalid form is not submitted | `onboarding.component.spec.ts > does not POST when the form is invalid` | ✅ COMPLIANT |
| onboarding-account / Business onboarding | Successful business creation | `onboarding.component.spec.ts > POSTs and navigates to /admin when the form is valid` | ✅ COMPLIANT |
| onboarding-account / Post-login redirection | Unfinished onboarding | `onboarding.guard.spec.ts > redirects to /onboarding when onboarding_complete=false` | ✅ COMPLIANT |
| onboarding-account / Post-login redirection | Completed onboarding | `onboarding.guard.spec.ts > allows access when onboarding_complete=true` | ✅ COMPLIANT |
| business-profile / Profile view | Profile displays personal and business data | `profile.component.spec.ts > renders business RUT/email read-only...` (business data rendered; GET /auth/me fetch satisfied via onboardingGuard→loadMe during /admin/profile nav; component is cache-aware by design) | ✅ COMPLIANT |
| business-profile / Profile view | Profile with no business | `profile.component.spec.ts > shows the CTA when business is null` | ✅ COMPLIANT |
| business-profile / Immutable business identity fields | Business fields shown read-only | `profile.component.spec.ts > renders business RUT/email read-only...` (readOnly asserted; warning `<p-message severity="warn">` rendered in profile.component.html — covered by source; a dedicated assertion is a SUGGESTION) | ✅ COMPLIANT |
| business-profile / Immutable business identity fields | Editing attempted | `profile.component.spec.ts > ... never issues an update request` (readOnly + no loadMe/update call) | ✅ COMPLIANT |
| roles-assignment / List business roles | Admin general lists roles | `roles.component.spec.ts > renders the six business roles` (getRoles via loadData; 6 roles) | ✅ COMPLIANT |
| roles-assignment / Assign roles to a provider | Assign roles successfully | `roles.component.spec.ts > assigns roles successfully via PATCH` | ✅ COMPLIANT |
| roles-assignment / Assign roles to a provider | Empty or invalid selection | `roles.component.spec.ts > blocks saving an empty selection (no PATCH)` (empty selection covered + validation error asserted; the invalid-role branch `!valid.has(name)` is implemented — a dedicated test is a SUGGESTION) | ✅ COMPLIANT |
| roles-assignment / admin_general non-removable | Removing admin_general is blocked | `roles.component.spec.ts > blocks removing admin_general (no PATCH)` | ✅ COMPLIANT |

**Compliance summary**: 14/14 scenarios compliant — a covering test passed at runtime for every scenario (0 UNTESTED, 0 FAILING). The 2 scenarios noted with a `SUGGESTION` have their core behavior asserted and fully implemented; only a secondary sub-assertion is missing from the test, which does not render them UNTESTED or FAILING.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| verify-email route `/verificar-email` | ✅ Implemented | Route present in `app.routes.ts` (public); component reads `?token=`, calls `verifyEmail(token)` → `PATCH /auth/verify-email`; success/error states (+login link); uses `bw-auth-layout`. No onboarding path from error state. |
| onboarding route `/onboarding` + form | ✅ Implemented | `roleGuard(['admin'])`; `NgForm` business form (name, RUT `[bwRut]`, email, address, phone `bw-phone-input`, plan select) with front validation (`isFormValid()`: Chilean RUT `isValidRut`, email, phone, required) before `POST /businesses`; on 201 updates `setMe`/`setUser` and routes to `/admin`. Invalid forms return before any POST. |
| profile route `/admin/profile` + GET /auth/me | ✅ Implemented | Child of `/admin`; `ProfileComponent` reads `auth.me()` (loaded via guard on nav); personal (name, email read-only + note, phone) + business section (RUT/email read-only + warning) or CTA when `business=null`. |
| roles route `/admin/roles` + GET /roles | ✅ Implemented | Child of `/admin`; `getRoles()` unwrap; provider selector (`getProviders`) + checkbox multi-select; `admin_general` rendered disabled (`isRoleLocked`) and `save()` rejects removal/assignment of admin_general; PATCH `/providers/{id}/roles`. |
| auth.service me/loadMe cache, sync login | ✅ Implemented | `me`/`meLoaded` signals + `loadMe(force)` cache (returns cached when `meLoaded` and not forced); `setMe()`; `login(token,user)` sets token+user and calls `navigateByRole` synchronously. `logout()` clears `me`. |
| onboardingGuard | ✅ Implemented | `loadMe()`; `!onboarding_complete` → `/onboarding`; on error → `/onboarding` (never authorizes onward). Attached to `/admin` (after `roleGuard(['admin'])`). |
| Models + services | ✅ Implemented | `Business`, `BusinessPlan`, `AuthMeData`, `AuthMeResponse`, `Role`, `CreateBusinessData/Response`; `Provider.roles?`; `auth-api` adds `verifyEmail`/`getMe` (unwrap `{data}`); `businesses-api`/`roles-api` unwrap `{data}`. |
| i18n + nav | ✅ Implemented | `nav.profile`/`nav.roles` in admin-layout menu; `verify_email.*`/`onboard.*`/`profile.*`/`roles.*` keys present in `es.ts`/`en.ts`. `guards/index.ts` exports `onboardingGuard`. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Unwrap `{data}` for /auth/me | ✅ Yes | `getMe()` `.pipe(map(r => r.data))`; `verifyEmail` returns `{data:{email_verified_at}}`. |
| Extend AuthService with me cache, sync login | ✅ Yes | `me`/`meLoaded`/`loadMe`/`setMe`; `login()` stays synchronous. |
| Guard-based onboarding trigger (option b) | ✅ Yes | `onboardingGuard` on `/admin` after `roleGuard`. |
| Personal email read-only (no invented PATCH) | ✅ Yes | Rendered `readonly` + `email_note`; follow-up documented, no dead endpoint. |
| Business RUT/email immutable + warning | ✅ Yes | `readonly` controls + `<p-message severity="warn">`. |
| admin_general unique / non-removable | ✅ Yes | `isRoleLocked(role.name)` disables checkbox; `save()` rejects removal/assignment via `admin_general_locked` error. |
| Provider.roles? current-state assumption | ✅ Yes (assumption) | `Provider.roles?` used by roles screen; depends on BE returning roles in `GET /providers` (open question, not a code defect). |
| Explicit `isFormValid()` for zoneless NgForm | ✅ Yes | Mirrors `register.component.ts` pattern; backstops NgForm not registering validators synchronously in zoneless tests. |

### Issues Found
**CRITICAL**: None. (0 blockers, 0 critical findings.)

**WARNING**: None blocking delivery. Two contract/open-question items remain (documented, not code defects):
1. `/auth/me` wrapper shape assumed `{data}` per repo pattern — confirm with BE (`AuthMeResponse.data`).
2. `GET /providers` returning each provider's `roles?` is assumed for the roles-screen current-state; if absent, the current selection will render empty until a `GET /providers/{id}/roles` endpoint is added.
Both are inherited from `design.md`/`apply-progress.md` open questions, not implementation defects.

**SUGGESTION** (non-blocking, test-coverage polish):
- `profile.component.spec.ts` does not assert the rendered warning message (`profile.business.warning` `<p-message severity="warn">`) for the "Business fields shown read-only" scenario.
- `roles.component.spec.ts` does not exercise the invalid-role branch (`!valid.has(name)`) of the "Empty or invalid selection" scenario.
- apply-progress.md states "10 spec files / 31 tests"; the actual scoped change is **9 spec files / 30 tests**. Update the doc for accuracy.

**Pre-existing failures (NOT from this change — verified untouched via git diff)**: `clients-api.service.spec.ts`, `booking-form-dialog.component.spec.ts`, `historial-reserva.component.spec.ts`, and a `booking.store.spec.ts` contamination case. None of these files are in `git diff develop HEAD`; they fall outside this change's scope and were not run in the scoped set above.

### Verdict
**PASS WITH WARNINGS** — All 8 requirements implemented and all 14 scenarios covered by passing runtime tests (0 UNTESTED, 0 FAILING); `ng test` scoped run 30/30 passed and `ng build` exited 0. The remaining items are non-blocking test-coverage polish (SUGGESTION), the apply-progress doc-count discrepancy, and BE-contract open questions already documented in design/apply-progress.
