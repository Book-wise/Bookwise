# Proposal: Navegación al calendario desde proveedores

## Intent

Eliminar la fricción de tener que re-seleccionar sucursal y profesional manualmente al ir desde la lista de profesionales al calendario. Cada fila de "Agenda" debe navegar a `/admin/calendar` con los filtros pre-seleccionados.

## Scope

### In Scope
- Botón "Agenda" (pi pi-calendar) en filas de tabla y cards mobile con navegación a `/admin/calendar`
- Botón deshabilitado + tooltip cuando el provider no tiene location asignada
- `CalendarNavigationService` con pending signals para locationId y providerId
- Consumo de pending filters en `FullCalendar.loadLocations()` (transactional one-shot)
- Toast de bienvenida: "Mostrando agenda de [provider] en [location]"
- Navegación same-tab via `Router.navigate()`

### Out of Scope
- Query params persistentes en URL (consumo transactional — se pierde al recargar)
- Navegación desde otros componentes (clientes, dashboard)
- Guard/routing parameter validation

## Capabilities

### New Capabilities
- `calendar-navigation`: Cross-component navigation with transactional filter pre-selection between providers list and calendar.

### Modified Capabilities
- None (initial SDD change — no existing specs)

## Approach

1. **CalendarNavigationService** (`src/app/core/services/`): signals `pendingLocationId` y `pendingProviderId`, método `navigateToCalendar(locationId, providerId)` que setea signals y navega via Router.
2. **ProvidersList**: inyecta servicio + Router. Botón "Agenda" llama a `navigateToCalendar()` con `provider.location.id` y `provider.id`.
3. **FullCalendar.loadLocations()**: al cargar locations exitosamente, leer pending signals. Si existen, seleccionar location/providers, consumir (set a null), llamar `onFilterChange()` y mostrar toast.
4. Filtrado existente via `BookingStore.setFilters()` y `onFilterChange()` hace el resto.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/core/services/calendar-navigation.service.ts` | New | Signal-based pending filter holder |
| `src/app/features/admin/providers/providers-list.component.ts` | Modified | Add `goToAgenda()` + inject Router/service |
| `src/app/features/admin/providers/providers-list.component.html` | Modified | Wire `(onClick)` en botones pi-calendar, `[disabled]` sin location |
| `src/app/features/admin/calendar/full-calendar.component.ts` | Modified | Read pending filters in `loadLocations()`, show welcome toast |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Race condition: pending filters llegan antes que locations API | Low | Consumir en success callback de loadLocations(), no en ngOnInit |
| Filtros "fantasma" si usuario recarga la página | Low | Consumo transactional — pending se borra al leer |
| Provider sin location → botón disabled sin feedback | Low | Tooltip "Sin sucursal asignada" |

## Rollback Plan

Revert commits del servicio nuevo + providers-list wiring + full-calendar changes. Servicio sin dependencias externas — rollback limpio.

## Dependencies

- `Router` de Angular (ya presente en el módulo)
- `BookingStore.setFilters()` (ya existe)
- `MessageService` de PrimeNG (ya presente en full-calendar)

## Success Criteria

- [ ] Click "Agenda" en provider con location navega a `/admin/calendar` y carga sus datos filtrados
- [ ] Provider sin location tiene botón deshabilitado con tooltip
- [ ] Toast "Mostrando agenda de..." aparece al llegar desde providers-list
- [ ] Recarga de página NO mantiene filtros pre-seleccionados
- [ ] Funciona igual en mobile (cards) y desktop (tabla)
