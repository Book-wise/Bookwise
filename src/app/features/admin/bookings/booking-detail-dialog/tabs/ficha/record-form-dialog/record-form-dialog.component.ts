import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { LanguageService } from '@services/language.service';
import { HttpErrorService } from '@services/http-error.service';
import type { ClinicalRecordField, ClinicalRecordType } from '@models';
import { ClinicalRecordsStore } from '@core/stores/clinical-records.store';
import { buildRecordForm, toSelectOptions } from '../record-form-fields';

/**
 * Diálogo de captura de una ficha clínica (pestaña Ficha del diálogo de
 * reserva). Sigue el patrón de `provider-dialog`: Reactive Forms, outputs de
 * cierre/guardado. Renderiza los `fields` que define el tipo, en orden.
 *
 * El guardado llama a `ClinicalRecordsStore.create`, que hace el POST real a
 * `/clinical-records`; el diálogo queda en estado `saving` hasta que responde y
 * cierra solo ante un guardado exitoso.
 */
@Component({
  selector: 'bw-record-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
  ],
  templateUrl: './record-form-dialog.component.html',
  styleUrls: ['./record-form-dialog.component.scss'],
})
export class RecordFormDialogComponent {
  private readonly lang = inject(LanguageService);
  private readonly recordsStore = inject(ClinicalRecordsStore);
  private readonly httpError = inject(HttpErrorService);

  visible = input(false);
  type = input.required<ClinicalRecordType>();
  bookingId = input<number | null>(null);
  clientId = input.required<number>();

  /** True mientras el POST está en vuelo (deshabilita Guardar y evita dobles envíos). */
  readonly saving = signal(false);

  closed = output<void>();
  saved = output<void>();

  /** Marca un intento de guardado para mostrar los errores de validación. */
  readonly submitted = signal(false);

  /** Formulario dinámico: un control por cada campo del tipo, en orden. */
  readonly form = computed(() => buildRecordForm(this.type().fields));

  constructor() {
    // Al cambiar de tipo o reabrir el diálogo, se limpia el feedback de
    // validación del intento anterior.
    effect(() => {
      this.visible();
      this.type();
      untracked(() => this.submitted.set(false));
    });
  }

  /** Opciones de un `select` (`label` = `value` = opción). */
  selectOptions(field: ClinicalRecordField): { label: string; value: string }[] {
    return toSelectOptions(field);
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

  onSave(): void {
    this.submitted.set(true);
    this.form().markAllAsTouched();
    if (this.form().invalid || this.saving()) return;

    const values = this.form().getRawValue() as Record<string, unknown>;
    this.saving.set(true);
    this.recordsStore
      .create({
        recordTypeId: this.type().id,
        clientId: this.clientId(),
        bookingId: this.bookingId(),
        values,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.httpError.handle(err, this.t('ficha.form.save'));
        },
      });
  }

  onClose(): void {
    this.closed.emit();
  }

  t(key: string): string {
    return this.lang.t(key);
  }
}
