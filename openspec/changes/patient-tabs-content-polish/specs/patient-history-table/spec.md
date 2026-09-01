# Domain: patient-history-table

## Purpose

Hacer legibles las fechas del historial del paciente en el diálogo de detalle de reserva: distinguir cuándo está agendada una atención y cuándo se creó la agenda.

## Requirement: Renombrar "Últimas creaciones"

The system MUST rename the sub-tab "Últimas creaciones" to "Últimas creaciones de reserva".

- Scenario: Al abrir el historial del paciente, el sub-tab aparece como "Últimas creaciones de reserva" (no "Últimas creaciones").

## Requirement: Mostrar fecha de atención y fecha de creación

The system MUST show, in both "Últimas atenciones" and "Últimas creaciones de reserva", two columns:
- **Fecha de atención**: el día donde está agendado el booking (`start_time`).
- **Fecha de creación**: la fecha donde fue creada la agenda (`created_at`).

- Scenario: Una fila de "Últimas atenciones" muestra la fecha de atención (start_time formateado) y la fecha de creación (created_at formateado).
- Scenario: Una fila de "Últimas creaciones de reserva" muestra ambas columnas.
- Scenario: Si `created_at` está ausente, la celda de fecha de creación muestra "—".

## Requirement: Márgenes uniformes del contenido de tabs

The system MUST apply the same content padding/margins in the Recordatorios, Paciente, Ficha and Historial tabs as used in Reserva and Pago (`.tab-content` / `.reserva-form` padding `0.75rem`).

- Scenario: El contenido de los tabs Recordatorios, Paciente, Ficha e Historial tiene el mismo padding lateral/vertical que Reserva y Pago.
