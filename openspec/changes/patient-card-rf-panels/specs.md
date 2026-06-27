# Spec: patient-card-rf-panels

## Requisitos funcionales
1. `BookingFormDialogComponent` debe crear y poseer un `FormGroup` del paciente.
2. El nuevo componente `bw-patient-card-rf` debe aceptar:
   - `@Input() patientForm: FormGroup`
   - `@Input() client?: Client`
3. El `bw-patient-card-rf` debe renderizar botones de navegación para:
   - planes
   - sesiones
   - pre-pagados
   - recientes
4. Cada botón abre un panel deslizable desde la derecha.
5. Cada panel debe ser un componente independiente con:
   - `@Input() client!: Client`
   - `@Output() back = new EventEmitter<void>()`
6. Cada panel muestra un título y un botón volver que cierra el panel.
7. La lógica de datos específicos de cada sección se mantendrá dentro de su panel, no en el card principal.

## Restricciones
- No modificar `src/app/shared/components/patient-card/patient-card.component.ts` existente.
- El nuevo código debe vivir en `src/app/shared/components/patient-card-rf/`.
- Usar Reactive Forms para el estado del paciente.
- Mantener la UI de los paneles mínima por ahora.

## Casos de prueba
- Al seleccionar cliente existente, `booking-form-dialog` parchea `patientForm` y lo pasa al card.
- Al pulsar un botón de sección, el panel correcto se abre con efecto slide.
- Al pulsar volver, el panel se cierra.
- Los paneles reciben el `client` correcto y pueden usar `client.id`.
