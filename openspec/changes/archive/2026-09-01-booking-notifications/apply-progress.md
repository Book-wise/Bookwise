# Apply Progress: booking-notifications

> Phase: apply — ALL 12 tasks complete (3 work units, feature-branch-chain).
> Date: 2026-09-01 · Mode: Standard (strict_tdd: false) · Artifact store: hybrid (OpenSpec + Engram).

## Work Units & Commits

| Unit | Branch (base) | Commit | Tasks | Focused tests |
|------|---------------|--------|-------|---------------|
| 1 — Model + API | `feat/booking-notifications-wu1-api` (develop) | `90f845c` | 1.1, 1.2, 1.3 | clients-api suite: 6/8 pass — only pre-existing flaky `getClientPacksList`/`useClientPack` fail |
| 2 — Store + UI + i18n | `feat/booking-notifications-wu2-store-ui` (WU1) | `87cba0e` | 2.1, 2.2, 3.1, 3.2, 3.3, 3.4 | store + card + dialog suites: 59/59 pass |
| 3 — Test enrichment | `feat/booking-notifications-wu3-tests` (WU2) | `0fda7f9` | 4.1, 4.2, 4.3* | store + card + dialog suites: 65/65 pass |

\* 4.3 (dialog spec rename `citaEmail` → `email_new_booking` + `updateClient` mock) was completed inside WU2's "spec sync" — it is the atomic 4→5-key rename unit; verified green in WU2 and WU3 runs.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command (WU1) | `npx ng test --no-watch --include="**/clients-api.service.spec.ts"` → 6 passed / 2 failed (only pre-existing flaky `getClientPacksList` + `useClientPack`, confirmed in develop baseline) |
| Focused test command (WU2) | `npx ng test --no-watch --include="**/client-detail.store.spec.ts" --include="**/patient-card.component.spec.ts" --include="**/booking-detail-dialog.component.spec.ts"` → 59/59 passed |
| Focused test command (WU3) | same command → 65/65 passed (incl. new init-from-prefs, same-client repopulate, partial-PATCH payload, rollback+toast, 5-flag render no `citaWa`, keyboard-reachable tooltip) |
| Runtime harness | N/A — unit-only; no e2e runner configured (per tasks.md work-unit table) |
| Full suite (final branch) | 283 passed / 16 failed; the 16 failures are pre-existing flaky suites (full-calendar, booking-form-dialog, historial-reserva, app.spec, clients-api list/use) — verified identical behavior on a `develop` baseline worktree (17 failed there; variance is harness flakiness, none of the failures touch files changed by this change) |
| Build | `npx ng build` succeeds (only pre-existing budget/luxon warnings) |
| Rollback boundary | WU1: revert models + api unwrap (no dependents yet). WU2: revert branch; WU3 is tests-only on top — behavior unchanged if WU3 reverted. |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/app/core/models/index.ts` | Modified | `NotificationPrefs` (5 flags, contract 1:1) + `notifications_enabled?`/`notification_prefs?` on `Client` |
| `src/app/core/services/api/clients-api.service.ts` | Modified | `updateClient` unwraps `{data}` via `.pipe(map(r => r.data))`; return stays `Observable<Client>` |
| `src/app/core/services/api/clients-api.service.spec.ts` | Modified | `updateClient` test flushes `{ data: response }` |
| `src/app/core/stores/client-detail.store.ts` | Modified | `NotificationValues = NotificationPrefs` alias; `emptyNotifications()` 5×false; `initialize()` always repopulates prefs (same-client included); `setNotification` optimistic partial PATCH + rollback via root `HttpErrorService` |
| `src/app/shared/components/patient-card/patient-card.component.ts` | Modified | Removed dead non-dialog local signals/maps; `notificationValue`/`setNotification` delegate 100% to store; `notifOpen` local; added `emailNotificationFlags`/`whatsappNotificationFlags` arrays; `PopoverModule` → `TooltipModule` |
| `src/app/shared/components/patient-card/patient-card.component.html` | Modified | Regrouped 3 Email + 2 WhatsApp; removed `citaWa` row + `p-popover`; per-flag label + focusable info button with `pTooltip` (top, escaped); `data-testid` per flag |
| `src/app/shared/components/patient-card/patient-card.component.scss` | Modified | Group + per-flag styles; tooltip button focus-visible outline; removed table/popover styles |
| `src/app/core/i18n/es.ts`, `en.ts` | Modified | Replaced stale keys with `notif.group.{email,whatsapp}`, `notif.label.{flag}`, `notif.tip.{flag}` (contract §4 event/channel/timing) |
| `src/app/core/stores/client-detail.store.spec.ts` | Modified | 5-key asserts; mock `updateClient` + `HttpErrorService`; new: init-from-prefs, same-client repopulate, partial payload, rollback+toast |
| `src/app/shared/components/patient-card/patient-card.component.spec.ts` | Modified | Mock `updateClient` + `HttpErrorService`; inverted "no backend request" → partial PATCH; render 5 flags no `citaWa`; tooltip keyboard-reachable |
| `src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.spec.ts` | Modified | Renamed `citaEmail` → `email_new_booking` (L121-132); added `updateClient` mock to `clientsApi` |

## Deviations from Design

1. **Partial-PATCH payload typing** — design's pseudo-code `updateClient(clientId, { notification_prefs: { [key]: value } })` does not compile under TS strict (computed `{ [key]: value }` is not a complete `NotificationPrefs`). Store uses `{ notification_prefs: { [key]: value } } as unknown as Partial<Client>` with a comment — behavior identical, model untouched.
2. **`data-testid` per flag** — added to the flag rows (repo convention, e.g. `pc-edit`, `tab-planes`) to make the "no `citaWa` / exactly 5 flags" test robust; no behavior change.

## Issues Found

- Pre-existing flaky tests unrelated to this change (confirmed identical on a `develop` baseline): full-calendar, booking-form-dialog ("patient card integration" — `window.matchMedia` polyfill missing in that spec), historial-reserva, app.spec, clients-api `getClientPacksList`/`useClientPack`, plus intermittent blocked-slots/booking-dialog.store harness failures.
- `initialize()` now no-ops `setNotification` before `initialize()` (guard `if (!clientId) return`, per design) — card spec had to call `detailStore.initialize(makeClient())` first, mirroring real dialog flow.

## Status

12/12 tasks complete. Ready for verify.
