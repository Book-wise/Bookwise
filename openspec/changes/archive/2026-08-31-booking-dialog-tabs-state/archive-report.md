# Archive Report: booking-dialog-tabs-state

**Change**: booking-dialog-tabs-state
**Archive date**: 2026-08-31
**Archived to**: `openspec/changes/archive/2026-08-31-booking-dialog-tabs-state/`
**Store**: hybrid (OpenSpec files + Engram)
**Verdict at close**: `pass_with_warnings` — archive-ready
**Cycle**: explore → proposal → specs → design → tasks → apply → QA visual → verify → archive

## Executive Summary

The reservation-detail dialog (`bw-booking-detail-dialog`) tab navigation defect is fully fixed and shipped. The change consolidates dialog-scoped booking state into a single booking-only store, keeps the main tabs mounted (keep-alive) so the `Reserva` form and in-progress client edits survive round-trips, renders the four patient detail sub-tabs as full-content views with disabled-when-empty behavior, enriches the patient card with full client contact data, and normalizes the API response shapes. Verified green on build and its own spec suite; archived with zero CRITICAL findings and zero blockers.

## Final State

At close the change is complete. All implementation commits are on `develop` (last code commit `49724e1`). There is no open implementation work:

| Item | State |
|------|-------|
| Implementation tasks | 12/12 complete (`tasks.md`, Phases 1–4) |
| Production build | PASS (`npx ng build --configuration production`, exit 0) |
| Change-scope test suite | 63 passed / 0 failed (exit 0) |
| Requirements compliant | 8/8 |
| Scenarios | 12/13 COMPLIANT, 1/13 PARTIAL (see Verdict notes) |
| CRITICAL findings | 0 |
| Blockers | 0 |

Per `verify-report` and the git history, the change shipped as a **single PR** directly on `develop` (linear history, no feature-branch chain): `f539b03` (store consolidation) → `f22b514` (keep-alive + full-content detail) → `84453d7` (tests) → `588acc6` (disabled sub-tabs) → `49724e1` (QA fixes: API shape, scroll model, header, collapsibles).

### Final-state reconciliation (recorded)

The `Review Workload Forecast` in the archived `tasks.md` carried a leftover `chain_strategy: pending` (an unresolved task-forecast placeholder). Per the orchestrator's explicit cleanup directive (no stale `pending`/`in-progress` markers in archived artifacts), this was reconciled to `single-pr` — the actual, evidence-backed delivery: the forecast recommended no chained PRs and the change was delivered as one PR on `develop`. No other task content was modified.

## Specs Synced to Main Specs

| Domain | Action | Details |
|--------|--------|---------|
| `patient-dialog-navigation` | Updated (delta merged) | 2 requirements MODIFIED (Support all patient detail tabs and return — full-content + disabled-when-empty; Restore persisted reservation and patient data — discard → preserve unsaved edits + restore persisted snapshot), 3 requirements ADDED (Reload detail data on dialog open; Reset scroll on return to Reserva; Read-only detail listings this iteration). Pre-existing requirements preserved unchanged. |
| `booking-dialog-navigation` | Created | Promoted the delta spec (a full spec, not a delta) to `openspec/specs/booking-dialog-navigation/spec.md` (3 requirements: Preserve Reserva state across main-tab navigation; Consolidate booking into a single dialog source of truth; Show complete patient card data). |

### Source-of-truth updates

- `openspec/specs/patient-dialog-navigation/spec.md` — now reflects the discard→preserve behavior, disabled-when-empty sub-tabs, full-content detail views, per-open detail reload, scroll reset, and read-only listings.
- `openspec/specs/booking-dialog-navigation/spec.md` — new canonical spec.

## Verification Summary

`verify-report` verdict: **PASS WITH WARNINGS**. Evidence: the production build passes (exit 0; the only build warning is the pre-existing `luxon` CommonJS bailout), the change's own spec suite passes 63/63 (client-detail.store 7/7, booking-dialog.store 4/4, booking-detail-dialog.component 11/11, patient-card.component 41/41), and 8/8 requirements with 12/13 scenarios fully compliant.

**Single PARTIAL scenario** (non-blocking): `Reset scroll on return to Reserva` is verified statically only — `returnToReservation()` calls `document.querySelector(...).scrollTo({top:0})`, but jsdom cannot measure scroll offsets, so the resulting offset is not runtime-assertable. This is a testing-environment limitation, not a code defect.

**Recorded environment exception** (non-blocking): the full suite baseline is pre-existing flaky (16 failed / 277 passed stable baseline; this run 21/272, within the documented cross-suite pollution range driven by `matchMedia` / `IntersectionObserver` / TestBed contamination across `full-calendar`, `providers-api`, `booking-form-dialog`, `historial-reserva`, `clients-api`). **Zero new failures introduced** — the change's four spec files never appear in the FAIL set and pass in isolation and in the full run.

## Key Architectural Decisions

| ID | Decision | Status |
|----|----------|--------|
| D1 | Store topology: booking-only dialog store (`BookingDialogStore` → `booking`/`bookingId`/`open`/`replaceBooking`/`reset`) + `ClientDetailStore` as sole owner (`providedIn:'root'`) | Implemented |
| D2 | Enrich the patient card via `clientsApi.getClient(id)` on open, with error fallback to the embedded client | Implemented |
| D3 | Disabled sub-tab trigger `loaded && length===0`, eagerly reloaded on open | Implemented |
| D4 | `p-tabs` wraps tablist + tabpanels; `p-tabpanels [hidden]` when not reserva; patient-detail rendered as a level-1 sibling (`activeView !== 'reserva'`) | Implemented |
| D5 | (superseded) Initial sticky tablist → replaced by post-apply scroll model: fixed `.p-tablist`, scroll in `.p-tabpanels`, `.p-dialog-content` `overflow:hidden` | Superseded by post-apply correction |
| Post-apply | API shape normalization (`getClient`/`getClientPacks` unwrap `{data}`; `loadSales`/`loadRecent` handle flat array), collapsible unification (`Información adicional` custom collapsible, `PanelModule` removed), header alignment (symmetric padding, flex-end baseline, equal heights, mobile select swap) | Implemented |

No spec-breaking design deviation; the documented post-apply corrections supersede D5 and are coherent with the delta specs.

## Follow-ups (recorded, out of scope)

1. **Backend contract (pending — carried by the team)**: the notification/reminder checkboxes live only in client memory (`ClientDetailStore.notifications`); the agreed persistence contract is documented in `notifications-backend-contract.md` and handed to the backend owner. No endpoint, payload, or save request is assumed by the frontend until the contract is confirmed.
2. **Unify the two shadowed `Booking` / `BookingStatus` interfaces**: `models/index.ts` vs `responses/bookings.ts` expose conflicting shapes (e.g. `client` optional vs required).
3. **Unify the API contract shapes**: inconsistent response shapes across services (`getClient`/`getClientPacks` return `{data}`, `getSales`/`getBookings` return a flat array, `getClientPacksList` returns `{data,meta}`).
4. **Stabilize the TestBed runner**: cross-suite flakiness from `matchMedia` / `IntersectionObserver` / TestBed contamination prevents a clean full-suite run (in turn keeping `getClientPacksList` / `useClientPack` and others red).
5. **Remove any residual `console.log`** if found elsewhere (the `payment-tab.component.ts` leftover was removed during apply).

None of these block the change; they are the natural next candidates in the backlog.

## Engram Traceability

Artifacts read/persisted for this cycle (observation IDs):

| Artifact | Engram observation ID |
|----------|----------------------|
| explore | `#125` (`sdd/booking-dialog-tabs-state/explore`) |
| proposal | `#126` (`sdd/booking-dialog-tabs-state/proposal`) |
| spec | `#127` (`sdd/booking-dialog-tabs-state/spec`) |
| design | `#128` |
| tasks | `#129` (`sdd/booking-dialog-tabs-state/tasks`) |
| verify-report | `#134` (`sdd/booking-dialog-tabs-state/verify-report`) |
| cycle-completed note | `#131` |
| backend contract | `#132` |

This archive report is persisted as `sdd/booking-dialog-tabs-state/archive-report`.

## Conclusion

The `booking-dialog-tabs-state` SDD cycle is **complete and archived**. The reservation-dialog tab navigation is fixed, verified, and shipped on `develop`. The canonical specs reflect the new behavior. Remaining items are recorded, non-blocking follow-ups. Ready for the next change.
