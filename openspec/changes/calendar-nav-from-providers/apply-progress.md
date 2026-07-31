# Apply Progress: Calendar Navigation from Providers

**Mode**: Strict TDD (test runner: `ng test` — Vitest via Angular build unit-test builder)
**Status**: All 8 tasks complete (1.1–4.3)
**Batches**: Batch 1 (tasks 1.1–2.3, 4.3) done in prior apply run — this batch completed 3.1, 3.2, 3.3, 4.1, 4.2.

## Completed Tasks

### Phase 1: Service Layer
- [x] 1.1 `src/app/core/services/calendar-navigation.service.ts` — pending signals + `navigateToCalendar()` + `consumePending()` + `hasPendingNavigation` (prior batch)
- [x] 1.2 Unit test service (prior batch)

### Phase 2: Providers-List Wiring
- [x] 2.1 Inject service + Router; `goToAgenda()` (prior batch)
- [x] 2.2 pi-calendar buttons wired — table row + mobile card, disabled without location, tooltip "Sin sucursal asignada" (prior batch)
- [x] 2.3 Unit test providers-list (prior batch)

### Phase 3: Full-Calendar Integration (this batch)
- [x] 3.1 Injected `CalendarNavigationService` in `full-calendar.component.ts`; `loadLocations()` success callback checks `hasPendingNavigation()` → `consumePending()` → uses pending locationId instead of `data[0].id`
- [x] 3.2 After consuming pending location, `loadProviders(pendingLocationId, pendingProviderId)`; in the providers success callback `selectedProviderId` is set from pending, `onFilterChange()` runs, and the welcome toast "Mostrando agenda de {providerName} en {locationName}" is shown
- [x] 3.3 Integration test `full-calendar.component.spec.ts` (new): pending filters consumed transactionally; store filters synced; toast shown; provider-missing edge (no toast); page refresh shows defaults

### Phase 4: Verification
- [x] 4.1 All spec scenarios verified: button renders (2.2/2.3 tests), navigation works (1.2/2.3), disabled without location (2.3), filter pre-selection (3.3), toast on arrival (3.3), no persistence on reload (3.3)
- [x] 4.2 Mobile (card) and desktop (table) identical — both buttons bind the same `goToAgenda(provider)` handler, same `[disabled]` and `[pTooltip]` logic (template review, lines 140 and 197)
- [x] 4.3 `npx ng test --no-watch` — 241 passed, 2 pre-existing failures in `clients-api.service.spec.ts` (same as baseline; zero new regressions)

## Files Changed (this batch)

| File | Action | What Was Done |
|------|--------|---------------|
| `src/app/features/admin/calendar/full-calendar.component.ts` | Modified | Injected `CalendarNavigationService`; `loadLocations()` consumes pending filters transactionally; `loadProviders(locationId, providerId?)` pre-selects provider + syncs filters + shows welcome toast |
| `src/app/features/admin/calendar/full-calendar.component.spec.ts` | Created | Integration tests (5): transactional consumption, store sync, toast, provider-missing edge, refresh defaults |

## TDD Cycle Evidence (this batch)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1 | `src/app/features/admin/calendar/full-calendar.component.spec.ts` | Integration | N/A (new file — no prior full-calendar spec) | ✅ Written | ✅ Passed | ✅ 3 cases (pending, store sync, refresh) | ✅ Clean |
| 3.2 | same file | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases (toast shown, missing provider no-toast, refresh no-toast) | ✅ Clean |
| 3.3 | same file | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ 5 cases total | ✅ Clean |

### Test Summary (this batch)
- **Total tests written**: 5
- **Total tests passing**: 5 (full suite: 241 passed, 2 pre-existing failures — unchanged baseline)
- **Layers used**: Integration (5) — real `CalendarNavigationService` + real `BookingStore`, mocked API services
- **Approval tests**: None — no refactoring of existing behavior (default load path preserved via refresh test)
- **Pure functions created**: 0 — component integration layer; no pure logic extracted (service layer already pure)

## Deviations from Design
None — implementation matches `design.md`. `loadProviders` gained an optional second parameter (`providerId`) to carry the pending provider into the success callback, which is the mechanism the design's data flow describes ("in its success callback set selectedProviderId from pending"). The toast uses `summary: providerName` + `detail: "Mostrando agenda de {name} en {location}"` per the project's MessageService convention (`key: 'global'`).

## Issues Found
- `ng build` fails on **pre-existing** SCSS budget errors (patient-card, provider-calendar, full-calendar .scss exceed 8 kB budget). No SCSS files were modified by this change; TypeScript compiles clean. Not caused by this change.
- In this test setup, `TestBed.createComponent` runs initial change detection automatically (ngOnInit + child dialog instantiation). Tests account for it via `mockProvidersApi.getProviders.mockClear()` after creation and full mock coverage of store API dependencies (`ReferenceStore` uses `getRegions`/`getAllComunas`; `BookingStore` uses `getBookings`/`getBlockedSlots`).

## Workload / PR Boundary
- **Mode**: force-chained, feature-branch-chain (2 PR slices)
- **WU1/PR1**: service + providers-list wiring + unit tests + SDD change docs
- **WU2/PR2**: FullCalendar integration + welcome toast + integration tests + apply-progress + tasks.md checkboxes
- **Review budget**: well under 400 changed lines per slice
