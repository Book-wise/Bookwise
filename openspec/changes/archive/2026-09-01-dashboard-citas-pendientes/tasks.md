# Tasks: dashboard-citas-pendientes

> Estado: implementado (2026-09-01). Aplicación directa desde proposal + alcance del orchestrator.

## Work Units

### Work Unit 1 — CalendarNavigationService: statusIds

- [x] 1.1 Agregar `pendingStatusIds = signal<number[]>([])` e incluir en `hasPendingNavigation`
- [x] 1.2 Cambiar firma `navigateToCalendar(locationId, providerId, statusIds, router)`; limpiar `statusIds` en el `.catch` de navegación fallida
- [x] 1.3 Cambiar `consumePending()` para devolver y limpiar también `statusIds`
- [x] 1.4 Actualizar `calendar-navigation.service.spec.ts` (nuevo comportamiento de statusIds)

### Work Unit 2 — FullCalendar consume pending statusIds

- [x] 2.1 Aplicar `pending.statusIds` a `selectedStatusIds` + `onFilterChange()` en `loadLocations` (incl. el caso default con location sin pending)
- [x] 2.2 Actualizar caller y spec de `providers-list` por la nueva firma
- [x] 2.3 Actualizar `full-calendar.component.spec.ts`: stubs de browser APIs (matchMedia/Resize/Intersection) + test de navegación solo-por-estado

### Work Unit 3 — Dashboard card "Citas Pendientes" → calendario + toast + badge

- [x] 3.1 Card clickeable → `navigateToCalendar(null, null, [5], router)` + toast (MessageService)
- [x] 3.2 Badge con el rango activo en la card

### Work Unit 4 — Dashboard selector de rango + recalculo del rxResource

- [x] 4.1 Señales de rango (`rangeMode`, `selectedMonth`, `selectedWeekStart`, `customStart`, `customEnd`)
- [x] 4.2 Computed `rangeDetails`/`rangeParams`/`rangeBadgeText` (mes/semana/libre, ES vía luxon + timezone activa)
- [x] 4.3 Recalcular `date_from`/`date_to` del `rxResource` según el rango (pending/today/week respetan el rango)
- [x] 4.4 UI selector (p-select modo/mes/semana + flechas + datepickers + limpiar) en template + scss
- [x] 4.5 Claves i18n ES/EN

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~360 (6 src + 2 i18n + 3 spec) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Decision needed before apply | No |

## Nota de alcance

El flag `is_finalized` en `BookingStatus` (frontend, `responses/bookings.ts`) NO se agregó: es un contrato de backend pendiente (follow-up coordinado) y, según el Approach del proposal, el filtro inicial usa `status_id=5` sin necesidad de `is_finalized`.
