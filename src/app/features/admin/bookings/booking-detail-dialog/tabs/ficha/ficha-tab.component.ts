import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuModule } from 'primeng/menu';
import type { MenuItem } from 'primeng/api';
import { LanguageService } from '@services/language.service';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';
import { ClinicalRecordsStore } from '@core/stores/clinical-records.store';
import { BookingDialogStore } from '@core/stores/booking-dialog.store';
import type { ClinicalRecord, ClinicalRecordType } from '@models';
import { RecordFormDialogComponent } from './record-form-dialog/record-form-dialog.component';

/**
 * Pestaña **Ficha** del diálogo de detalle de la reserva.
 *
 * El catálogo de tipos y los registros de la reserva se leen de los stores de
 * dominio root (`ClinicalRecordTypesStore`, `ClinicalRecordsStore`); el
 * `BookingDialogStore` (provisto por el diálogo) aporta el `booking_id`/
 * `client_id` actuales. Los inputs `records`/`recordTypes` se conservan por
 * compatibilidad con el template del padre, que hoy pasa colecciones vacías.
 */
@Component({
  selector: 'bw-ficha-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MenuModule, RecordFormDialogComponent],
  templateUrl: './ficha-tab.component.html',
  styleUrls: ['./ficha-tab.component.scss'],
})
export class FichaTabComponent {
  private readonly lang = inject(LanguageService);
  private readonly typesStore = inject(ClinicalRecordTypesStore);
  private readonly recordsStore = inject(ClinicalRecordsStore);
  private readonly dialogStore = inject(BookingDialogStore);

  /** Fichas ya asociadas a la reserva abierta (heredado del padre; hoy vacío). */
  readonly records = input<ClinicalRecord[]>([]);
  /** Historial de consultas anteriores del paciente. */
  readonly history = input<ClinicalRecord[]>([]);
  /** Catálogo de tipos heredado del padre; el store root es la fuente real. */
  readonly recordTypes = input<ClinicalRecordType[]>([]);
  /** Etiqueta del servicio contratado, ya formateada por el padre. */
  readonly serviceLabel = input<string>('');

  readonly openRecord = output<number>();
  /** El usuario quiere configurar los tipos de ficha (pantalla de Configuraciones). */
  readonly configureTypes = output<void>();

  readonly bookingId = computed(() => this.dialogStore.booking()?.id ?? null);
  readonly clientId = computed(() => this.dialogStore.booking()?.client?.id ?? null);

  readonly associatedRecords = computed(() => this.recordsStore.byBooking(this.bookingId()));
  readonly hasRecords = computed(() => this.associatedRecords().length > 0);
  readonly hasHistory = computed(() => this.history().length > 0);

  /** Tipos activos del catálogo, ordenados por `sort_order` (o creación). */
  readonly activeTypes = computed<ClinicalRecordType[]>(() => {
    const active = this.typesStore
      .types()
      .filter((type) => type.active)
      .map((type, index) => ({ type, index }));

    // `sort_order` manda cuando viene; sin él se conserva el orden de creación
    // (la posición en el array del store). `sort` es estable.
    active.sort((a, b) => {
      const aOrder = a.type.sort_order;
      const bOrder = b.type.sort_order;
      if (aOrder != null && bOrder != null) return aOrder - bOrder;
      if (aOrder != null) return -1;
      if (bOrder != null) return 1;
      return a.index - b.index;
    });

    return active.map(({ type }) => type);
  });

  readonly hasTypes = computed(() => this.activeTypes().length > 0);

  readonly typeMenuItems = computed<MenuItem[]>(() =>
    this.activeTypes().map((type) => ({
      label: type.name,
      command: () => this.openForm(type),
    })),
  );

  readonly formVisible = signal(false);
  readonly selectedType = signal<ClinicalRecordType | null>(null);

  private openForm(type: ClinicalRecordType): void {
    this.selectedType.set(type);
    this.formVisible.set(true);
  }

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
