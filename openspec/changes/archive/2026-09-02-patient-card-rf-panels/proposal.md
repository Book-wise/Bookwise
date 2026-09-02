# Proposal: Migración del patient card a Reactive Forms

## Contexto
El repositorio Bookwise es una aplicación Angular con PrimeNG. En el flujo actual de reserva, `booking-form-dialog` usa formularios template-driven (`ngModel`) y existe un `patient-card` previo que proviene de una rama descartada. Para evitar reintroducir cambios descartados, se creará una nueva implementación bajo `src/app/shared/components/patient-card-rf/`.

## Objetivo
Crear una versión reutilizable del card de paciente basada en Reactive Forms y un conjunto de paneles laterales deslizables para las secciones:
- planes
- sesiones
- pre-pagados
- recientes

El dialog de reserva debe construir y poseer el `FormGroup` del paciente y pasar ese estado al `patient-card-rf`.

## Alcance
- Nuevo componente `bw-patient-card-rf` en `src/app/shared/components/patient-card-rf/`.
- Nueva fábrica de formulario: `patient-card-form.factory.ts`.
- Cuatro paneles autónomos para los contenidos deslizables.
- Integración con `booking-form-dialog` mediante `patientForm` y `client`.

## Criterios de éxito
- El cambio se desarrolla en `feat/patient-card/rf-panels`.
- Se crean los artefactos de SDD en `openspec/changes/patient-card-rf-panels/`.
- El diseño no toca `src/app/shared/components/patient-card/patient-card.component.ts` existente.
- La implementación queda lista para revisión y pruebas.
