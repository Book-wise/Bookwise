# Design: Onboarding, Profile & Business Roles

## Technical Approach

Follow the repo's existing patterns (standalone components + signals, `@services/api/*` layer with `{data}` unwrap via `map(r => r.data)`, `bw-auth-layout` for public auth pages, template-driven forms with `NgForm` + PrimeNG inputs). Enrich `AuthService` with a cached `/auth/me` payload and route redirection is driven by a guard, so deep links are protected. See specs `onboarding-account`, `business-profile`, `roles-assignment`. No `rules.design` in `openspec/config.yaml` → no custom design constraints.

## Architecture Decisions

| Decision | Options | Tradeoff | Decision |
|---|---|---|---|
| Editable email (personal) | (a) editable via assumed `PATCH /auth/me` (b) read-only | (a) invents a non-confirmed endpoint → dead UI (b) safe, honest, needs follow-up | **Read-only + follow-up**. No `PATCH /auth/me` in contract; per SSOT the contract governs. Document limitation; add `PATCH /auth/me` follow-up task. |
| `business.email`/`business.rut` | editable vs immutable | contract rule explicitly immutable | **Read-only + warning** (already contract-mandated). |
| Onboarding show trigger | (a) post-login redirect in `navigateByRole` (b) guard on `/admin` (c) `GET /auth/me` at app load | (a) async login, touches AuthService (b) protects deep links, single source, 1 extra hop (c) fires on all loads | **(b) `onboardingGuard`** on `/admin` (after `roleGuard(['admin'])`) + top-level `/onboarding`. AuthService only gains a `me` cache — `login()` stays synchronous. |
| `/auth/me` caching | (a) new `@ngrx/signals` AuthStore (b) extend `AuthService` signals | (a) new store pattern (b) co-locates auth, less boilerplate | **(b) extend `AuthService`** with `me()` / `meLoaded()` / `loadMe()`. |
| Get `/auth/me` unwrap shape | top-level vs `{data}` | proposal lists fields w/o wrapper; repo pattern unwraps `{data}`; instruction mandates unwrap | **Unwrap `{data}`** (`AuthMeResponse` → `AuthMeData`) per repo pattern; flagged as risk (see Open Questions). |
| Roles screen current-state | (a) rely on `Provider.roles` from `GET /providers` (b) no current state | (a) needs BE to include roles (unconfirmed) (b) weak UX | **(a) extend `Provider` with optional `roles?: Role[]`** to show current assignment; flagged as assumption. |
| Profile layout | new component | — | New `ProfileComponent` child of `/admin` (2-column `p-card` grid). No existing profile layout to reuse. |

## Data Flow

```
Register ──> /auth/register ──> email link ──> /verificar-email?token=...
                                              │ PATCH /auth/verify-email
                                              ▼ success ── login link
Login (AuthService.login sets token+user) ──> navigateByRole → /admin
                                              │ roleGuard(admin) ✓ ──> onboardingGuard
                                              │ loadMe() GET /auth/me
                                              ▼ onboarding_complete=false
                                              /onboarding ── POST /businesses (201)
                                              ▼ {data:{business},user} → update AuthService.user
                                              /admin
Profile(child): GET /auth/me ──> personal (RO) + business (RUT/email RO + warning)
Roles(child):   GET /roles ──> 6 roles; PATCH /providers/{id}/roles {roles:[...]}
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/app/core/models/index.ts` | Modify | Add `Business`, `BusinessPlan`, `AuthMeData`, `AuthMeResponse`, `Role`, `CreateBusinessData/Response`; extend `Provider` with `roles?`. |
| `src/app/core/services/api/auth-api.service.ts` | Modify | Add `verifyEmail(token)` (unwrap `{data:{email_verified_at}}`) and `getMe()` (unwrap `{data}`). |
| `src/app/core/services/api/businesses-api.service.ts` | Create | `getBusiness()` (unwrap `{data:Business\|null}`), `createBusiness(data)` (returns full `{data:{business},user}`). |
| `src/app/core/services/api/roles-api.service.ts` | Create | `getRoles()` (unwrap `{data:Role[]}`), `assignProviderRoles(id, roles)` (PATCH). |
| `src/app/core/services/auth.service.ts` | Modify | Add `me`/`meLoaded` signals + `loadMe()` (inject `AuthApiService`); keep `login()` sync. |
| `src/app/core/guards/onboarding.guard.ts` | Create | `onboardingGuard`: `loadMe()`; if `!me.onboarding_complete` → `/onboarding`, else allow. |
| `src/app/app.routes.ts` | Modify | Add `/verificar-email`, `/onboarding`; add `onboardingGuard` to `/admin`; add `profile`, `roles` children. |
| `src/app/features/auth/verify-email/verify-email.component.{ts,html,scss}` | Create | `bw-auth-layout`; reads `?token=` from `ActivatedRoute`; states loading/success/error; login link. |
| `src/app/features/admin/onboarding/onboarding.component.{ts,html,scss}` | Create | Business form (name, RUT `[bwRut]`, email, address, phone `bw-phone-input`, plan select) via `NgForm`; front validation; `POST /businesses` → `/admin`. |
| `src/app/features/admin/profile/profile.component.{ts,html,scss}` | Create | 2-col layout; personal (name, email RO, phone) + business (RUT/email RO + warning) or CTA if `business=null`; "cambiar contraseña" placeholder. |
| `src/app/features/admin/roles/roles.component.{ts,html,scss}` | Create | `GET /roles` list; provider selector + roles checkbox multi-select; `admin_general` non-removable for owner; save via PATCH. |
| `src/app/layouts/admin-layout/...` | Modify | Add `nav.profile`, `nav.roles` menu items. |
| `src/app/core/i18n/es.ts`, `en.ts` | Modify | Add onboarding/profile/roles/verify-email/business-warning keys. |

## Interfaces / Contracts

```ts
export type BusinessPlan = string; // e.g. 'starter'|'professional'|'enterprise'
export interface Business { id:number; name:string; rut:string; email:string; address:string; phone?:string|null; plan:BusinessPlan; created_at?:string; updated_at?:string; }
export interface AuthMeData { id:number; name:string; email:string; phone?:string|null; role:UserRole; tenant_id:number|null; email_verified_at:string|null; onboarding_complete:boolean; business:Business|null; }
export interface AuthMeResponse { data: AuthMeData; }
export interface Role { id:number; name:string; label?:string; } // name ∈ admin_general|admin_local|recepcionista|recepcionista_readonly|staff|staff_readonly
export interface CreateBusinessData { name:string; rut:string; email:string; address:string; phone:string; plan:BusinessPlan; }
export interface CreateBusinessResponse { data:{ business:Business }; user:User; } // user: updated me (onboarding_complete=true)
// Provider gains: roles?: Role[];
```
Verify-email payload: `PATCH /auth/verify-email { token }` → `{ data:{ email_verified_at: string } }`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `AuthApiService.verifyEmail/getMe` unwrap | Mock HttpClient; assert emitted data shape (pattern of `auth-api.service.spec.ts`). |
| Unit | `BusinessesApiService`/`RolesApiService` unwrap + PATCH payload | Same mock approach (pattern of `providers-api.service.spec.ts`). |
| Unit | `AuthService.loadMe` caches `me`; `onboardingGuard` redirects on `!onboarding_complete` | Test guard fn + service signals (no existing `auth.service.spec` → create). |
| Integration | Onboarding form blocks invalid RUT/email/phone; `verify-email` success/error states | Component tests with fake API (Vitest). |
| E2E | Full register→verify→onboarding→/admin, post-login redirect | Manual + optional Playwright (not configured today). |

## Threat Matrix

N/A — no shell, subprocess, VCS/PR-automation, executable-file, or process-integration boundary. Client route guards handle auth redirection and are covered by the unit tests above for safe/failure behavior (missing token → login; `!onboarding_complete` → onboarding, never authorized onward).

## Migration / Rollout

No migration required (frontend-only). Feature ships behind existing routes; no data changes.

## Open Questions

- [ ] `/auth/me` top-level vs `{data}` wrapper — design assumes `{data}` per repo pattern; confirm with BE.
- [ ] Does `GET /providers` include each provider's assigned `roles`? Roles-page current-state display depends on it; else add `GET /providers/{id}/roles`.
- [ ] `plan` enum values for `BusinessPlan` and the roles select options (BE `GET /roles` returns `name`/`label` shape).
- [ ] Personal email edit — requires future `PATCH /auth/me` (follow-up, not in scope).
