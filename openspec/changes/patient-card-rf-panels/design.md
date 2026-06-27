# Design: patient-card-rf-panels

## Arquitectura propuesta

### Componentes principales
- `src/app/shared/components/patient-card-rf/patient-card-rf.component.ts`
  - Orquesta el card principal.
  - Controla el estado `activePanel`.
  - Expone métodos `openPanel(tab)` y `closePanel()`.
  - Renderiza el panel host derecho.

- `src/app/shared/components/patient-card-rf/patient-card-form.factory.ts`
  - Exporta `createPatientForm(fb: FormBuilder, client?: Client): FormGroup`.
  - Define validaciones:
    - `first_name`, `last_name`: required.
    - `email`: Validators.email.
    - `phone`: optional.

- Paneles deslizables:
  - `patient-card-plans-panel.component.ts`
  - `patient-card-sessions-panel.component.ts`
  - `patient-card-prepaid-panel.component.ts`
  - `patient-card-recent-panel.component.ts`

Cada panel es standalone y recibe el cliente como input.

### Flujo de datos
1. `BookingFormDialogComponent` construye `patientForm` usando la fábrica.
2. Cuando se selecciona un cliente existente, aplica `patientForm.patchValue(cliente)`.
3. Pasa `patientForm` y `selectedClient` a `bw-patient-card-rf`.
4. `bw-patient-card-rf` muestra los botones de navegación y el panel lateral actual.
5. Cada panel usa `client.id` para futuras cargas de datos.

### Separación de responsabilidades
- `BookingFormDialogComponent`: propietario del estado de reserva y paciente.
- `bw-patient-card-rf`: comportamiento de card, navegación y panel host.
- Paneles individuales: contenido de cada sección y lógica futura específica.

### Nota de implementación
El `patient-card-rf` no debe reutilizar ni alterar el componente descartado `patient-card.component.ts`.
