import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuModule } from 'primeng/menu';
import type { MenuItem } from 'primeng/api';
import { LanguageService } from '@services/language.service';
import type { ClinicalRecord, ClinicalRecordType } from './clinical-record.model';

/**
 * Pestaña **Ficha** del diálogo de detalle de la reserva.
 *
 * Presentacional: no consulta nada. El padre le pasa los registros y el catálogo
 * de tipos; hoy ambos llegan vacíos porque el backend no expone dominio clínico
 * (ver `clinical-record.model.ts`), así que la pantalla muestra estados vacíos
 * honestos en lugar de datos inventados.
 *
 * Dos bloques, como el artboard `design/ficha-medica/02-ficha-subpestanas.html`:
 * 1. Fichas asociadas a esta reserva + acción «Agregar tipo de registro/ficha».
 * 2. Historial de consultas anteriores (tarjeta por registro).
 */
@Component({
  selector: 'bw-ficha-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MenuModule],
  templateUrl: './ficha-tab.component.html',
  styleUrls: ['./ficha-tab.component.scss'],
})
export class FichaTabComponent {
  private readonly lang = inject(LanguageService);

  /** Fichas ya asociadas a la reserva abierta. */
  readonly records = input<ClinicalRecord[]>([]);
  /** Historial de consultas anteriores del paciente. */
  readonly history = input<ClinicalRecord[]>([]);
  /** Catálogo de tipos de ficha (Configuraciones). */
  readonly recordTypes = input<ClinicalRecordType[]>([]);
  /** Etiqueta del servicio contratado, ya formateada por el padre. */
  readonly serviceLabel = input<string>('');

  readonly addRecord = output<number>();
  readonly openRecord = output<number>();
  /** El usuario quiere configurar los tipos de ficha (pantalla de Configuraciones). */
  readonly configureTypes = output<void>();

  readonly hasRecords = computed(() => this.records().length > 0);
  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasTypes = computed(() => this.recordTypes().filter((t) => t.active).length > 0);

  readonly typeMenuItems = computed<MenuItem[]>(() =>
    this.recordTypes()
      .filter((type) => type.active)
      .map((type) => ({
        label: type.name,
        command: () => this.addRecord.emit(type.id),
      })),
  );

  t(key: string, params?: Record<string, string>): string {
    return this.lang.t(key, params);
  }

  /** Fecha corta tipo `12/11/2026 - 10:30 am`. */
  formatWhen(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const suffix = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;

    return `${day}/${month}/${year} - ${hours}:${minutes} ${suffix}`;
  }
}
