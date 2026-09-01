# Archive Report: booking-notifications

**Change**: booking-notifications
**Archive date**: 2026-09-01
**Archived to**: `openspec/changes/archive/2026-09-01-booking-notifications/`
**Store**: hybrid (OpenSpec files + Engram)
**Verdict at close**: `pass` — archive-ready
**Cycle**: explore → proposal → specs → design → tasks → apply → verify → archive

## Executive Summary

Per-client notification preferences are wired end-to-end. The five backend flags (1:1 contract shape) now initialize from `client.notification_prefs` (GET /clients/{id}) on every dialog open — same-client reopen included — and persist through a partial PATCH /clients/{id} on toggle change, with optimistic UI update and rollback + toast on failure. The patient-card notifications section is regrouped as 3 Email + 2 WhatsApp toggles with per-flag labels and keyboard-reachable tooltips; the stale 4-key in-memory model, `citaWa` toggle, shared popover, and dead non-dialog local signals were removed; i18n (es + en) keys were replaced in parallel. The pending-contract requirement in `patient-dialog-navigation` was promoted to an active `client-notifications` capability reference. Verified green: PASS with 5/5 requirements, 7/7 scenarios, 65/65 focused change-suite tests, build exit 0, zero CRITICAL findings, zero blockers.

## Final State

At close the change is complete. All implementation work shipped as three chained commits (feature-branch-chain), **not yet pushed** — the orchestrator manages the PRs after archive:

| Item | State |
|------|-------|
| Implementation tasks | 12/12 complete (`tasks.md`, Phases 1–4) |
| Work units | 3 (WU1 model+API, WU2 store+UI+i18n, WU3 tests) |
| Commits | WU1 `90f845c` (branch `feat/booking-notifications-wu1-api`), WU2 `87cba0e` (`feat/booking-notifications-wu2-store-ui`), WU3 `0fda7f9` (`feat/booking-notifications-wu3-tests`, HEAD) |
| Base docs commit | `28f7a1d` "docs(sdd): update notifications backend contract to per-client design" (on `develop`) |
| Production build | PASS (`npx ng build`, exit 0; only pre-existing luxon CommonJS warning) |
| Focused change-suite tests | 65 passed / 0 failed (exit 0) |
| Requirements compliant | 5/5 |
| Scenarios | 7/7 COMPLIANT |
| CRITICAL findings | 0 |
| Blockers | 0 |

### Task completion record

The archived `tasks.md` is the authoritative completion record for this hybrid cycle: all 12 implementation tasks are checked `[x]` (Phases 1–4), corroborated by `apply-progress.md` (12/12, 3 work units) and `verify-report.md` (12/12, 0 incomplete). The Engram tasks observation `#150` (`sdd/booking-notifications/tasks`) was persisted during the sdd-tasks phase (pre-apply, checkboxes unchecked, 1 revision) and was not updated by apply; it is an intermediate snapshot, not evidence of the final state — the filesystem `tasks.md` plus apply-progress and verify-report prove completion. No stale unchecked implementation task remains in the archived audit trail.

### Review gate

No review receipt exists for this candidate (`reviewGate` structurally absent; no review artifacts in the change folder). Archive proceeded under ordinary repository policy.

## Backend Contract (confirmed)

Per the agreed contract (`openspec/changes/archive/2026-08-31-booking-dialog-tabs-state/notifications-backend-contract.md`, updated 2026-09-01 by commit `28f7a1d`):

- **Per-client, structure 1:1 (zero mapping)**: `NotificationPrefs` is the exact backend shape.
- **Five flags**: `email_new_booking`, `email_booking_confirmation`, `email_booking_cancellation`, `whatsapp_reminder`, `whatsapp_cancellation_confirmation`.
- **Read**: GET /clients/{id} → `notification_prefs` on the client payload.
- **Write**: PATCH /clients/{id} with a partial body containing only the changed flag under `notification_prefs`.
- **PATCH response shape**: wrapped `{data}` — `updateClient` unwraps via `.pipe(map(r => r.data))`; the design open question was **CLOSED (2026-09-01)**: backend merged (PRs #27–#30); unknown keys inside `notification_prefs` → 422 (frontend only sends the 5 known flags — already the 1:1 design); master switch `{"notifications_enabled": false}` is accepted.
- **Sending is backend-owned**: carlitox + cron; the frontend only reads and writes preferences (`citaWa` / WhatsApp-immediate and any send logic are out of scope).

## Specs Synced to Main Specs

| Domain | Action | Details |
|--------|--------|---------|
| `client-notifications` | Created | Promoted the delta spec (a full spec, not a delta) to `openspec/specs/client-notifications/spec.md` — 4 requirements: Initialize toggles from client notification prefs; Persist toggle changes with a partial PATCH; Render five grouped toggles with per-flag tooltips; Repopulate prefs when reopening the same client. |
| `patient-dialog-navigation` | Updated (delta merged) | 1 RENAMED + 1 MODIFIED: "Maintain the pending notification persistence contract" → "Persist notification preferences via client-notifications" — the requirement now delegates persistence to the `client-notifications` capability (init from GET, partial PATCH on toggle, values preserved across internal tabs). Scenario "Notification values await backend contract" replaced by "Values persist via confirmed contract". Pre-existing requirements preserved unchanged. |

### Source-of-truth updates

- `openspec/specs/client-notifications/spec.md` — new canonical spec for per-client notification preferences.
- `openspec/specs/patient-dialog-navigation/spec.md` — now references the active `client-notifications` capability instead of the pending contract.

## Verification Summary

`verify-report` verdict: **PASS** (`verify-report.md`; Engram `#155`; evidence_revision `sha256:966d7f85…`). Evidence: focused change-suite 65/65 (client-detail.store 30+, patient-card, booking-detail-dialog — 3 files, 0 failed), build exit 0, 5/5 requirements with 7/7 scenarios covered by passing tests.

**Recorded environment exception** (non-blocking): the full-suite baseline is pre-existing flaky — 277 passed / 22 failed this run vs. 16 failed baseline (17 on a develop worktree per apply). All failures are in files untouched by the change (full-calendar, booking-form-dialog `matchMedia` polyfill gap, historial-reserva, services-api/auth-api TestBed-race interference, clients-api `getClientPacksList`/`useClientPack`) and reproduce with harness races. **Zero failures in files changed by this change** — verified both isolated and in the full run (`git diff 28f7a1d..0fda7f9`).

## Key Architectural Decisions

| ID | Decision | Status |
|----|----------|--------|
| D1 | PATCH response wrapped `{data}` — unwrap in `updateClient` (`.pipe(map(r => r.data))`) | Implemented — contract confirmed |
| D2 | `NotificationPrefs` model (5 keys) + store alias `NotificationValues = NotificationPrefs`; `emptyNotifications()` 5×false | Implemented |
| D3 | `initialize()` always populates from `client.notification_prefs` (same-client included); absent prefs → all false | Implemented |
| D4 | `setNotification` optimistic partial PATCH → error: revert + `httpError.handle(err, 'actualizar notificaciones')`; root `HttpErrorService` | Implemented |
| D5 | Per-flag `pTooltip` (top, escaped) on focusable info button; `PopoverModule` → `TooltipModule` | Implemented |
| D6 | i18n es+en in parallel; stale keys removed; `notif.group/label/tip.*` added | Implemented |
| D7 | Non-dialog local signals/maps removed (dead code); `notificationValue`/`setNotification` delegate 100% to store; `notifOpen` local | Implemented |
| D8 | `notifications_enabled` type-only on `Client` (`?: boolean`); no UI toggle; never sent in PATCH | Implemented (product decision deferred) |

**Post-apply deviations** (behavior-neutral, pre-declared in `apply-progress.md`): partial-PATCH payload typed via `as unknown as Partial<Client>` (TS-strict limitation of the computed `{ [key]: value }` key); `data-testid` per flag row for robust assertions.

## Follow-ups (recorded, out of scope)

1. **`notifications_enabled` master switch** — typed on `Client` (`?: boolean`) but no UI toggle and never sent in PATCH. Product decision deferred (design open question, D8).
2. **Stabilize cross-suite test flakiness** — the full suite is pre-existing red (16–22 failed, variance by run; all failures pre-existing and outside the change diff). The full suite cannot be a release gate until the TestBed/harness races (`matchMedia` polyfill, TestBed reconfiguration, signal drift) are stabilized.
3. **PATCH shape** — confirmed by contract (backend merged, PRs #27–#30); the design open question is closed. Recorded here for the record; no action remains on the frontend.
4. **Change `patient-tabs-content-polish`** — registered as pending (3 user requests), untouched by this cycle.

None of these block the change; they are the natural next candidates in the backlog.

## Engram Traceability

Artifacts read/persisted for this cycle (observation IDs):

| Artifact | Engram observation ID |
|----------|----------------------|
| explore | `#146` (`sdd/booking-notifications/explore`) |
| proposal | `#147` (`sdd/booking-notifications/proposal`) |
| spec | `#148` (`sdd/booking-notifications/spec`) |
| design | `#149` (`sdd/booking-notifications/design`) |
| tasks | `#150` (`sdd/booking-notifications/tasks` — pre-apply snapshot; see Task completion record) |
| delivery decision | `#151` (chained PRs feature-branch-chain) |
| apply-progress | `#152` (`sdd/booking-notifications/apply-progress`) |
| verify-report | `#155` (`sdd/booking-notifications/verify-report`) |
| status note | `#156` (verify PASS, pending archive) |

This archive report is persisted as `sdd/booking-notifications/archive-report`.

## Conclusion

The `booking-notifications` SDD cycle is **complete and archived**. Per-client notification preferences are wired, verified, and ready for PR review (3 chained branches). The canonical specs reflect the new behavior. Remaining items are recorded, non-blocking follow-ups. Ready for the next change.
