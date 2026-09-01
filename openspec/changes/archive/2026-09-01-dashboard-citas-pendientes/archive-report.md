# Archive Report: dashboard-citas-pendientes

**Change**: dashboard-citas-pendientes
**Archive date**: 2026-09-01
**Archived to**: `openspec/changes/archive/2026-09-01-dashboard-citas-pendientes/`
**Store**: hybrid (OpenSpec files + Engram)
**Verdict at close**: functional PASS — archive-ready. The strict byte-validator reported `fail`, but solely for intentional, pre-approved dashboard coverage skip (see "Verification Summary").
**Cycle**: proposal → apply (14/14) → verify → archive. No formal `specs/` delta or `design.md` (proposal-driven change — see "Intentional deviations").

## Executive Summary

The change gives the dashboard "Citas Pendientes" card a real purpose and adds a date-range selector to the admin dashboard. Two user-facing features shipped and were verified:

1. **Card "Citas Pendientes" → calendario filtrado**: the card is now a clickable link that navigates to `/admin/calendar` pre-filtered to pending appointments (`status_id=5`), shows an informational toast ("Mostrando citas pendientes..."), and displays a badge with the active date range. Backed by extending `CalendarNavigationService` with `statusIds` and having `FullCalendar` consume the consumed pending status filter.
2. **Selector de rango de fechas**: a mode selector (Mes / Semana / Rango libre), where Mes lists months, Semana lists weeks of the month with ◀ ▶ arrows, and Libre uses two `p-datepicker` fields (Desde/Hasta). The `rxResource` recomputes `date_from`/`date_to` from the chosen range (no longer a fixed week), and a "limpiar filtros" button resets to the standard (current month → today). 20 i18n keys added in both `es.ts` and `en.ts`.

The `is_finalized` flag is intentionally **not** added to the frontend `BookingStatus` model: it is a pending backend contract (see Follow-ups). The card's initial criterion uses the explicit actionable `status_id=5`, matching the proposal's approach.

## Final State

At close the change is complete. Implementation is in the working tree, **not committed** — the orchestrator manages commits/PRs after archive:

| Item | State |
|------|-------|
| Feature 1 | Card "Citas Pendientes" → calendario filtrado (status_id=5) + toast + badge |
| Feature 2 | Selector de rango de fechas (mes / semana / libre) + `rxResource` recalculation + limpiar |
| Implementation tasks | 14/14 complete (`tasks.md`, Work Units 1–4) |
| Work units | 4 (service `statusIds`; FullCalendar consume; dashboard pending card; dashboard range selector) |
| Production build | PASS (`npx ng build`, exit 0; only pre-existing warnings: initial bundle budget exceeded — 820.46 kB vs 500 kB budget — and `luxon` non-ESM; both pre-existing and unrelated) |
| Focused change-suite tests | 28 passed / 0 failed (3 suites: calendar-navigation 13, full-calendar 9, providers-list 6; exit 0) |
| Strict-validator requirements / scenarios | 7/7 requirements · 1/7 scenarios runtime-compliant (rest statically verified) |
| CRITICAL findings | 0 |
| Blockers | 0 |

### Task completion record

The archived `tasks.md` is the authoritative completion record: all 14 implementation tasks are checked `[x]` (1.1–1.4, 2.1–2.3, 3.1–3.2, 4.1–4.5). No stale unchecked implementation task remains in the archived audit trail. This matches `apply-progress.md` (4/4 work units) and `verify-report.md` (tasks 14/14).

### Review gate

No review receipt exists for this candidate (`reviewGate` structurally absent — no `reviews/` artifacts in the change folder, and `gentle-ai sdd-status` reports no `reviewGate`/`reviewOffer` keys). Archive proceeded under ordinary repository policy.

## Specs Synced to Main Specs

None. The change folder contains **no `specs/` delta directory** (opening `specs/` is empty/absent) and there is **no canonical dashboard spec** in `openspec/specs/` to sync against. The change was authored proposal-driven; requirement/scenario coverage was derived for verification from the proposal approach + the matrices in `verify-report.md`. No main spec needs updating, and none was modified. `verify-report.md` notes the same ("No formal delta spec / no `specs/` directory").

## Verification Summary

Two sources coexist here, and per final-state authority the more-recent account wins without hiding the validator's verdict:

- **`verify-report.md` (Engram `#166`, written 2026-09-01 17:38)** — strict byte-validator `verdict: fail`, `critical_findings: 0`, `blockers: 0`, requirements 7/7, scenarios **1/7** runtime-compliant. The YAML `fail` reflects strict byte-validator semantics (a scenario is only "complete" when a covering test passed at runtime); it does **not** indicate a functional defect.
- **Orchestrator launch prompt (most recent account)** — states verify was functionally PASS (28/28 specs, build OK) and that the strict validator `fail` is driven by **incomplete dashboard spec coverage** (p-chart / ChartDataLabels canvas logic not rendered in jsdom). That skip was a **deliberate, pre-approved decision**, documented in `apply-progress.md` note 5 and corroborated by `verify-report.md` "Coherence" table. Under `strict_tdd: false` (and `testing.coverage: false` in `openspec/config.yaml`), this is **not a blocker**.

Therefore, at close: the change is **functionally complete and correct** (14/14 tasks, 28/28 focused tests pass, `npx ng build` exits 0, zero CRITICAL findings, zero blockers). The strict-validator `fail` is recorded as a **deliberate WARNING**, not a defect. **No CRITICAL issue blocks archive.**

### Compliance summary (from \( \text{verify-report} \))

1/7 scenarios fully runtime-compliant (R1 service statusIds); 1 partial (R2 — default-location status-only route tested, pending-location-sin-provider branch static-only); 5 statically-verified/untested (R3–R7). The untested dashboard-only logic (range computeds, `rxResource` recalculation, card click handler, toast, badge, i18n keys) is statically verified and was intentionally skipped under `strict_tdd: false`.

## Intentional Deviations

1. **No `specs/` delta and no `design.md`**: the change is proposal-driven; the orchestrator delivered scope inline (via proposal + approach), consistent with `verify-report.md` ("Version: N/A (proposal-driven; no formal delta spec / no `specs/` directory)") and native status reporting `design: missing`. No design decisions remained open: apply followed the proposal's two approaches exactly.
2. **Dashboard spec intentionally skipped** (`apply-progress.md` note 5): the dashboard imports `p-chart` + `ChartDataLabels` (canvas / Chart.js), which does not render in jsdom without invasive canvas mocks — a flakiness risk disproportionate to the value. The status-only navigation flow is covered at the service + full-calendar level (real service + store integration). `is_finalized` is likewise not added to the frontend model (deferred backend contract; documented in `tasks.md` and `apply-progress.md` note 6).
3. **Strict `fail` vs functional PASS**: deliberately recorded as a WARNING (cov-isable only), not as a defect — see Verification Summary.

## Key Architectural Decisions

| ID | Decision | Status |
|----|----------|--------|
| D1 | Extend `CalendarNavigationService` with `statusIds`: `pendingStatusIds = signal<number[]>([])`, new `navigateToCalendar(locationId, providerId, statusIds, router)` (statusIds 3rd, router 4th per proposal), `consumePending()` returns `{locationId, providerId, statusIds}` and clears all three (incl. rejection-clear) | Implemented — all callers updated |
| D2 | `FullCalendar.loadLocations` applies pending `statusIds` to `selectedStatusIds` + `onFilterChange()`, in both the default-location route and the pending-location-sin-provider route | Implemented |
| D3 | Pending card passes `status_id=5` (`PENDING_STATUS_ID`) as the explicit actionable criterion; `is_finalized` deferred to the backend contract | Implemented |
| D4 | Range selector as signals (`rangeMode: 'mes'\|'semana'\|'libre'`, `selectedMonth`, `selectedWeekStart`, `customStart`, `customEnd`) + computeds (`rangeDetails`/`rangeParams`/`rangeBadgeText`, luxon + active timezone) driving `date_from`/`date_to` in the `rxResource`; `clearFilters()` resets to current month → today | Implemented |
| D5 | Browser-API stubs (`matchMedia`/`ResizeObserver`/`IntersectionObserver`) scoped inside `full-calendar.component.spec.ts` to make a pre-existing jsdom-broken suite runnable (base `b11f028` failed 8/8 for the same reason); no global test infra touched | Implemented |

## Follow-ups (recorded, out of scope)

1. **Backend contract `is_finalized`** (coordinated follow-up): expose `is_finalized` in `BookingResource` + `BookingStatusResource` (`'is_finalized' => $this->is_finalized`), and set it in the seeder for terminal states — `3` (Asiste), `4` (No asistió), `7` (Cancelado) = `true`; `1, 2, 5, 6` = `false`. Until then the card uses `status_id=5`. Optionally add `is_finalized?: boolean` to the frontend `BookingStatus` (`src/app/core/models/responses/bookings.ts`) once the backend exposes it.
2. **Multi-negocio futuro** (pivot `user_business`): see the onboarding-roles-multitenant document when multi-business scoping is planned.
3. **Dashboard spec** (optional hardening): if a canvas mock for `p-chart`/`ChartDataLabels` is later enabled, extract the range computeds (`rangeDetails`/`rangeParams`/`rangeBadgeText`) plus `onPendingCardClick`/`clearFilters`/`shiftWeek` into a testable facade/helper and add a focused spec. Also add one test for `navigateToCalendar(locationId, null, [5])` to close the R2 pending-location-sin-provider gap. Neither is required to ship.

## Engram Traceability

Artifacts read/persisted for this cycle (observation IDs):

| Artifact | Engram observation ID |
|----------|----------------------|
| change registration (estados criterion + `is_finalized` contract) | `#160` |
| apply-progress | `#165` (`sdd/dashboard-citas-pendientes/apply-progress`) |
| verify-report | `#166` (`sdd/dashboard-citas-pendientes/verify-report`) |

`proposal.md` and `tasks.md` exist only on the filesystem (archived here); no Engram observations were persisted for those phases. This archive report is persisted as `sdd/dashboard-citas-pendientes/archive-report`.

## Conclusion

The `dashboard-citas-pendientes` SDD cycle is **complete and archived** — two features shipped (clickable pending card → filtered calendar + toast + badge; date-range selector mes/semana/libre with `rxResource` recalculation), verified functionally PASS (14/14 tasks, 28/28 focused tests, build exit 0, zero CRITICAL/blockers). The strict byte-validator `fail` is a documented, pre-approved, non-blocking coverage WARNING (p-chart/ChartDataLabels canvas not rendered in jsdom under `strict_tdd: false`). No main spec required syncing (no delta spec authored). Remaining items are non-blocking follow-ups (backend `is_finalized`, future multi-business, optional dashboard spec). Ready for the next change.
