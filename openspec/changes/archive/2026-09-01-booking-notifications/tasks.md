# Tasks: Booking Notifications — wire client notification prefs

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 450–550 (11 files: 4 src + 2 i18n + 5 specs) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 (feature branch chain) |
| Delivery strategy | ask-on-risk |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Model + API unwrap + api spec | PR 1 (base: tracker) | `npx ng test --no-watch` (clients-api suite) | N/A — unit-only, no e2e runner configured | Revert models + api changes; no dependents yet |
| 2 | Store async PATCH + 5-key rename + card UI + i18n + spec sync | PR 2 (base: PR 1) | `npx ng test --no-watch` (store + card suites) | N/A — unit-only | Revert PR 2 branch; child PRs rebase, old 4-key init intact |
| 3 | Test enrichment: init/repopulate/payload/rollback/tooltip | PR 3 (base: PR 2) | `npx ng test --no-watch` | N/A — unit-only | Revert PR 3; behavior unchanged, tests only |

## Phase 1: Model + API

- [x] 1.1 `src/app/core/models/index.ts`: add `NotificationPrefs` (5 flags, contract 1:1) + `notifications_enabled?`/`notification_prefs?` on `Client` (decisions 2, 8). Test: n/a (type-only).
- [x] 1.2 `src/app/core/services/api/clients-api.service.ts`: `updateClient` → `.pipe(map(r => r.data))`, consistent with `getClient` (decision 1). Test: n/a.
- [x] 1.3 `clients-api.service.spec.ts`: flush `{ data: response }` in `updateClient` test; expect unwrapped `Client`. Requires test: Yes.

## Phase 2: Store

- [x] 2.1 `client-detail.store.ts`: `NotificationValues = NotificationPrefs` alias; `emptyNotifications()` → 5×false; `initialize()` always populates from `client.notification_prefs` (absent → all false), same-client included (decisions 2, 3). Requires test: Yes.
- [x] 2.2 `client-detail.store.ts`: `setNotification` → optimistic `patchState` → `updateClient(clientId, { notification_prefs: { [key]: value } })` → error: revert + `httpError.handle(err, 'actualizar notificaciones')`; inject root `HttpErrorService` (decision 4). Requires test: Yes.

## Phase 3: UI + i18n

- [x] 3.1 `patient-card.component.html`: regroup 3 Email + 2 WhatsApp; remove `citaWa` row + `p-popover`; per-flag label + info `<button>` with `pTooltip` (top, escaped) (decision 5). Requires test: Yes.
- [x] 3.2 `patient-card.component.scss`: group + tooltip styles. Test: n/a.
- [x] 3.3 `es.ts` + `en.ts`: remove stale keys (`type_col`, `email_col`, `wa_col`, `booking_notif`, `reminder`, `immediate`, `scheduled`, `popover_text`); add `notif.group.{email,whatsapp}`, `notif.label.{flag}`, `notif.tip.{flag}` (decision 6). Test: n/a.
- [x] 3.4 `patient-card.component.ts`: delete non-dialog local signals + maps (dead code, decision 7); keep `notificationValue`/`setNotification` delegating to store; `notifOpen` stays local. Requires test: Yes.

## Phase 4: Tests

- [x] 4.1 `client-detail.store.spec.ts`: 5-key asserts; init from prefs; repopulate on same-client reopen (spec "No stale state"); payload = only changed flag; error → rollback + toast. Requires test: Yes.
- [x] 4.2 `patient-card.component.spec.ts`: invert L482–488 "no backend request" → partial PATCH on toggle; render 5 flags, no `citaWa`; tooltip keyboard-reachable (spec "Accessible per-flag tooltip"). Requires test: Yes.
- [x] 4.3 `booking-detail-dialog.component.spec.ts` L121–132: rename prefs shape asserts (`citaEmail` → `email_new_booking`). Requires test: Yes.

TDD note: `strict_tdd: false` — implement + test per task, no RED-first gate.
