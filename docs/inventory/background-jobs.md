# Background Jobs

## Confirmado por el repositorio

No hay workers, service workers, colas, cron jobs, schedulers ni procesos backend en este repositorio frontend.

Si se consideran tareas en segundo plano dentro del navegador, existen estos procesos:

- `DataCacheService` realiza revalidacion en background cuando una entrada de cache esta vencida y ya existe dato local. Fuente: `src/app/core/services/data-cache.service.ts`.
- `HttpErrorService` registra listener `offline`, listener `online` y un `setInterval` cada 3 segundos para detectar cambios de conectividad. Fuente: `src/app/core/services/http-error.service.ts`.
- `FullCalendarComponent` y `ProviderCalendarComponent` actualizan el label de hora actual cada 60 segundos con `setInterval`. Fuentes: `src/app/features/admin/calendar/full-calendar.component.ts` y `src/app/features/provider/calendar/provider-calendar.component.ts`.
- `BookingFormDialogComponent` usa debounce de 400 ms para prechequeo de pacientes similares. Fuente: `src/app/features/admin/bookings/booking-form-dialog/booking-form-dialog.component.ts`.
- `ClientsListComponent` usa debounce de 300 ms para busqueda de clientes. Fuente: `src/app/features/admin/clients/clients-list.component.ts`.

## Desconocido o no verificable

No se puede descartar que el backend Laravel tenga colas o jobs; ese codigo no esta en este repositorio.

