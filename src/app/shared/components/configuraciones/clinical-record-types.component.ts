import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { LanguageService } from '@services/language.service';
import type { ClinicalRecordField, ClinicalRecordFieldType } from '@models';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';

/** Desplegable «Tipo de campo»: value = contrato, label = i18n. */
const FIELD_TYPES: { value: ClinicalRecordFieldType; key: string }[] = [
  { value: 'text', key: 'settings.clinical_types.field.type.text' },
  { value: 'longtext', key: 'settings.clinical_types.field.type.longtext' },
  { value: 'number', key: 'settings.clinical_types.field.type.number' },
  { value: 'select', key: 'settings.clinical_types.field.type.select' },
  { value: 'date', key: 'settings.clinical_types.field.type.date' },
];

/**
 * Pestaña **Fichas médicas** de Configuraciones (artboard
 * `design/config-tipos-ficha/02-maestro-detalle-builder.html`).
 *
 * Maestro-detalle: a la izquierda la lista de tipos del negocio (nombre, cuántos
 * campos, estado) y a la derecha el editor del tipo seleccionado (nombre,
 * descripción corta, disponibilidad en la agenda y los campos con su tipo y
 * obligatoriedad). Consume `ClinicalRecordTypesStore`, que hoy edita en memoria
 * porque el backend no expone el dominio clínico todavía.
 */
@Component({
  selector: 'bw-clinical-record-types',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToggleSwitchModule,
  ],
  templateUrl: './clinical-record-types.component.html',
  styleUrls: ['./clinical-record-types.component.scss'],
})
export class ClinicalRecordTypesComponent {
  private readonly lang = inject(LanguageService);
  readonly store = inject(ClinicalRecordTypesStore);

  readonly activeCount = computed(() => this.store.types().filter((t) => t.active).length);

  readonly fieldTypeOptions = computed(() =>
    FIELD_TYPES.map((ft) => ({ label: this.t(ft.key), value: ft.value })),
  );

  t(key: string, params?: Record<string, string>): string {
    return this.lang.t(key, params);
  }

  /** «6 campos» / «1 campo». */
  fieldMetaLabel(count: number): string {
    const unit = this.t(
      count === 1
        ? 'settings.clinical_types.field.singular'
        : 'settings.clinical_types.field.plural',
    );
    return `${count} ${unit}`;
  }

  onSearch(event: Event): void {
    this.store.setSearch((event.target as HTMLInputElement).value);
  }

  onName(event: Event): void {
    this.store.updateDraftName((event.target as HTMLInputElement).value);
  }

  onDescription(event: Event): void {
    this.store.updateDraftDescription((event.target as HTMLInputElement).value);
  }

  onFieldLabel(field: ClinicalRecordField, event: Event): void {
    this.store.updateFieldLabel(field.key, (event.target as HTMLInputElement).value);
  }

  onFieldType(field: ClinicalRecordField, type: ClinicalRecordFieldType): void {
    this.store.updateFieldType(field.key, type);
  }

  onFieldRequired(field: ClinicalRecordField, required: boolean): void {
    this.store.updateFieldRequired(field.key, required);
  }
}
