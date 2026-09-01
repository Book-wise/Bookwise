# Change: patient-tabs-content-polish

> Estado: PENDIENTE (registrado 2026-09-01, para aplicar después de `booking-notifications`).
> Solicitudes del usuario hechas mientras se codificaba el change previo.

## Intent

Pulir la tab de historial del paciente y uniformar los márgenes del contenido de los tabs del diálogo de detalle de reserva.

## Scope (in)

1. **Historial del paciente — labels**: renombrar "Últimas creaciones" → "Últimas creaciones de reserva".
2. **Historial del paciente — columnas de fecha**: en las sub-tabs "Últimas atenciones" y "Últimas creaciones de reserva", la tabla debe mostrar:
   - **Fecha de atención**: el día donde está agendado (booking `start_time`).
   - **Fecha de creación**: la fecha donde fue creada la agenda (booking `created_at`).
3. **Márgenes uniformes en tabs**: en los tabs **Recordatorios, Paciente, Ficha e Historial**, usar los mismos márgenes/padding del contenido que en **Reserva y Pago** (`.tab-content` / `.reserva-form` `padding: 0.75rem`).

## Scope (out)

- NO cambiar la lógica de datos del historial (solo presentación de columnas).
- NO tocar el flujo de notificaciones (`booking-notifications`).

## Specs de referencia

- `specs/patient-history-table/spec.md` (nuevo).
- Delta opcional sobre `openspec/specs/patient-dialog-navigation/` si aplica.

## Archivos probables

- `src/app/features/admin/bookings/booking-detail-dialog/tabs/historial/historial-paciente.component.{ts,html,scss}`
- `src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.scss` (márgenes de tabs)
- i18n `es.ts` / `en.ts` (labels)
