# Archive Report — State Management Refactor (ReferenceStore)

> Archived: 2026-09-02
> Change dir: `openspec/changes/state-management-refactor/` → `openspec/changes/archive/2026-09-02-state-management-refactor/`
> Related exploration archived alongside: `openspec/changes/archive/2026-09-02-state-management-analysis/` (source exploration).

## Summary

This was a **pure refactor**: eliminating duplicated reference-data `forkJoin`
calls by introducing a centralized `ReferenceStore` built on `@ngrx/signals`.
It replaced `DataCacheService` and the per-component fetch pattern that had no
single source of truth. Being a pure refactor, **no spec-level changes were
produced** — the change dir had **no `specs/` directory, so nothing was promoted
to canonical specs** in `openspec/specs/`.

## What Was Implemented

The code was delivered and merged to `develop` via the feature branch chain and
GitHub PR **#16**, squash-merged as commit `67dd324`
(`feat(store): ReferenceStore migration — @ngrx/signals #16`, 2026-06-26), plus
extension commits `24dbc82` and `9cc382d` (regions/comunas additions,
2026-07-26). It was **not** delivered through the live SDD pipeline; the change
dir was retained as an audit record and is being archived after the fact.

### Verified code state (confirmed by code inspection per the orchestrator)

- `@ngrx/signals` `^21.1.1` is installed (`package.json`, line 39).
- `ReferenceStore` exists at `src/app/core/stores/reference.store.ts` (`signalStore`
  from `@ngrx/signals`, `rxMethod` from `@ngrx/signals/rxjs-interop`).
- The store holds **6 read-only entity arrays** — `clients`, `locations`,
  `providers`, `services`, `packs`, and `regions` (the latter two added by the
  extension commits) — plus `comunasByRegion`, with per-entity meta-state
  (`loading`/`loaded`/`error`).
- Per-entity `rxMethod` load functions (`loadLocations`, `loadProviders`,
  `loadServices`, `loadClients`, `loadPacks`, `loadRegions`) and a `loadAll`.
- `invalidate*` methods per entity (uses closures over the load `rxMethods`):
  `invalidateLocations`, `invalidateProviders`, `invalidateServices`,
  `invalidateClients`, `invalidatePacks`, `invalidateRegions`, plus `invalidateAll`.
- `DataCacheService` **was deleted**: `src/app/core/services/data-cache.service.ts`
  no longer exists, and a grep for `DataCacheService` across `src/app` returns
  **0 matches**.
- Remaining `forkJoin` uses in `src/app` are confined to out-of-scope areas —
  `booking.store.ts` (booking/blocked-slots), `admin-dashboard.component.ts`
  (dashboard counts), and `historial.store.ts` (bookings + sales). **No
  reference-data `forkJoin` remains in consumers** (the original 7 were
  migrations in booking-form-dialog, booking-dialog, block-time-dialog,
  provider-availability, and admin-dashboard).

## Task Completion

`tasks.md` in the archived change dir reports **17/18** tasks checked, with the
single unchecked task **4.4** (`~4.4 Dashboard datos reales~`) explicitly marked
**"Out of scope"** by decision recorded in `proposal.md` — the dashboard charts
keep hardcoded data as a documented future improvement. This is a deliberate,
proposal-approved scoping decision, **not** a stale unchecked implementation
task; there is no pending reference-data work left in scope.

## Verification Evidence

- A **build/tests pass at close was NOT independently re-run** during this archive
  phase. The orchestrator confirmed the code was already verified in production
  via delivery (the merged PRs and the post-merge `ng test` state documented at
  implementation time: **98 tests, 4 suites, 0 failures**). This archive phase
  reports code-state facts confirmed by **code inspection**, not a fresh test run.
- Integration coverage noted at implementation: `booking-form-dialog.spec.ts`
  runs 45 tests with a mocked `ReferenceStore`; `ReferenceStore` unit tests
  cover initial state, loading lifecycle, computed signals, invalidation,
  error handling, and manual load methods.

## Archive Integrity

- Both directories were moved with `git mv` (history preserved); git reports them
  as renames.
- Mandatory `diff -r` readback (pre-move snapshot vs. archive target) produced
  **empty output for both** — no bytes altered or truncated.
- The active `openspec/changes/` directory no longer contains either change;
  only the previously-active `patient-card-rf-panels` and `archive/` remain.
- This `archive-report.md` is additive-only and was written after the move; it is
  excluded from the source/destination comparison.

## Notes

- **No specs were promoted** — pure refactor, no delta specs existed.
- The related exploration (`state-management-analysis/exploration.md`, an
  analysis-only doc with no proposal/spec/tasks) was moved to
  `openspec/changes/archive/2026-09-02-state-management-analysis/` so the active
  changes tree is clean.
