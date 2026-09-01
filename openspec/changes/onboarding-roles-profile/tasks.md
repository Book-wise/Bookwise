# Tasks: Onboarding, Profile & Business Roles

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~950–1200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: models+API → PR 2: auth/guard+verify-email/onboarding+routes → PR 3: profile/roles+nav/i18n |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Models + API services (foundation, unused by UI yet) | PR 1 | `npx ng test --no-watch --include=src/app/core/services/api/*.service.spec.ts` | N/A — Vitest mock HttpClient in specs | Remove new services/types; no UI/deps consume them |
| 2 | AuthService cache + onboardingGuard + verify-email/onboarding views + routes/i18n | PR 2 | `npx ng test --no-watch --include=src/app/features/auth/verify-email/**` | Vitest fake API for components | Drop guard + new routes → /admin reachable as before |
| 3 | Profile + Roles views + admin nav + remaining i18n | PR 3 | `npx ng test --no-watch --include=src/app/features/admin/{profile,roles}/**` | Vitest fake API for components | Remove 2 child routes + 2 nav items |

## Phase 1: Models + API Services

- [x] 1.1 `src/app/core/models/index.ts`: add `Business`, `BusinessPlan`, `AuthMeData`, `AuthMeResponse`, `Role`, `CreateBusinessData`/`Response`; extend `Provider` with `roles?: Role[]`.
- [x] 1.2 `auth-api.service.ts`: add `verifyEmail(token)` → `PATCH /auth/verify-email` (unwrap `{data:{email_verified_at}}`) and `getMe()` → `GET /auth/me` (unwrap `{data}`).
- [x] 1.3 Create `businesses-api.service.ts`: `getBusiness()` (unwrap `{data:Business|null}`) and `createBusiness(data)` → `POST /businesses` (returns `{data:{business},user}`).
- [x] 1.4 Create `roles-api.service.ts`: `getRoles()` (unwrap `{data:Role[]}`) and `assignProviderRoles(id, roles)` → `PATCH /providers/{id}/roles`.
- [x] 1.5 Add `businesses-api.service.spec.ts` + `roles-api.service.spec.ts`: mock HttpClient; assert `{data}` unwrap + PATCH payload.
- [x] 1.6 Extend `auth-api.service.spec.ts`: cover `verifyEmail`/`getMe` unwrap.

## Phase 2: Auth Service + Guard

- [x] 2.1 `auth.service.ts`: add `me`/`meLoaded` signals + `loadMe()` (inject `AuthApiService`); keep `login()` synchronous.
- [x] 2.2 Create `guards/onboarding.guard.ts`: call `loadMe()`; if `!onboarding_complete` → `/onboarding`, else allow; never authorize onward.
- [x] 2.3 Add `auth.service.spec.ts`: `loadMe()` caches `me`.
- [x] 2.4 Add `onboarding.guard.spec.ts`: redirects when `!onboarding_complete`, allows when complete.

## Phase 3: Views

- [x] 3.1 Create `features/auth/verify-email/` (ts/html/scss): `bw-auth-layout`; token from `ActivatedRoute`; loading/success/error states + login link.
- [x] 3.2 Create `features/admin/onboarding/` (ts/html/scss): `NgForm` business form; front validation (Chilean RUT, email, phone, required); submit valid → `POST /businesses` → `/admin`.
- [x] 3.3 Create `features/admin/profile/` (ts/html/scss): `GET /auth/me`; personal (name, email RO, phone) + business (RUT/email RO + warning) or CTA if `business=null`.
- [x] 3.4 Create `features/admin/roles/` (ts/html/scss): `GET /roles`; provider selector + multi-select; `admin_general` non-removable for owner; save via `PATCH`.

## Phase 4: Routing + i18n

- [x] 4.1 `app.routes.ts`: add `/verificar-email`, `/onboarding`; add `onboardingGuard` on `/admin`; add `profile`, `roles` children.
- [x] 4.2 `admin-layout.component.ts`: add `nav.profile` + `nav.roles` menu items.
- [x] 4.3 `es.ts`/`en.ts`: add verify-email, onboarding, profile, roles, business-warning keys.

## Phase 5: Testing

- [x] 5.1 `verify-email` spec: valid token → success state; invalid → error state, no onboarding.
- [x] 5.2 `onboarding` spec: invalid form blocks submit (no POST); valid submits + navigates.
- [x] 5.3 `profile` spec: `business=null` → CTA; RUT/email read-only, no update request.
- [x] 5.4 `roles` spec: renders 6 roles; empty/invalid selection blocked; `admin_general` removal blocked (no PATCH).
