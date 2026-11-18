# Frontend Contract Catch-up (Eje A + Eje B + Packs)

Align the Bookwise frontend with the backend API contract at `develop` @ `6a4e8dc`
(158 commits after the `demo/pre-authorization` baseline `c6a7a304`). Source of
truth: `frontend-catchup.md` + `authorization-breaking-changes.md` (backend repo).

## Specs

- **S1** — Error envelope: `{error, rule, detail}` for the 4 `authority_*` codes;
  `{error, detail}` for `permission_required` (no `rule`). "ApiErrorBody/http-error.service
  deben incluir `rule` en su tipo". Codes: `authority_role_assignment_forbidden`,
  `authority_baseline_edit_forbidden`, `authority_permission_delegation_forbidden`,
  `authority_target_forbidden`, `permission_required`.
- **S2** — "Abilities top-level en `login` / `me` / switch-*" (A1). Capture abilities
  from login and `/auth/me`, not only switch-tenant.
- **S3** — F7 A: "No decidir visibilidad de acciones por el tipo técnico de la cuenta
  (`user.role`). Usar capabilities" (`abilities` / `permissions[]`).
- **S4** — "`account_tenant_limit_reached` (con `limit`/`current`) | `403`" and
  "`tenant_professional_limit_reached` (con `limit`/`current`) | `403`" →
  "Bloquear la acción + CTA de upgrade".
- **S5** — `GET /v1/subscription/usage` real contract (§3.2): `data` with `account_id`,
  `plan{slug,billing_interval}`, `tenants{limit,current}`, `users{limit,current}`,
  `businesses[{tenant_id, professionals{limit,current}, locations{limit,current}}]`,
  `confirmations{email|whatsapp: {limit,consumed,remaining,period_start,period_end,pack_credit,by_tenant[]}}`.
  "`businesses` no trae `name` — el front mapea `tenant_id` → nombre".
  "`remaining = limit - consumed`". "Sin suscripción viva → `402 subscription_inactive`.
  Sin membership activa → `403`."
- **S6** — Packs: "Mostrar posición/total, no 'restantes' (S4): el front pinta `3/6`,
  `4/6`… (cuál va y cuántas son en total), no 'quedan 3'".
- **S7** — Pack status `completed` / `abandoned`; "`422 pack_not_paid`" al vincular pack
  WooCommerce impago; "403 por scope" en `PATCH /client-packs/{id}/use` y `POST /client-packs`.

## Tasks

- **T1** (S1) — Add `rule`/`limit`/`current` to `ApiErrorBody`; thread through `http-error.service`.
- **T2** (S1, S4, S7) — i18n keys (es+en) for the 4 `authority_*`, `permission_required`,
  2 capacity codes, `pack_not_paid`, `subscription_inactive`.
- **T3** (S2) — Capture abilities from login + `/auth/me` (`AuthResponse`/`AuthMeResponse` + `auth.service`).
- **T4** (S3) — Audit & remove technical-role gating (F7 A): capabilities / business roles.
- **T5** (S4) — Capacity error handling with upgrade CTA (block action + offer upgrade).
- **T6** (S5) — Consume `GET /v1/subscription/usage` (model + api + billing screen wiring).
- **T7** (S6, S7) — `ClientPack` status union (`completed`/`abandoned`) + posición/total display.
- **T8** (S7) — Handle `422 pack_not_paid` + 403 scope on pack consumption.

## Log

- **L1** — "ok, necesitamos ir actualizando nuestros contratos, ya qe se han hecho bastantes
  avances desde la ultima version estable, te indicare el directorio donde el backend esta
  dejando el contrato para que vayas a revisar" — fuente: `https://github.com/Book-wise/Bookwise-API/blob/develop/docs/api/frontend-catchup.md`.
- **L2** — "esta version ya esta un poco desfasada la ultima vez que vimos los datos
  renderizando fue cuando hicimos una demo, tanto en el front como el back consumimos desde
  una version donda las funcionalidades estaban acorde al backend en esa altura." → el front
  ya absorbió parte del Eje A contra un backend más viejo; el catch-up es contra `develop @ 6a4e8dc`.
- **L3** — T4 (F7 A): auditoría sin cambios de código. El front ya gatea acciones por roles de
  negocio (`is_admin_general`/`is_admin_local`), no por `user.role`; `isAdmin` (técnico) solo se usa
  para labels de UI y routing de área (admin vs provider), que es legítimo. `permission_required`
  y `forbidden` quedaron con mensaje correcto vía T2.
- **L4** — T6 delegado a `gentle-ai-worker`: modelos S5, `SubscriptionApiService.getUsage()`
  (`/subscription/usage`, sin prefijo `/v1`), y wiring del "Uso del plan" en billing. El chart
  de consumo mensual sigue mock (no hay endpoint histórico). Pendiente verificación de suite completa.
- **L5** — Verificación: specs de cada tarea en GREEN (http-error 10, auth 27, patient-card 44,
  providers+http-error 37, subscription-api 1, billing 3). Suite completa: 7 tests fallan en la
  feature `bookings` (matchMedia no stubbed en booking-form-dialog/booking-detail-dialog specs;
  mock de `HistorialStore` sin `bookingsShowingCount`) — **pre-existentes**, fuera de este catch-up
  (arrancaron con cambios no commiteados de `reserva-tab.component.html` y
  `booking-form-dialog.component.html`).
- **L6** — Commits (branch `feat/contract-catchup` desde `develop @ a8857fc`):
  - `25d6e9f` feat(contract): types + i18n (T1, T2, modelos)
  - `619ee59` feat(authz): error envelope + abilities login/me (T3)
  - `89bf7f5` feat(entitlement): capacity CTA + subscription usage (T5, T6)
  - `19799fa` feat(packs): position/total + estados (T7, T8)
