# Tasks: State Management Refactor — ReferenceStore

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450–500 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Foundation) → PR 2 (Migration) → PR 3 (Cleanup + Tests) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation: PoC + ReferenceStore | PR 1 | New stores only, no consumer changes |
| 2 | Migration: 5 componentes | PR 2 | Depends on PR 1; migrates consumers |
| 3 | Cleanup + Tests | PR 3 | DataCacheService removal, store tests |

## Phase 1: Foundation — PoC + ReferenceStore

- [x] 1.1 Install `@ngrx/signals` v21.1.1 via npm
- [x] 1.2 Crear PoC store para locations en `src/app/core/stores/location-poc.store.ts` — probar patrón en dashboard
- [x] 1.3 Crear `src/app/core/stores/reference.store.ts` con `withState` (5 entity arrays + meta-state loading/loaded/error)
- [x] 1.4 Implementar `rxMethod` para carga reactiva (una rxMethod por entidad) en ReferenceStore
- [x] 1.5 Agregar métodos `invalidateClients()`, `invalidateServices()`, `invalidateAll()`, etc.

## Phase 2: Migration — Componentes a ReferenceStore

- [x] 2.1 Migrar `booking-form-dialog.component.ts` — reemplazar `forkJoin(5)` + `DataCacheService` por `ReferenceStore` + providers API call directo
- [x] 2.2 Migrar `booking-dialog.component.ts` — reemplazar `forkJoin(4)` por `ReferenceStore`
- [x] 2.3 Migrar `block-time-dialog.component.ts` — reemplazar `forkJoin(2)` para locations/providers por `ReferenceStore`
- [x] 2.4 Migrar `provider-availability.component.ts` — usar `ReferenceStore` para locations
- [x] 2.5 Migrar `admin-dashboard.component.ts` — remplazar `LocationPocStore` por `ReferenceStore`

## Phase 3: Cleanup — Remover servicios legacy

- [x] 3.1 Eliminar `src/app/core/services/data-cache.service.ts`
- [x] 3.2 `booking-update.service.ts` solo tenía `Subject<Booking>` — nunca tuvo reference data notificaciones. No-op.
- [x] 3.3 Calendarios siguen recibiendo notificaciones vía `bookingUpdate.updated$` — sin cambios, no afectado por refactor
- [x] 3.4 `ng test` pasa: **98 tests, 4 suites, 0 failures**

## Phase 4: Testing

- [x] 4.1 Tests unitarios para `ReferenceStore` — 26 tests: initial state, loading lifecycle, computed signals, invalidation (6), error handling (5), manual load methods
- [x] 4.2 `LocationPocStore` eliminado — era dead code desde que admin-dashboard migró a ReferenceStore
- [x] 4.3 Tests de integración: booking-form-dialog.spec.ts corre 45 tests cubriendo flujo completo de creación/edición con ReferenceStore mockeado
- [ ] ~4.4 Dashboard datos reales~ — **Out of scope** por decisión en proposal.md (charts con datos hardcodeados se mantienen como mejora futura)
