# Change: dashboard-citas-pendientes

> Estado: REGISTRADO (2026-09-01). Pendiente de implementar. Diseño acordado con el usuario.

## Intent

Dar propósito claro al card "Citas Pendientes" del dashboard: que sea un **link accionable** que lleva al calendario filtrado por las citas que **requieren atención** (según el criterio de estados basado en `is_finalized`), con toast informativo. Además, permitir modificar el **rango de fechas** del dashboard (mes/semana/datepicker).

## Criterio de estados (definido)

El backend ya tiene el flag `is_finalized` (boolean) en `BookingStatus` — **nació con este propósito**: determinar qué citas requieren o no atención. Hoy está **sin usar** (el seeder no lo setea y ningún resource lo expone).

### Clasificación semántica de los 7 estados

| id | Estado | is_cancellation | is_finalized (propuesto) | Requiere atención | Grupo |
|---|---|---|---|---|---|
| 1 | Reservado | false | false | No | Agenda normal |
| 2 | Confirmado | false | false | No | Agenda normal |
| 3 | Asiste | false | **true** | No | Terminal (resultado) |
| 4 | No asistió | false | **true** | No | Terminal (resultado) |
| 5 | **Pendiente** | false | false | **SÍ** | **Requiere decisión** |
| 6 | En espera | false | false | No | Agenda normal |
| 7 | Cancelado | true | **true** | No | Terminal (anulación) |

**Regla**: una cita **requiere atención** cuando `is_finalized=false` y su estado es accionable. El caso claro de "pendiente de resolver" es el estado **Pendiente (5)**; Reservado/Confirmado/En espera son agenda normal (ocupación de slot). El propósito del card es: **"hay citas que requieren tu decisión: confirmarlas, asignarlas o cancelarlas"**.

## Contrato necesario (front + backend)

Para que el front pueda filtrar el card de pendientes por `is_finalized`, se requiere:

### Backend (follow-up a coordinar)
1. `BookingStatus::is_finalized` se setea en el seeder para los estados terminales (3, 4, 7 → true; 1, 2, 5, 6 → false).
2. `BookingStatusResource` y el bloque `'status'` de `BookingResource` exponen `is_finalized`.
   ```php
   'is_finalized' => $this->is_finalized,
   ```

### Front
3. `BookingStatus` (`src/app/core/models/responses/bookings.ts`) agrega `is_finalized?: boolean;`.
4. El card "Citas Pendientes" del dashboard:
   - Filtro: `status_id=5` (Pendiente) como criterio accionable explícito (respaldado por `is_finalized=false` cuando esté disponible).
   - Badge/rango visible en la card (el estándar = mes actual → hoy; o el rango elegido).
   - Click → navegar a `/admin/calendar` con el filtro de estado Pendiente preseleccionado + **toast** informativo ("Mostrando citas pendientes...").

## Rango de fechas (dashboard)

- Selector con 3 modos: **Mes** (lista de meses), **Semana** (semanas del mes), **Rango libre** (dos `p-datepicker` Desde/Hasta).
- **Estándar**: mes actual hasta la fecha de hoy.
- Botón **limpiar filtros** para volver al estándar.
- El rango define `date_from`/`date_to` en el `rxResource` del dashboard.
- "Citas pendientes" filtra por el rango (mostrando las fechas en la card vía badge).

## Scope (out)

- NO implementar la lógica de envío de notificaciones (backend/carlitox).
- NO cambiar la máquina de estados del backend (solo marcar `is_finalized` y exponerlo).
- El card de Pendiente lleva al calendario filtrado; no abre un diálogo nuevo.

## Archivos probables

- `src/app/features/admin/dashboard/admin-dashboard.component.{ts,html,scss}`
- `src/app/core/services/calendar-navigation.service.ts` (extender con `statusIds`)
- `src/app/features/admin/calendar/full-calendar.component.ts` (consumir pending statusIds)
- i18n es.ts/en.ts (labels del selector de rango, toast del card)

## Approach — Card "Citas Pendientes" → calendario

El backend ya soporta `getBookings({ status_id: 5 })` (Pendiente). No requiere `is_finalized` para el filtro inicial (ese flag es para el criterio semántico futuro). Implementación:

1. **Extender `CalendarNavigationService`** para soportar `statusIds` (además de location/provider). Agregar `pendingStatusIds = signal<number[]>([])`; `navigateToCalendar(locationId, providerId, statusIds, router)`; `consumePending()` devuelve también `statusIds`. El `hasPendingNavigation` incluye statusIds no vacíos.
2. **Calendario** consume pending: tras `consumePending()`, si `statusIds` no vacío → `this.selectedStatusIds = statusIds` + `this.onFilterChange()` (sincroniza store + refetch).
3. **Dashboard**: card "Citas Pendientes" clickeable → `calNav.navigateToCalendar(...)` con `statusIds=[5]` + **toast** informativo ("Mostrando citas pendientes...") + badge con el rango visible.

## Approach — Selector de rango de fechas

1. **Estados**: `rangeMode: 'mes' | 'semana' | 'libre'`, `selectedMonth`, `selectedWeek`, `customStart`, `customEnd`.
2. **Modo Mes**: `p-select` con los 12 meses; rango = `startOf('month')` → `endOf('month')`.
3. **Modo Semana**: `p-select` con semanas del mes + flechas ◀ ▶; rango = semana.
4. **Modo Libre**: dos `p-datepicker` (Desde/Hasta).
5. **Estándar**: mes actual → hoy. Botón **limpiar filtros** → vuelve al estándar.
6. El `rxResource` recibe el rango como input y recalcula `date_from`/`date_to` en las llamadas (hoy usa semana actual fija).
7. "Citas Pendientes" filtra por el rango; la card muestra un **badge** con "rango estándar" o el rango elegido.

## Follow-up backend (coordinación)

- Exponer `is_finalized` en `BookingResource` + `BookingStatusResource`.
- Setear `is_finalized` en seeder para estados terminales.
