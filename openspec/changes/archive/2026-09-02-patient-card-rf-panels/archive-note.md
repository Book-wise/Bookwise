# Archive Note — patient-card-rf-panels (descartado, NO implementado)

> Change: `patient-card-rf-panels`. Fecha de archive: `2026-09-02`. Estado: **DISCARDED / NOT IMPLEMENTED**.

## Motivo del descarte

El change proponía migrar la UI de paciente a Reactive Forms (`FormGroup` + componente `patient-card-rf`
+ `patient-card-form.factory.ts` + 4 paneles deslizables) e integrarlo en `booking-form-dialog`.

**Nunca se implementó.** Verificación con evidencia (2026-09-02):

- No existe `src/app/shared/components/patient-card-rf/` (solo el legacy `patient-card/`).
- No existe `patient-card-form.factory.ts`.
- No existe rama `feat/patient-card/rf-panels`.
- `booking-form-dialog` sigue con template-driven forms (`ngModel`, `@ViewChild('patientForm') patientForm?: NgForm`) — 0 `FormGroup`/`ReactiveForms` en su TS.
- Tasks: 0/8 sin marcar.

## Superado por evolución del código

Desde la creación del proposal (2026-06-17), la UI de paciente evolucionó por otra vía:
- El flujo de detalle se movió a `booking-detail-dialog` con tabs (`reserva-tab`, `historial`, `payment`).
- El contenido de paciente vive en `patient-card/` + `patient-detail-content.component.ts` (refactorizado 2026-08/09).
- Rehacerlo a Reactive Forms con paneles deslizables re-litigaba una dirección que el repo ya tomó.

Decisión: **descartar** en lugar de archivar como entregado. No hay specs que promover (la spec describía
una capacidad que nunca se construyó — promoverla contaminaría `openspec/specs/` con una capacidad fantasma).

## Contenido movido

- proposal.md, design.md, specs/spec.md, specs.md, tasks.md, state.yaml → `openspec/changes/archive/2026-09-02-patient-card-rf-panels/`
