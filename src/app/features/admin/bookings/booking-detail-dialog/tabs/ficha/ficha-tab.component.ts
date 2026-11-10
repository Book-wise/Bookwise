import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuModule } from 'primeng/menu';
import type { MenuItem } from 'primeng/api';
import { LanguageService } from '@services/language.service';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';
import { ClinicalRecordsStore } from '@core/stores/clinical-records.store';
import { BookingDialogStore } from '@core/stores/booking-dialog.store';
import type { ClinicalRecord, ClinicalRecordType } from '@models';
import { formatDateTime } from './record-format';
import { RecordFormDialogComponent } from './record-form-dialog/record-form-dialog.component';
import { RecordDetailComponent } from './record-detail/record-detail.component';

/**
 * Pestaña **Ficha** del diálogo de detalle de la reserva.
 *
 * El catálogo de tipos y los registros de la reserva se leen de los stores de
 * dominio root (`ClinicalRecordTypesStore`, `ClinicalRecordsStore`); el
 * `BookingDialogStore` (provisto por el diálogo) aporta el `booking_id`/
 * `client_id` actuales. Solo recibe `serviceLabel` del padre.
 *
 * Las fichas se leen del bucket **del paciente en curso**
 * (`ClinicalRecordsStore.recordsFor/byBooking/historyFor`): la pestaña nunca ve
 * los registros de otro paciente. La carga la dispara el diálogo con
 * `loadByClient` (una sola vez por paciente).
 */
@Component({
  selector: 'bw-ficha-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MenuModule, RecordFormDialogComponent, RecordDetailComponent],
  templateUrl: './ficha-tab.component.html',
  styleUrls: ['./ficha-tab.component.scss'],
})
export class FichaTabComponent {
  private readonly lang = inject(LanguageService);
  private readonly typesStore = inject(ClinicalRecordTypesStore);
  private readonly recordsStore = inject(ClinicalRecordsStore);
  private readonly dialogStore = inject(BookingDialogStore);

  /** Etiqueta del servicio contratado, ya formateada por el padre. */
  readonly serviceLabel = input<string>('');

  /** El usuario quiere configurar los tipos de ficha (pantalla de Configuraciones). */
  readonly configureTypes = output<void>();

  readonly bookingId = computed(() => this.dialogStore.booking()?.id ?? null);
  readonly clientId = computed(() => this.dialogStore.booking()?.client?.id ?? null);

  readonly associatedRecords = computed(() => {
    const clientId = this.clientId();
    return clientId == null ? [] : this.recordsStore.byBooking(clientId, this.bookingId());
  });
  /** Historial de consultas anteriores: fichas del paciente en otras reservas. */
  readonly history = computed(() => {
    const clientId = this.clientId();
    return clientId == null ? [] : this.recordsStore.historyFor(clientId, this.bookingId());
  });
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

  /** Ficha abierta en el detalle inline (`null` = lista). */
  readonly selectedRecord = signal<ClinicalRecord | null>(null);
  /**
   * El registro seleccionado re-leído del store: tras «Guardar cambios» el PATCH
   * reemplaza el registro y el detalle vuelve a la lectura con los valores nuevos.
   */
  readonly detailRecord = computed<ClinicalRecord | null>(() => {
    const selected = this.selectedRecord();
    if (!selected) return null;
    const clientId = this.clientId();
    if (clientId == null) return selected;
    return this.recordsStore.recordsFor(clientId).find((record) => record.id === selected.id) ?? selected;
  });

  /** «Ver más detalles»: abre el detalle inline en la misma pestaña. */
  openRecordDetail(record: ClinicalRecord): void {
    this.selectedRecord.set(record);
  }

  /** Tipo del registro en el catálogo (`null` si todavía no está cargado/activo). */
  typeForRecord(record: ClinicalRecord | null): ClinicalRecordType | null {
    if (!record) return null;
    return this.typesStore.types().find((type) => type.id === record.record_type_id) ?? null;
  }

  private openForm(type: ClinicalRecordType): void {
    this.selectedType.set(type);
    this.formVisible.set(true);
  }

  t(key: string, params?: Record<string, string>): string {
    return this.lang.t(key, params);
  }

  /** Fecha corta tipo `12/11/2026 - 10:30 am`. */
  formatWhen(iso: string): string {
    return formatDateTime(iso);
  }
}
