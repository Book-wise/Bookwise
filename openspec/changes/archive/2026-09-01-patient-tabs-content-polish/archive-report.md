# Archive Report: patient-tabs-content-polish

**Change**: patient-tabs-content-polish
**Archive date**: 2026-09-01
**Archived to**: `openspec/changes/archive/2026-09-01-patient-tabs-content-polish/`
**Store**: hybrid (OpenSpec files + Engram)
**Verdict at close**: `pass` — archive-ready
**Cycle**: proposal → specs → tasks → apply → verify → archive (no design phase — see "Intentional deviations")

## Executive Summary

Small UI-polish change on the booking detail dialog. Three user requests were implemented and verified: (1) the patient-history sub-tab "Últimas creaciones" was renamed to "Últimas creaciones de reserva"; (2) the shared history table now shows two date columns — "Fecha de atención" (`start_time` via `formatCardDate`) and "Fecha de creación" (`created_at` via new helper `formatCreatedAt`, with "—" fallback when `created_at` is absent) — replacing the single "Fecha" column, applied to both "Últimas atenciones" and "Últimas creaciones de reserva" sub-tabs through one shared template; (3) tab content margins were unified: `.tab-content { padding: 0.75rem; }` became the single source of truth, removing the internal `padding: 0.75rem` of `.reserva-form` and `.sale-body` so all 6 tabs (Reserva, Pago, Recordatorios, Paciente, Ficha, Historial) render exactly `0.75rem`. A new spec `patient-history-table` was promoted to the canonical specs. Verified green: PASS with 3/3 requirements, 5/5 scenarios, 17/17 focused change-suite tests, build exit 0, zero CRITICAL findings, zero blockers. Small change: no chained PR (single PR, `delivery_strategy: single-pr`).

## Final State

At close the change is complete. Implementation is in the working tree, **not committed** — the orchestrator manages commits/PRs after archive:

| Item | State |
|------|-------|
| Implementation tasks | 4/4 complete (`tasks.md`, Phases 1–2) |
| Work units | 3 user requests (labels, date columns, uniform margins) + 1 test task |
| Branch | `develop` (54e431d) per `apply-progress.md` |
| Production build | PASS (`npx ng build`, exit 0; only pre-existing warnings: initial bundle budget exceeded — 820.46 kB vs 500 kB budget, and `luxon` non-ESM warning; both pre-existing and unrelated) |
| Focused change-suite tests | 17 passed / 0 failed (3 suites, exit 0) |
| Requirements compliant | 3/3 |
| Scenarios | 5/5 COMPLIANT |
| CRITICAL findings | 0 |
| Blockers | 0 |
| Delivery | Single PR — no chained PR (forecast in `tasks.md`: chained PRs not recommended, 400-line budget risk Low, ~30 changed lines) |

### Task completion record

The archived `tasks.md` is the authoritative completion record: all 4 implementation tasks are checked `[x]` (1.1, 1.2, 1.3, 2.1), corroborated by native `gentle-ai sdd-status` (`taskProgress.total: 4, completed: 4, allComplete: true`) at archive time. Note: `apply-progress.md` ("Tasks: 3/3") and `verify-report.md` ("Tasks total 3") snapshot the cycle as 3 units — they count the 3 user requests / work units; `tasks.md` actually lists 4 implementation tasks (Phase 1 has 3, Phase 2 has 1). Per final-state authority the persisted tasks artifact (4/4) wins; no stale unchecked implementation task remains in the archived audit trail.

### Review gate

No review receipt exists for this candidate (`reviewGate` structurally absent — no `reviews/` artifacts in the change folder; `gentle-ai sdd-status` reports no `reviewGate`/`reviewOffer` keys). Archive proceeded under ordinary repository policy.

## Specs Synced to Main Specs

| Domain | Action | Details |
|--------|--------|---------|
| `patient-history-table` | Created | Promoted the delta spec (a full spec, not a delta) to `openspec/specs/patient-history-table/spec.md` — 3 requirements: Renombrar "Últimas creaciones"; Mostrar fecha de atención y fecha de creación; Márgenes uniformes del contenido de tabs. Byte-identical mechanical copy (diff empty). |

The proposal mentioned an optional delta on `patient-dialog-navigation` ("si aplica"); no such delta was authored in `specs/` and the dialog-navigation requirements are untouched — the tabs-polish behavior lives entirely in the new `patient-history-table` domain.

### Source-of-truth updates

- `openspec/specs/patient-history-table/spec.md` — new canonical spec for the patient-history table presentation.

## Verification Summary

`verify-report` verdict: **PASS** (`verify-report.md`; Engram `#161`; evidence_revision `sha256:b401f500…`). Evidence: focused change-suite 17/17 — `historial-paciente.component.spec.ts` 3/3 (new spec), `booking-detail-dialog.component.spec.ts` 11/11, `payment-tab.component.spec.ts` 3/3 — build exit 0, 3/3 requirements with 5/5 scenarios covered. REQ-02-S2 (a "Últimas creaciones de reserva" row shows both columns) covered indirectly via the shared table template (the tested row qualifies for `createdBookings`); REQ-03-S1 (uniform margins) verified statically (6 `.tab-content` divs at `0.75rem`, diff-based), as the project has no visual-test infrastructure.

**Recorded environment exception** (non-blocking, from `apply-progress.md`): pre-existing tests that fail in the full suite (full-calendar, booking-form-dialog, historial-reserva, clients-api) are NOT from this change and were not touched.

## Intentional Deviations

1. **No `design.md`**: the orchestrator delivered the scope inline (change chico); documented in `apply-progress.md` ("No existe design.md… orquestador entregó alcance inline") and `verify-report.md` (Coherence N/A — implementation follows spec and proposal without deviations). Native status reports `design: missing` and `nextRecommended: design` from the generic DAG; the orchestrator explicitly directed archive for this small change, and no design decisions were open (apply followed Option A: `.tab-content` as single source of truth; `formatCreatedAt` helper pattern replicated from `historial-reserva`).
2. **Snapshot count "3" vs tasks artifact "4"**: see Task completion record — reporting inaccuracy only, all 4 checkboxes checked.
3. **Spec language**: the promoted `patient-history-table` spec is authored in Spanish, while sibling canonical specs (e.g. `patient-dialog-navigation`, `client-notifications`) are in English. Byte-identical promotion per the mechanical copy contract; flagged here for a future optional consistency pass (no action taken in archive).

## Key Architectural Decisions

| ID | Decision | Status |
|----|----------|--------|
| D1 | Option A: `.tab-content { padding: 0.75rem; }` as the single source of truth; remove internal `padding: 0.75rem` from `.reserva-form` and `.sale-body` to avoid double padding | Implemented — both components exclusive to the booking-detail-dialog (verified by grep in `apply-progress.md`); no blast radius outside |
| D2 | `formatCreatedAt(iso: string \| undefined): string` → `iso ? tzService.formatCardDate(iso) : '—'` — guard needed because `created_at` is `string \| undefined` on `Booking`; pattern replicated from `historial-reserva.component.ts` | Implemented |
| D3 | One shared history table for both sub-tabs (`currentList()` alternates `attendedBookings`/`createdBookings`); template change covers both | Implemented |
| D4 | New `historial-paciente.component.spec.ts` (3 tests: renamed label, both date columns per row, "—" fallback) with full `HistorialStore`/`TimezoneService` mocks and global `IntersectionObserver`/`ResizeObserver`/`matchMedia` (PrimeNG TabList requires ResizeObserver; fails in jsdom without globals) | Implemented |

## Follow-ups (recorded, out of scope — from verify-report SUGGESTIONs)

1. REQ-02-S2: no test explicitly selects the `creaciones` sub-tab (via `onTabChange`); a 3-line test would close the direct coverage (currently indirect via shared template).
2. REQ-03-S1: uniform padding verified statically; a `getComputedStyle` test in `booking-detail-dialog` would add runtime CSS evidence.

None of these block the change; both are optional hardening for a future cycle.

## Engram Traceability

Artifacts read/persisted for this cycle (observation IDs):

| Artifact | Engram observation ID |
|----------|----------------------|
| change registration (3 user requests) | `#154` (pending change note, pre-cycle) |
| apply-progress | `#158` (`sdd/patient-tabs-content-polish/apply-progress`) |
| verify-report | `#161` (`sdd/patient-tabs-content-polish/verify-report`) |

proposal/spec/tasks of this cycle exist only on the filesystem (archived here); no Engram observations were persisted for those phases.

This archive report is persisted as `sdd/patient-tabs-content-polish/archive-report`.

## Conclusion

The `patient-tabs-content-polish` SDD cycle is **complete and archived** — small change (3 user requests, ~30 changed lines), verified PASS (17/17 tests, build OK), delivered as a single PR (no chain). The canonical spec `patient-history-table` reflects the new behavior. Remaining items are non-blocking optional follow-ups. Ready for the next change.
