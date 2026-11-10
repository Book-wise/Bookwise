import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { LanguageService } from '@services/language.service';
import { HttpErrorService } from '@services/http-error.service';
import { ClinicalRecordsStore } from '@core/stores/clinical-records.store';
import type {
  ClinicalRecord,
  ClinicalRecordField,
  ClinicalRecordFieldType,
  ClinicalRecordType,
} from '@models';
import { buildRecordForm, toSelectOptions } from '../record-form-fields';
import { formatDate, formatDateTime } from '../record-format';

/** Un campo de la ficha ya resuelto para pintar (lectura o edición). */
export interface RecordDetailField {
  key: string;
  label: string;
  /** `null` cuando el tipo no está en el catálogo y solo se conoce la clave. */
  type: ClinicalRecordFieldType | null;
  value: unknown;
}

/**
 * Detalle **inline** de una ficha clínica (`design/ficha-detalle-inline/01-master-detalle.html`).
 *
 * Vive dentro de la pestaña Ficha del diálogo de reserva — nunca en un `p-dialog`
 * propio. Arranca en modo lectura (solo los campos con valor), «Editar ficha»
 * construye el mismo formulario dinámico del diálogo de captura y «Guardar
 * cambios» hace `PATCH /clinical-records/{id}` vía `ClinicalRecordsStore.update`.
 * «‹ Volver a las fichas» emite `back` y el padre vuelve a la lista.
 */
@Component({
  selector: 'bw-record-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
  ],
  templateUrl: './record-detail.component.html',
  styleUrls: ['./record-detail.component.scss'],
})
export class RecordDetailComponent {
  private readonly lang = inject(LanguageService);
  private readonly recordsStore = inject(ClinicalRecordsStore);
  private readonly httpError = inject(HttpErrorService);

  readonly record = input.required<ClinicalRecord>();
  /** Tipo del registro; `null` si el catálogo todavía no lo tiene. */
  readonly type = input<ClinicalRecordType | null>(null);

  /** El usuario quiere volver a la lista de fichas. */
  readonly back = output<void>();

  readonly mode = signal<'read' | 'edit'>('read');
  readonly saving = signal(false);
  /** Marca un intento de guardado para mostrar los errores de validación. */
  readonly submitted = signal(false);
  /** Formulario de edición: vacío en lectura, se arma al entrar en edición. */
  readonly form = signal<FormGroup>(new FormGroup({}));

  /** Campos del tipo que tienen un valor capturado (no vacíos). */
  readonly visibleFields = computed<RecordDetailField[]>(() => {
    const values = this.record().values ?? {};
    const fields = this.type()?.fields ?? [];

    if (fields.length > 0) {
      return fields
        .map<RecordDetailField>((field: ClinicalRecordField) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          value: values[field.key],
        }))
        .filter((field) => this.hasValue(field.value));
    }

    // Sin tipo en el catálogo (p. ej. un tipo retirado) solo se conocen las
    // claves crudas: se muestran tal cual antes que ocultar datos del paciente.
    return Object.entries(values)
      .filter(([, value]) => this.hasValue(value))
      .map<RecordDetailField>(([key, value]) => ({ key, label: key, type: null, value }));
  });

  /** Campos editables: el set completo del tipo, en su orden. */
  readonly editFields = computed<ClinicalRecordField[]>(() => this.type()?.fields ?? []);

  enterEdit(): void {
    this.submitted.set(false);
    this.form.set(this.buildForm());
    this.mode.set('edit');
  }

  /** «Cancelar»: descarta lo escrito y vuelve a la lectura sin guardar. */
  onCancel(): void {
    this.submitted.set(false);
    this.mode.set('read');
  }

  onBack(): void {
    this.back.emit();
  }

  onSave(): void {
    this.submitted.set(true);
    this.form().markAllAsTouched();
    if (this.form().invalid || this.saving()) return;

    const values = this.form().getRawValue() as Record<string, unknown>;
    this.saving.set(true);
    this.recordsStore.update(this.record().id, values).subscribe({
      next: () => {
        this.saving.set(false);
        this.submitted.set(false);
        this.mode.set('read');
      },
      error: (err) => {
        this.saving.set(false);
        this.httpError.handle(err, this.t('ficha.detail.save'));
      },
    });
  }

  /** Hasta F10 no hay endpoint de PDF: se imprime la vista del navegador. */
  onPrint(): void {
    // TODO(F10): reemplazar por el PDF real — GET /clinical-records/{id}/pdf
    window.print();
  }

  /** Mensaje de error legible por lector de pantalla, por campo. */
  errorMessage(field: ClinicalRecordField): string | null {
    const control = this.form().controls[field.key];
    if (!control?.errors) return null;
    if (!this.submitted() && !control.touched) return null;

    if (control.errors['required']) return this.t('ficha.form.required');
    if (control.errors['invalidOption']) return this.t('ficha.form.invalid_option');
    return null;
  }

  /** Opciones de un `select` (`label` = `value` = opción). */
  selectOptions(field: ClinicalRecordField): { label: string; value: string }[] {
    return toSelectOptions(field);
  }

  /** Valor legible de un campo: fechas en `dd/mm/aaaa`, todo lo demás tal cual. */
  formatValue(field: RecordDetailField): string {
    const value = field.value;
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');

    const text = String(value);
    if (field.type === 'date' && text) return formatDate(text);
    return text;
  }

  /** Fecha y hora de creación: `dd/mm/aaaa - h:mm am/pm`. */
  formatWhen(iso: string): string {
    return formatDateTime(iso);
  }

  t(key: string): string {
    return this.lang.t(key);
  }

  private buildForm(): FormGroup {
    return buildRecordForm(this.type()?.fields ?? [], this.record().values ?? {});
  }

  private hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim() !== '';
  }
}
