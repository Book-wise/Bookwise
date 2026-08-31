# Apply Progress: booking-dialog-tabs-state

> Date: 2026-08-31
> Mode: Standard (strict_tdd: false — no TDD module loaded)
> Store: hybrid (openspec file + engram `sdd/booking-dialog-tabs-state/apply-progress`)

## Status

**12/12 tasks complete** (tasks.md fully marked `[x]`). All focused tests green.
Ready for verify.

## Work Unit Evidence

| Unit | Tasks | Focused test command + exact result | Runtime harness | Rollback boundary |
|------|-------|-------------------------------------|-----------------|-------------------|
| 1 — State consolidation (Phase 1) | 1.1, 1.2, 1.3 | `npx ng test --no-watch` (client-detail.store.spec + patient-card.component.spec) → **passing** (part of 96/96 final run) | N/A — unit-level; manual dialog smoke per tasks.md | `git revert f539b03` (stores + patient-card) |
| 2 — Keep-alive + wiring (Phases 2–3) | 2.1, 2.2, 3.1, 3.2, 3.3, 3.4 | `npx ng test --no-watch` (booking-detail-dialog.component.spec) → **11/11 passed** | N/A — `ng serve` manual round-trip per tasks.md | `git revert f22b514` (dialog template/ts/scss + reserva-tab + patient-detail-content) |
| 3 — Tests (Phase 4) | 4.1, 4.2, 4.3 | `npx ng test --no-watch` (5 focused files) → **96/96 passed** | N/A — no automated runtime boundary in this project | `git revert 84453d7 588acc6` (specs + card template) |

Final focused run (committed state): **5 test files, 96/96 passed**:
client-detail.store.spec, booking-dialog.store.spec, booking.store.spec,
patient-card.component.spec, booking-detail-dialog.component.spec.

Full suite: 277 passed / 16 failed. All 16 failures are pre-existing broken
suites (clients-api ×2, full-calendar ×7, booking-form-dialog ×2,
historial-reserva ×3, plus app.spec which passes in isolation — cross-suite
pollution from a broken suite). Excluding the known-broken suites: **18 files,
221/221 passed** → zero new failures introduced.

## Tasks Completed

- [x] 1.1 `client-detail.store.ts` — `{ providedIn: 'root' }` added to `signalStore()` (first arg, matches `BookingStore` pattern).
- [x] 1.2 `booking-dialog.store.ts` — trimmed to `booking`/`bookingId`/`open`/`replaceBooking`/`reset`; removed `patientView`/`notifications`/`selectPatientView`/`returnToReservation`/`setNotification`.
- [x] 1.3 `patient-card.component.ts` — `setNotification` writes only `detailStore`; all `BookingDialogStore` references removed (import, injection, openPanel, notificationValue).
- [x] 2.1 `booking-detail-dialog.component.html` — `@switch(activeTab())` → `p-tabs`/`p-tablist`/`p-tabpanels`; 6 panels mounted (lazy=false keep-alive); `p-tabs` wraps tablist + tabpanels; kept `@if (visible())` + `@if (booking())`.
- [x] 2.2 `booking-detail-dialog.component.scss` — `.p-tablist` sticky (`position: sticky; top: 0; z-index: 5`, solid surface bg); `.p-dialog-content` keeps `overflow-y: auto`; residual `bw-payment-dialog` → `bw-booking-detail-dialog` (html + scss); flex chain tabs→tabpanels→tabpanel with `[hidden] { display:none !important }` guards.
- [x] 3.1 `reserva-tab.component.ts` — injects `BookingDialogStore`; reads `dialogStore.booking()` everywhere (providers, serviceDisabled, init effect, saveBookingTime, startEditClient, savePatientData); adds `patientTabSelected = output<PatientTab>()`; dual write `dialogStore.replaceBooking(updated)` + `store.mergeBooking(updated)`.
- [x] 3.2 `reserva-tab.component.html` — `[dialogMode]="true"` + `(patientTabSelected)` on `bw-patient-card`; `[client]="dialogStore.booking()!.client!"`; service select reads `dialogStore.booking()`.
- [x] 3.3 `booking-detail-dialog.component.ts` — `open()` enriches via `clientsApi.getClient(id)` (merge into dialog copy + `detailStore.initialize()` + `store.mergeBooking()`, error fallback to embedded client) and eagerly reloads packs/sales/recent; `onPatientTabSelected` → `detailStore.selectTab(tab)`; `returnToReservation` resets `activeView` + scroll reset; `activeDetailTab` computed.
- [x] 3.4 `booking-detail-dialog.component.html` — `bw-patient-detail-content` as level-1 sibling gated by `detailStore.activeView() !== 'reserva'`; `p-tabpanels [hidden]` when not reserva; `.patient-detail-content` gains `flex: 1` to fill the dialog content.
- [x] 4.1 New `booking-dialog.store.spec.ts` — asserts removed members absent + `open`/`replaceBooking`/`reset` (4 tests).
- [x] 4.2 `patient-card.component.spec.ts` — disabled sub-tab matrix (`loaded && length===0`): enabled while not loaded; planes/sesiones/prepago/recientes disabled when their category loads empty; re-enabled when data arrives (5 tests). Implementation: `[disabled]` bindings on card nav buttons.
- [x] 4.3 `booking-detail-dialog.component.spec.ts` — keep-alive (Reserva stays mounted + notes signal intact across main-tab switch), rendered-card sub-tab round trip (click planes → detail fills → "Volver a la reserva" restores), client enrichment on open with mocked `ClientsApiService.getClient`, fallback on getClient error (4 new tests; 11 total).

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/app/core/stores/client-detail.store.ts` | Modified | `providedIn: 'root'` (fixes booking-form-dialog DI) |
| `src/app/core/stores/booking-dialog.store.ts` | Modified | Trimmed to booking-only surface |
| `src/app/core/stores/index.ts` | Modified | Exports `BookingDialogStore` (base) |
| `src/app/shared/components/patient-card/patient-card.component.ts` | Modified | Removed dialogStore mirror; single detailStore write path |
| `src/app/shared/components/patient-card/patient-card.component.html` | Modified | Disabled sub-tab bindings (`loaded && length===0`) |
| `src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.html` | Modified | `p-tabs` keep-alive + sibling `bw-patient-detail-content` |
| `src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.scss` | Modified | Sticky tablist, flex chain, class rename |
| `src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.ts` | Modified | Client enrichment on open, wiring, scroll reset |
| `src/app/features/admin/bookings/booking-detail-dialog/tabs/reserva/reserva-tab.component.ts` | Modified | Dialog store source of truth, output, dual write |
| `src/app/features/admin/bookings/booking-detail-dialog/tabs/reserva/reserva-tab.component.html` | Modified | dialogMode + output + dialog store bindings |
| `src/app/shared/components/patient-card/patient-detail-content.component.scss` | Modified | `flex: 1` to fill dialog content |
| `src/app/core/stores/booking-dialog.store.spec.ts` | Created | Store surface tests |
| `src/app/shared/components/patient-card/patient-card.component.spec.ts` | Modified | Disabled matrix tests |
| `src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.spec.ts` | Modified | Keep-alive + wiring + enrichment tests |

## Deviations from Design

1. **Scroll reset implementation**: design suggested `viewChild(ElementRef)` over `.p-dialog-content`, but that element lives inside PrimeNG Dialog's own view (not queryable from this component's view). Used `document.querySelector('.bw-booking-detail-dialog .p-dialog-content')` — same pattern already used by `historial-paciente.component.ts` in this repo. Synchronous `scrollTop` reset for testability.
2. **Eager detail reload on open**: tasks.md 3.3 didn't list it explicitly, but design Decision 3 and the delta spec requirement "Reload detail data on dialog open" require it; implemented in `open()` after enrichment.
3. **Old dialog DOM test replaced**: the pre-existing "restores the complete calendar booking…" test asserted phantom testids (`booking-header`/`booking-timing`/`booking-notes` that never existed) and expected Reserva recreation; replaced with the keep-alive contract per task 4.3.
4. **4 commits instead of 3**: patient-card.html disabled bindings (task 4.2 implementation) split into its own commit after Unit 3 to keep each unit coherent.
5. **WIP carryover committed**: the uncommitted `patient-dialog-navigation` base (archived 2026-08-24) was required for the build and is now committed as part of this change's units.

## Issues Found

- `IntersectionObserver` polyfill added to the dialog spec: keep-alive mounts the Historial panel whose `historial-paciente` uses it in `ngAfterViewInit` (jsdom lacks it).
- `app.spec.ts` fails only in the full-suite run (passes isolated) — cross-suite pollution from a pre-existing broken suite; not caused by this change.
- getClient enrichment adds one extra GET per dialog open (design-accepted, Decision 2).

## QA Fixes (post-apply — manual visual QA cycle)

Found and fixed during manual `ng serve` QA. These refined the initial apply output.

| # | Issue (QA) | Root cause | Fix |
|---|-----------|------------|-----|
| 1 | Client name/email/phone absent in header, reserva tab, paciente tab | `getClient` did NOT unwrap the Laravel `{data:...}` wrapper (unlike `getBooking`) → `enriched.client = {data:{...}}` → `client.first_name` undefined | `clients-api.service.ts`: `getClient` → `.pipe(map(r => r.data))` |
| 2 | `packs.data.filter is not a function` error in patient-card | `getClientPacks` also wrapped in `{data:[...]}` | `clients-api.service.ts`: `getClientPacks` → `.pipe(map(r => r.data))` |
| 3 | `sales().data.length` / `recent().data.length` undefined errors when opening prepago/recientes | `getSales`/`getBookings` (with `client_id`) return a **flat array**, NOT `{data,meta}` → `res.data` undefined | `client-detail.store.ts`: `Array.isArray(res) ? res : res.data ?? []` in `loadSales`/`loadRecent` (same defensive pattern as historial store) |
| 4 | Main tablist scrolled away on long historial content | `.p-dialog-content` was the scroll container (whole tablist + content scrolled together) | Moved scroll to `.p-tabpanels` (`overflow-y:auto`), `.p-dialog-content` → `overflow:hidden`, `.p-tablist` no longer sticky (fixed). Updated historial-paciente/pagos/reserva + `returnToReservation` to use `.p-tabpanels` as scroll container |
| 5 | Header: select touched bottom edge, elements not vertically centered | `.p-dialog-header` had `padding-bottom: 0` | `padding: 1.25rem 1.5rem 1rem`; `align-items: center` on header + title-row |
| 6 | Header: chip/badge and state select different heights, misaligned | chip is a short badge, select is `2.25rem` | `.booking-dialog-header` is a horizontal row (no `flex-direction: column`); `.booking-dialog-title-row` `align-items: flex-end` → all children share bottom baseline; state select `height: 2.25rem`; `.booking-client-rut` `align-self: flex-end` (no fixed height); `.booking-service-tag` `height: 2.25rem` |
| 7 | Header elements not left-aligned | `p-select` had `marginLeft: auto` (pushed right) | Removed `[style]="{marginLeft:'auto'}"` from state select |
| 8 | Reserva content lacked inner padding (unlike pago) | `.reserva-form` had `padding: 0.25rem 0` | `padding: 0.75rem` (match pago `sale-body`) |
| 9 | Collapsibles ("Notificaciones" + "Información adicional") visually inconsistent + open-state contrast too strong | notif = custom collapsible, info = PrimeNG `p-panel`; both `--surface-50` (light gray/white) on open | Replaced `p-panel` with custom collapsible (same pattern as notif); added `--open` class → `background: var(--bw-50)` (light `#f0f6ff` / dark `rgba(4,106,244,0.1)` — theme-aware soft highlight). Removed unused `PanelModule` |

**QA fixes tests**: patient-card 41/41, booking-detail-dialog 11/11, client-detail.store 7/7, clients-api getClient/getClientPacks pass (2 pre-existing failures remain: getClientPacksList/useClientPack). Historic note: the 3 `historial-reserva` failures (`bookingsShowingCount`) are pre-existing and unrelated to the scroll change. Test runner has known cross-suite pollution (16-26 failed varies between runs; stable baseline 16 failed / 277 passed).

**QA fixes files changed (uncommitted at time of writing)**:
- `src/app/core/services/api/clients-api.service.ts` + `.spec.ts` (unwrap `{data}`)
- `src/app/core/stores/client-detail.store.ts` (defensive array shape)
- `src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.{html,scss,ts}` (scroll/header/aligment)
- `.../tabs/historial/historial-{paciente,pagos,reserva}.component.ts` (scroll container selector)
- `.../tabs/reserva/reserva-tab.component.{ts,html,scss}` (padding + collapsible custom + `infoOpen` signal)
- `src/app/shared/components/patient-card/patient-card.component.{html,scss}` (notif `--open` class)

## Commits

- `f539b03` refactor(booking-dialog): consolidate dialog state into booking-only store
- `f22b514` feat(booking-dialog): keep-alive p-tabpanels and full-content patient detail
- `84453d7` test(booking-dialog): cover store surface, disabled tabs, keep-alive and enrichment
- `588acc6` feat(patient-card): disable sub-tab buttons when category is loaded and empty

No hooks are physically installed in `.git/hooks` (only `.sample` files), so the
review-readability hooks from `openspec/config.yaml` did not block commits.

## Next Step

`sdd-verify` — verify the change against specs, design, and tasks.
