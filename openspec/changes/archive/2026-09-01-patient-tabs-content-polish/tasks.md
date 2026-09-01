# Tasks: Patient Tabs Content Polish

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~30 (4 src + 1 spec) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Historial del paciente — labels y columnas de fecha

- [x] 1.1 `historial-paciente.component.html`: renombrar sub-tab "Últimas creaciones" → "Últimas creaciones de reserva" (spec: "Renombrar Últimas creaciones"). Test: focused spec.
- [x] 1.2 `historial-paciente.component.{html,ts}`: reemplazar la columna "Fecha" por dos columnas — "Fecha de atención" (`start_time` vía `formatCardDate`) y "Fecha de creación" (`created_at` vía nuevo helper `formatCreatedAt(iso?: string)` que devuelve "—" si está ausente; patrón replicado de historial-reserva). Aplica a ambas sub-tabs (una sola tabla compartida). Test: focused spec.
- [x] 1.3 `historial-paciente.component.spec.ts` (nuevo): cubre el label renombrado, ambas columnas con sus fechas por fila, y el fallback "—" cuando `created_at` falta. Requires test: Yes.

## Phase 2: Márgenes uniformes en tabs

- [x] 2.1 `booking-detail-dialog.component.scss`: `.tab-content` padding `0.5rem 0` → `0.75rem` (todos los tabs). Para evitar doble padding, quitar el `padding: 0.75rem` interno de `.reserva-form` (`reserva-tab.component.scss`) y `.sale-body` (`payment-tab.component.scss`); ambos componentes son exclusivos del dialog (verificado). Resultado: los 6 tabs con exactamente `0.75rem`. Test: dialog + payment specs verdes.

TDD note: `strict_tdd: false` — implement + test per task, no RED-first gate.
