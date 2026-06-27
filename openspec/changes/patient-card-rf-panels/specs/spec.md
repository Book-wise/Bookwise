# Specs: patient-card-rf-panels

## Objetivo funcional
Crear una implementación nueva y aislada de patient card basada en Reactive Forms para el diálogo de reserva, con paneles deslizables desde la derecha para las secciones:
- planes
- sesiones
- pre-pagados
- recientes

## Requisitos
1. `BookingFormDialogComponent` debe construir y poseer un `FormGroup` de paciente.
2. `bw-patient-card-rf` debe aceptar:
   - `@Input() patientForm: FormGroup`
   - `@Input() client?: Client`
3. `bw-patient-card-rf` debe renderizar los botones de navegación y controlar el estado de panel abierto.
4. Cada botón debe abrir un panel deslizable desde la derecha.
5. Los paneles deben existir como componentes independientes:
   - `PatientCardPlansPanelComponent`
   - `PatientCardSessionsPanelComponent`
   - `PatientCardPrepaidPanelComponent`
   - `PatientCardRecentPanelComponent`
6. Cada panel debe exponer:
   - `@Input() client!: Client`
   - `@Output() back = new EventEmitter<void>()`
7. Cada panel muestra por ahora solo un título y un botón de volver.
8. El card y los paneles deben ser implementados en `src/app/shared/components/patient-card-rf/`.
9. No tocar `src/app/shared/components/patient-card/patient-card.component.ts` existente.

## Escenarios de validación
- Cuando `booking-form-dialog` selecciona un cliente existente, el `patientForm` se actualiza con sus datos y se pasa a `bw-patient-card-rf`.
- Al pulsar el botón `planes`, se abre el panel `PatientCardPlansPanelComponent`.
- Al pulsar el botón `volver` dentro del panel, se cierra el panel y vuelve la vista principal del card.
- Si se abre otro panel, el anterior se cierra y el nuevo se muestra correctamente.
- Los paneles reciben el `client` correcto y pueden usar `client.id` para futuras cargas.

## Notas de línea base
- El estado del paciente debe ser único y basado en Reactive Forms.
- La UI de los paneles es mínima en esta fase; la lógica de datos posterior se hará dentro de cada panel.
- El proyecto ya tiene una rama nueva `feat/patient-card/rf-panels` creada desde `develop`.
