# Apply Progress — onboarding-roles-profile

> Cambio: `onboarding-roles-profile`. Estado: **IMPLEMENTADO (all 21 tasks)**.
> Modo: **Standard** (openspec/config.yaml `strict_tdd: false`).
> Delivery: `ask-on-risk` → resuelto **feature-branch-chain** (3 work units).

## Cumulative task state

| Phase | Tasks | Status |
|---|---|---|
| 1 — Models + API services | 1.1–1.6 | ✅ 6/6 |
| 2 — Auth service + guard | 2.1–2.4 | ✅ 4/4 |
| 3 — Views | 3.1–3.4 | ✅ 4/4 |
| 4 — Routing + i18n | 4.1–4.3 | ✅ 3/3 |
| 5 — Testing | 5.1–5.4 | ✅ 4/4 |
| **Total** | — | **✅ 21/21** |

## Work Units (feature-branch-chain)

| WU | Branch | Base | PR | Scope | Evidence |
|---|---|---|---|---|---|
| WU1 | `feat/onboarding-roles-wu1-api` | develop | PR 1 | Models + API services | `npx ng test --no-watch --include='src/app/core/services/api/{auth-api,businesses-api,roles-api}.service.spec.ts'` → 3 files / 11 tests passed |
| WU2 | `feat/onboarding-roles-wu2-auth` | WU1 | PR 2 | AuthService cache + onboardingGuard | `npx ng test --no-watch --include='src/app/core/services/auth.service.spec.ts' --include='src/app/core/guards/onboarding.guard.spec.ts'` → 2 files / 8 tests passed |
| WU3 | `feat/onboarding-roles-wu3-views` | WU2 | PR 3 | Views + routes + i18n + tests | `npx ng test --no-watch --include='src/app/features/{auth/verify-email,admin/onboarding,admin/profile,admin/roles}/*.spec.ts'` → 4 files / 11 tests passed |

Runtime harness: `npx ng build` → **0 errors** (only pre-existing bundle-budget + luxon ESM warnings). Component/service behavior covered via Vitest mocks (`HttpClientTesting` / `vi.fn`); no E2E/Playwright configured in this repo.

Rollback boundary per work unit: isolated branch + focused diff; removing a branch reverts only that unit (WU1 API/models, WU2 guard/auth, WU3 views/routes) without touching unrelated work.

## Files changed

- `src/app/core/models/index.ts` — +`Business`, `BusinessPlan`, `AuthMeData`, `AuthMeResponse`, `Role`, `CreateBusinessData/Response`; `Provider` gains `roles?: Role[]`.
- `src/app/core/services/api/auth-api.service.ts` — +`verifyEmail()` (PATCH, unwrap `{data}`), `getMe()` (GET, unwrap `{data}`).
- `src/app/core/services/api/businesses-api.service.ts` **(new)** — `getBusiness()` (unwrap), `createBusiness()`.
- `src/app/core/services/api/roles-api.service.ts` **(new)** — `getRoles()` (unwrap), `assignProviderRoles()` (PATCH).
- `src/app/core/services/api/auth-api.service.spec.ts` — +verifyEmail/getMe unwrap tests.
- `src/app/core/services/api/businesses-api.service.spec.ts`, `roles-api.service.spec.ts` **(new spec)**.
- `src/app/core/services/auth.service.ts` — +`me`/`meLoaded` signals, `loadMe(force)` cache, `setMe()`; `login()` stays synchronous; `logout()` clears `me`.
- `src/app/core/guards/onboarding.guard.ts` **(new)** + `index.ts` export.
- `src/app/core/services/auth.service.spec.ts`, `src/app/core/guards/onboarding.guard.spec.ts` **(new spec)**.
- `src/app/app.routes.ts` — `/verificar-email` (público), `/onboarding` (roleGuard admin), `onboardingGuard` en `/admin`, hijos `profile`/`roles`.
- `src/app/layouts/admin-layout/admin-layout.component.ts` — items nav `profile`/`roles`.
- `src/app/core/i18n/es.ts`, `en.ts` — claves verify-email/onboarding/profile/roles + `nav.profile`/`nav.roles`.
- `src/app/features/auth/verify-email/*` **(new)** — componente + spec.
- `src/app/features/admin/onboarding/*` **(new)** — componente + spec.
- `src/app/features/admin/profile/*` **(new)** — componente + spec.
- `src/app/features/admin/roles/*` **(new)** — componente + spec.

## Commits por work unit

- WU1: `feat(onboarding-roles): add business/auth-me/roles models and API services` + `docs(sdd): mark phase 1 tasks done`
- WU2: `feat(onboarding-roles): cache /auth/me in AuthService and add onboarding guard` + `docs(sdd): mark phase 2 tasks done`
- WU3: `feat(onboarding-roles): add verify-email, onboarding, profile and roles views` + `docs(sdd): mark phases 3-5 tasks done`

## Deviations / notes

- **onboardingGuard**: redirige a `/onboarding` también si `loadMe()` falla (sin autorizar /admin hacia adelante) — alineado con diseño.
- **email personal**: read-only + nota (no hay `PATCH /auth/me`). Business RUT/email: read-only + warning. Sin endpoint de actualización en el perfil.
- **roles::admin_general** se renderiza siempre bloqueada (checkbox disabled) y `save()` rechaza tanto removerlo (si el provider lo tiene) como asignarlo (si no), garantizando único/no-removible/no-reasignable.
- **Ajuste de test**: el validador de `NgForm` no se registra sincrónicamente en el entorno zoneless de test; se añadió un `isFormValid()` explícito en `onboarding.component.ts` (RUT chileno + email + phone), espejo del patrón de `register.component.ts`.
- `onboardingGuard`/`roleGuard` se importan por ruta directa en `app.routes.ts` (sin usar el barrel `@guards`), igual que `roleGuard` ya existente.

## Open questions / assumptions (heredadas del design.md)

- `/auth/me` con wrapper `{data}` — asumido por patrón del repo; confirmar con BE.
- `GET /providers` devuelve `roles` por provider? El rol actual se muestra vía `Provider.roles?` (asumido); si no, agregar `GET /providers/{id}/roles`.
- `BusinessPlan` (string) y labels de `GET /roles` — el frontend define labels; shape `label` asumido.
- Personal email edit requiere un `PATCH /auth/me` futuro (follow-up, no en scope).

## Pre-existing test failures (NO causados por este cambio — verificados con stash sobre baseline)

- `clients-api.service.spec.ts`: `getClientPacksList` (URL con `?client_id` no coincide con `expectOne` sin params) + cascade "no open requests/verify". Falla también con WU3 stasheado.
- `booking-form-dialog.component.spec.ts` (2): integración patient-card.
- `historial-reserva.component.spec.ts` (3): status chip rendering.
- `booking.store.spec.ts` "starts with empty arrays" solo en run completo por contaminación del test de clients-api; pasa en aislamiento.

Estos archivos NO fueron tocados por este cambio; deben investigarse como deuda/riesgo aparte.

## Health

`npx ng build` → 0 errores. 31/31 tests de los 10 spec files tocados pasan. 3 ramas creadas en cadena (feature-branch-chain) con commits convencionales (sin Co-Authored-By).
