# Tasks: Calendar Navigation from Providers

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180–220 |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Service + providers-list → PR 2: FullCalendar |
| Delivery strategy | force-chained |
| Chain strategy | feature-branch-chain |

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | CalendarNavigationService + providers-list wiring + unit tests | PR 1 | Base = feature/tracker branch |
| 2 | FullCalendar integration + welcome toast + integration tests | PR 2 | Base = PR #1 branch |

## Phase 1: Service Layer

- [x] 1.1 Create `src/app/core/services/calendar-navigation.service.ts` with `pendingLocationId`/`pendingProviderId` signals, `navigateToCalendar()`, `consumePending()`, `hasPendingNavigation` computed
- [x] 1.2 Unit test: service — `navigateToCalendar` sets signals and calls `router.navigate`; `consumePending` returns values and clears them; `hasPendingNavigation` reflects null/non-null state

## Phase 2: Providers-List Wiring

- [x] 2.1 Inject `CalendarNavigationService` + `Router` in `providers-list.component.ts`; add `goToAgenda(provider)` that calls service with `provider.location.id` and `provider.id`
- [x] 2.2 Wire pi-calendar buttons in `providers-list.component.html`: `(onClick)` → `goToAgenda(provider)`, `[disabled]` when `!provider.location`, `pTooltip="Sin sucursal asignada"` on both table row (line 140) and mobile card (line 197)
- [x] 2.3 Unit test: `goToAgenda` calls service with correct IDs; button disabled when location null; tooltip text present

## Phase 3: Full-Calendar Integration

- [x] 3.1 Inject `CalendarNavigationService` in `full-calendar.component.ts`; in `loadLocations()` success callback, check `hasPendingNavigation()` — if true, `consumePending()` and use pending locationId instead of `data[0].id`
- [x] 3.2 After consuming pending location, call `loadProviders(pendingLocationId)`; in its success callback set `selectedProviderId` from pending, call `onFilterChange()`, show welcome toast "Mostrando agenda de {providerName} en {locationName}"
- [x] 3.3 Integration test: pending filters consumed transactionally; toast shown; page refresh shows defaults

## Phase 4: Verification

- [x] 4.1 Verify all spec scenarios: button renders, navigation works, disabled without location, filter pre-selection, toast on arrival, no persistence on reload
- [x] 4.2 Verify mobile (card) and desktop (table) behavior identical
- [x] 4.3 Run `npx ng test --no-watch` — zero new regressions (241 passed, 2 pre-existing failures in clients-api.service.spec.ts)
