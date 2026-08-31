# Tasks: Patient Dialog Navigation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350–450 for remediation |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Existing PR 1 → PR 2 → PR 3 → remediation PR 4 |
| Delivery strategy | force-chained |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Completed slice is not runtime-correct: it anchors dialog state to a client-only snapshot, so destroying and recreating Reserva loses booking/provider/service/notes/timing fields. Required before final verification.

PRs 1–3 remain historical; PR 4 is the bounded feature-branch successor.

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 4 | Replace the client-only root with canonical complete-booking restoration | PR 4; base = PR #3 branch | `npx ng test --no-watch --include='**/booking-detail-dialog.component.spec.ts' --include='**/patient-card.component.spec.ts'` | Real complete calendar payload; DOM destroy/recreate Reserva, internal tabs, return, main-tab switch | Revert `booking-dialog.store.ts` and remediation edits in dialog, Reserva, card, and regression specs |

## Phase 1: State and Reusable Content

- [x] 1.1 Confirm notification contract; add no backend endpoint, payload, or save request.
- [x] 1.2 Update `client-detail.store.ts` with typed views, client snapshot, notifications, caches/errors, navigation, and reset semantics.
- [x] 1.3 Create reusable `patient-detail-content` files for four views and loading/empty/error states.

## Phase 2: Navigation Integration

- [x] 2.1 Update patient card for typed dialog tabs, notifications, local accordion, and form-dialog compatibility.
- [x] 2.2 Update Reserva tab forwarding without changing save/refresh/merge/toast behavior.
- [x] 2.3 Integrate dialog lifecycle, content replacement, visible header/tabs, and reservation restoration.

## Phase 3: Verification

- [x] 3.1 Add store tests for caches, states, notifications, navigation, lifecycle, and isolation.
- [x] 3.2 Add dialog tests for visibility, four tabs/back, saved toast, and unsaved edits.
- [x] 3.3 Update card tests for current panel API, typed tabs, notifications, accordion, and compatibility.
- [x] 3.4 Run the full suite; verify no unconfirmed notification request is emitted.

## Remediation Work Unit 4: Canonical Booking Snapshot and Runtime Proof (successor PR)

- [x] 4.1 RED: Add a DOM-level regression using the real complete calendar `Booking` payload; enter each patient tab, destroy/recreate Reserva, return, and assert header, Reserva, patient, provider, service, notes, and timing values.
- [x] 4.2 Create `src/app/core/stores/booking-dialog.store.ts` with a complete persisted snapshot anchored by `bookingId`; retain `ClientDetailStore` caches keyed by `clientId`, with reset only on client identity/lifecycle changes.
- [x] 4.3 Rewire `booking-detail-dialog`, `reserva-tab`, and `patient-card` to consume the one dialog snapshot; eliminate competing reads that lose restoration and update the snapshot on successful save/refresh/merge while preserving the existing toast.
- [x] 4.4 Synchronize outer main-tab selection with inner patient detail: selecting another main tab exits internal detail; preserve notification checkboxes internally, keep accordion state local, and add no backend endpoint or payload.
- [x] 4.5 GREEN: Complete the regression suite for unsaved-edit discard, saved/refresh/merge restoration, all four internal tabs, notification retention, main-tab exit, close/new-booking isolation, and DOM assertions; do not mark final verification ready until runtime evidence passes.
