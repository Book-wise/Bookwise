# Tasks: booking-dialog-tabs-state

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300–380 (authored) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (3 sequential work units) |
| Delivery strategy | ask-on-risk |
| Chain strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | State consolidation (Phase 1) | PR 1 | `npx ng test --no-watch` | N/A — unit-level; manual dialog smoke | Revert store + patient-card edits only |
| 2 | Keep-alive + wiring (Phases 2–3) | PR 1 | `npx ng test --no-watch` | `ng serve` → open booking dialog, round-trip tabs | Revert dialog template/ts/scss + reserva-tab edits |

## Phase 1: State consolidation

- [x] 1.1 `core/stores/client-detail.store.ts` — add `{ providedIn: 'root' }` to `signalStore()`. Done: `booking-form-dialog` renders `bw-patient-card` with no DI error.
- [x] 1.2 `core/stores/booking-dialog.store.ts` — remove `patientView`/`notifications`/`selectPatientView`/`returnToReservation`/`setNotification`; keep `booking`/`bookingId`/`open`/`replaceBooking`/`reset`. Done: store exposes booking surface only.
- [x] 1.3 `shared/components/patient-card/patient-card.component.ts` — in `setNotification`, drop the `dialogStore` mirror write (keep `detailStore` only). Done: single write path; no `BookingDialogStore` reference remains.

## Phase 2: Keep-alive tabs

- [x] 2.1 `booking-detail-dialog.component.html` — replace `@switch(activeTab())` with `p-tabs`/`p-tablist`/`p-tabpanels`; `p-tabs` wraps both header tablist and body panels; 6 panels mounted, `lazy=false`; keep `@if (visible())` + `@if (booking())` guard. Done: panels stay mounted; header title/status preserved.
- [x] 2.2 `booking-detail-dialog.component.scss` — `.p-tablist` `position: sticky; top: 0` inside scrollable `.p-dialog-content`; keep `overflow-y: auto`; rename residual `bw-payment-dialog` → `bw-booking-detail-dialog`. Done: tablist pinned under header on scroll.

## Phase 3: Wire patient-detail

- [x] 3.1 `tabs/reserva/reserva-tab.component.ts` — inject `BookingDialogStore`; read `dialogStore.booking()` instead of `store.selectedBooking()`; add `patientTabSelected = output<PatientTab>()`; on save write both `dialogStore.replaceBooking(updated)` and `store.mergeBooking(updated)`. Done: reserva reads/writes dialog instance store.
- [x] 3.2 `tabs/reserva/reserva-tab.component.html` — `[dialogMode]="true"` + `(patientTabSelected)` on `bw-patient-card`; `[client]="dialogStore.booking()!.client!"`. Done: card renders email/phone + notifications.
- [x] 3.3 `booking-detail-dialog.component.ts` — in `open()`, fetch `clientsApi.getClient(id)` and merge full client into dialog copy + `detailStore.initialize()` + `store.mergeBooking()`; wire `onPatientTabSelected` → set `activeView`; `returnToReservation` resets `activeView='reserva'` + scroll reset via viewChild. Done: enriched client populates email/phone.
- [x] 3.4 `booking-detail-dialog.component.html` — render `bw-patient-detail-content` as level-1 sibling gated by `detailStore.activeView() !== 'reserva'`; `p-tabpanels [hidden]` when not reserva. Done: detail fills full content; Volver returns without state loss.

## Phase 4: Tests

- [x] 4.1 Add `core/stores/booking-dialog.store.spec.ts` — assert removed members absent; `open`/`replaceBooking`/`reset` behavior.
- [x] 4.2 Extend `patient-card.component.spec.ts` — disabled sub-tab matrix (`loaded && length===0`).
- [x] 4.3 Extend `booking-detail-dialog.component.spec.ts` — keep-alive (switch tabs, assert signals intact); `patientTabSelected` → `activeView` → return resets; enrich client on open with mocked `ClientsApiService.getClient`.
