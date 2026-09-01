# Archive Report — onboarding-roles-profile

> Change: `onboarding-roles-profile`. Archivo: `2026-09-01`. Estado final: **PASS WITH WARNINGS**.
> Store: `hybrid` (openspec + Engram). Este reporte refleja el estado DEL CIERRE, no el de snapshots intermedios.

## Final State

**Verdict: PASS WITH WARNINGS** — `npx ng build` exit 0; scoped `npx ng test` 30/30 passed. 8/8 requirements implementados y 14/14 scenarios cubiertos por tests que pasan en runtime (0 UNTESTED, 0 FAILING). 0 blockers, 0 critical. Los únicos ítems restantes son polish de cobertura de test (SUGGESTION), la discrepancia de conteo en `apply-progress.md`, y open-questions de contrato BE ya documentadas en `design.md`.

## What Was Implemented

WU1 — Models + API services:
- `src/app/core/models/index.ts`: `Business`, `BusinessPlan`, `AuthMeData`, `AuthMeResponse`, `Role`, `CreateBusinessData/Response`; `Provider` gana `roles?: Role[]`.
- `auth-api.service.ts`: `verifyEmail(token)` → `PATCH /auth/verify-email` (unwrap `{data:{email_verified_at}}`), `getMe()` → `GET /auth/me` (unwrap `{data}`).
- `businesses-api.service.ts` (nuevo): `getBusiness()` (unwrap), `createBusiness()` → `POST /businesses`.
- `roles-api.service.ts` (nuevo): `getRoles()` (unwrap), `assignProviderRoles(id, roles)` → `PATCH /providers/{id}/roles`.
- Specs: `businesses-api.service.spec.ts`, `roles-api.service.spec.ts` (nuevos); `auth-api.service.spec.ts` extendido.

WU2 — Auth service + guard:
- `auth.service.ts`: `me`/`meLoaded` signals + `loadMe(force)` cache; `login()` permanece síncrono.
- `guards/onboarding.guard.ts` (nuevo) + export en `guards/index.ts`.
- Specs: `auth.service.spec.ts`, `onboarding.guard.spec.ts`.

WU3 — Views + routes + i18n:
- `features/auth/verify-email/`, `features/admin/onboarding/`, `features/admin/profile/`, `features/admin/roles/` (nuevos).
- `app.routes.ts`: `/verificar-email`, `/onboarding`, `onboardingGuard` en `/admin` (tras `roleGuard(['admin'])`), hijos `profile`/`roles`.
- `admin-layout.component.ts`: ítems de nav `profile`/`roles`.
- i18n `es.ts`/`en.ts`: claves verify-email/onboarding/profile/roles.

## Specs Synced → Canonical

Los 3 dominios eran NUEVOS (no existían en `openspec/specs/`). Copy mecánico byte-idéntico (`diff -r` vacío).

| Domain | Action | Requirements | Scenarios |
|--------|--------|--------------|-----------|
| onboarding-account | Created | Email verification, Business onboarding, Post-login redirection (3) | 6 |
| business-profile | Created | Profile view, Immutable business identity fields (2) | 4 |
| roles-assignment | Created | List business roles, Assign roles to a provider, admin_general unique/non-removable (3) | 4 |

Totals: **8 requirements / 14 scenarios** (coincide con `verify-report` `requirements: 8/8`, `scenarios: 14/14`).

## Task Completion

`tasks.md`: **21/21 tasks** marcadas `[x]`, **0 unchecked** de implementación → Task Completion Gate pasó. `apply-progress.md` reporta 21/21 consistente con el árbol de trabajo.

## Verification Evidence (final)

- **Build**: `npx ng build` → exit 0 ("Application bundle generation complete"; warnings pre-existentes: budget 500kB excedido 322.13 kB pero bajo el `maximumError` de 1MB → exit 0; luxon CommonJS bailout).
- **Tests**: scoped set de 9 spec files → **30 passed / 0 failed**. Duración 2.99s.
- **Coverage**: no configurada/requerida en este scope.
- Verify envelope: `evidence_revision sha256:8cb33c0e...`, verdict `pass_with_warnings`, `blockers: 0`, `critical_findings: 0`.

## Count Correction (install)

`apply-progress.md` afirma **"10 spec files / 31 tests"**. El alcance real (verificado con `git diff --name-only develop HEAD -- '*.spec.ts'`) toca **9 spec files** y el scoped run produce **30 passing tests**. Es un sobre-conteo en `apply-progress.md`, no un test faltante ni un defecto. `verify-report.md` ya corrige a 9/30.

## Open Questions — BE Contract

1. **Wrapper `/auth/me`**: se asume `{data}` (`AuthMeResponse.data`) por patrón del repo. Confirmar con BE.
2. **`roles?` en `GET /providers`**: la pantalla de roles muestra el estado actual vía `Provider.roles?` (asumido). Si el BE no lo devuelve, la selección actual se renderizará vacía hasta agregar `GET /providers/{id}/roles`.
3. **Labels de roles** (`GET /roles`): el frontend define los labels (`Role.label?`); shape `name`/`label` asumido.

## Follow-up (fuera de scope)

- **Email personal editable**: renderizado read-only + nota. No hay `PATCH /auth/me` en el contrato BE; requiere un `PATCH /auth/me` futuro para habilitar la edición (follow-up, no defecto). Business RUT/email: read-only + warning (regla de contrato: inmutables).

## Test-coverage Polish (SUGGESTION, no bloquea)

- `profile.component.spec.ts` no asserta el mensaje de warning renderizado (`profile.business.warning`).
- `roles.component.spec.ts` no ejercita la rama `!valid.has(name)`.

## Pre-existing Failures (NOT from this change)

`clients-api.service.spec.ts`, `booking-form-dialog.component.spec.ts`, `historial-reserva.component.spec.ts` y un caso de contaminación en `booking.store.spec.ts`. Ninguno está en `git diff develop HEAD`; no fueron corridos en el scoped set.

## Archive Mechanics

- Spec sync: copy mecánico a `openspec/specs/{domain}/spec.md` — `diff -r` source vs canonico **EMPTY** (byte-identical) para los 3 dominios.
- Move: `git mv` → `openspec/changes/archive/2026-09-01-onboarding-roles-profile/`. Readback `diff -r snapshot vs archived` **EMPTY** (byte-identical).
- Active `openspec/changes/` ya NO contiene `onboarding-roles-profile`.
- Contenido archivado: proposal ✅, specs/ ✅ (3 dominios), design ✅, tasks.md ✅ (21/21), apply-progress ✅, verify-report ✅. `archive-report.md` es aditivo (no existía en el snapshot, excluido del diff).

## Persistence

Archive report persistido en Engram `sdd/onboarding-roles-profile/archive-report` (`type: architecture`, `capture_prompt: false`). Artefactos fuente leídos desde disco (carpeta de change), no observaciones Engram.
