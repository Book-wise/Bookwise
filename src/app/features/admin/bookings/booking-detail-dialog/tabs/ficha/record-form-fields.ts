import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import type { ClinicalRecordField } from '@models';

/**
 * Construcción y validación del formulario dinámico de una ficha clínica,
 * compartida por el diálogo de captura (`record-form-dialog`) y el detalle
 * inline (`record-detail`) para que ambos acepten exactamente los mismos
 * valores. Un control por `ClinicalRecordField`, en el orden del tipo.
 */

/**
 * Un `select` solo puede guardar valores que existan en `field.options`.
 * `required` se valida aparte (un valor vacío es `required`, no `invalidOption`).
 */
export function selectOptionValidator(options: string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    if (value === '' || value === null || value === undefined) return null;
    return options.includes(String(value)) ? null : { invalidOption: true };
  };
}

/** Valor inicial de un control: los inputs son strings; `null`/`undefined` → `''`. */
export function toControlValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Un `FormGroup` con un control no-nullable por campo, prellenado con `values`
 * (clave = `field.key`). `required` y `select` aplican las mismas reglas que el
 * diálogo de captura.
 */
export function buildRecordForm(
  fields: ClinicalRecordField[],
  values: Record<string, unknown> = {},
): FormGroup {
  const controls: Record<string, FormControl> = {};
  for (const field of fields) {
    const validators: ValidatorFn[] = [];
    if (field.required) validators.push(Validators.required);
    if (field.type === 'select') validators.push(selectOptionValidator(field.options ?? []));
    controls[field.key] = new FormControl(toControlValue(values[field.key]), {
      nonNullable: true,
      validators,
    });
  }
  return new FormGroup(controls);
}

/** Opciones de un `select` (`label` = `value` = opción). */
export function toSelectOptions(field: ClinicalRecordField): { label: string; value: string }[] {
  return (field.options ?? []).map((option) => ({ label: option, value: option }));
}
