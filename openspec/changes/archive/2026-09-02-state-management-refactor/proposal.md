# Proposal: State Management Refactor — ReferenceStore

## Intent

Eliminar las 7 llamadas `forkJoin` duplicadas de datos maestros (clientes, servicios, profesionales, ubicaciones, packs) introduciendo un **ReferenceStore** centralizado con `@ngrx/signals`. Esto reemplaza `DataCacheService` y el patrón actual donde cada componente fetcha independientemente, sin fuente única de verdad.

## Scope

### In Scope
- PoC de `@ngrx/signals` con un store para validar el patrón
- `ReferenceStore` con los 5 tipos de entidad (`withEntities`)
- Migración de booking-form-dialog, booking-dialog, block-time-dialog, dashboard, provider-availability
- Eliminación de `DataCacheService`
- Tests unitarios para los stores
- Ramp-up del equipo (pair programming + documentación interna)

### Out of Scope
- Calendarios (full-calendar, provider-calendar)
- Payments y payment-detail (payment-tab, reserva-tab)
- `BookingStore` con optimistic updates (futuro)
- Unificación de calendarios (futuro)
- `AuthStore` (futuro si roles crecen)

## Capabilities

> Pure refactor — no new business capabilities, no spec-level changes.

### New Capabilities
None

### Modified Capabilities
None

## Approach

1. **Ramp-up + PoC**: Sesión de pair programming para aprender `@ngrx/signals`. PoC con un store mínimo (locations) corriendo en el dashboard.
2. **ReferenceStore**: Store completo con `withEntities` para clients, services, providers, locations, packs. `rxMethod` para carga reactiva. `stale-while-revalidate` como política de refresco.
3. **Migración incremental**: Booking-form-dialog → booking-dialog → block-time-dialog → dashboard → provider-availability. Un componente por PR.
4. **Limpieza**: Eliminar `DataCacheService`. Remover notificaciones de datos de referencia de `BookingUpdateService` (sin romper el refresh de calendarios).
5. **Tests**: Store tests con Vitest (puras funciones señal → fáciles de testear).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Add `@ngrx/signals`, `@ngrx/rxjs-interop` |
| `src/app/core/stores/reference.store.ts` | **New** | ReferenceStore con 5 entidades + rxMethod |
| `src/app/core/services/data-cache.service.ts` | **Deleted** | Reemplazado por ReferenceStore |
| `src/app/core/services/booking-update.service.ts` | Modified | Solo remover ref-data notifications |
| `booking-form-dialog.component.ts` | Modified | Usar ReferenceStore en lugar de forkJoin |
| `booking-dialog.component.ts` | Modified | Usar ReferenceStore en lugar de forkJoin |
| `block-time-dialog.component.ts` | Modified | Usar ReferenceStore en lugar de forkJoin |
| `admin-dashboard.component.ts` | Modified | Consumir datos reales del ReferenceStore |
| `provider-availability.component.ts` | Modified | Usar ReferenceStore para locations |
| `src/app/core/stores/*.spec.ts` | **New** | Tests unitarios para stores |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Team sin experiencia en @ngrx/signals | Medium | PoC previo + pair programming + documentación |
| Perder stale-while-revalidate de DataCacheService | Low | Implementar misma política en ReferenceStore |
| Coexistencia de patrones durante migración | Medium | PRs pequeños, un componente a la vez |
| BookingUpdateService roto para calendarios | Low | Solo remover ref-data; dejar intacto el Subject<Booking> para bookings |

## Rollback Plan

`DataCacheService` se mantiene en el código pero sin uso hasta eliminar todos los consumidores. Si ReferenceStore falla en producción, revertir imports a DataCacheService. El PoC detecta problemas graves antes de la migración.

## Dependencies

- `npm install @ngrx/signals @ngrx/rxjs-interop`

## Success Criteria

- [ ] Los 5 tipos de datos maestros cargan a través de ReferenceStore
- [ ] Cero llamadas `forkJoin` para datos de referencia en la app
- [ ] `DataCacheService` eliminado sin regresiones
- [ ] Todos los tests existentes pasan + nuevos tests de stores
- [ ] `BookingUpdateService` ya no se usa para notificaciones de datos de referencia
- [ ] Dashboard muestra datos reales (no hardcodeados)
