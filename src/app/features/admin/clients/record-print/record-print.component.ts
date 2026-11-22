import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LanguageService } from '@services/language.service';
import { AuthService } from '@services/auth.service';
import { Client, Business, ClinicalRecord, ClinicalRecordField } from '@models';
import { ClientsApiService } from '@services/api/clients-api.service';
import { ClinicalRecordsApiService } from '@services/api/clinical-records-api.service';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';
import { HttpErrorService } from '@services/http-error.service';
import { formatDate } from '@features/admin/bookings/booking-detail-dialog/tabs/ficha/record-format';

/**
 * Vista de impresión de la ficha del paciente (artboard
 * `design/ficha-imagenes-b2/03-impresion-a4.html`).
 *
 * Documento A4 de una columna: encabezado del negocio (logo, nombre, dirección,
 * teléfono), identidad del paciente, franja de quien atiende y TODAS las
 * atenciones de la historia en orden cronológico, con las imágenes del registro
 * embebidas en grilla con caption. Cada `.print-page` es una hoja A4 física
 * (`@page` + `page-break-after`), con el encabezado repetido en cada página.
 *
 * Las imágenes NO son URLs públicas: el registro trae la ruta API-relativa y el
 * blob se pide con el interceptor de auth; se renderiza como object URL.
 */
@Component({
  selector: 'bw-record-print',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule],
  templateUrl: './record-print.component.html',
  styleUrls: ['./record-print.component.scss'],
})
export class RecordPrintComponent implements OnInit {
  private readonly clientsApi = inject(ClientsApiService);
  private readonly recordsApi = inject(ClinicalRecordsApiService);
  private readonly typesStore = inject(ClinicalRecordTypesStore);
  private readonly httpError = inject(HttpErrorService);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  readonly lang = inject(LanguageService);
  private readonly auth = inject(AuthService);

  /** Id del paciente, tomado de la ruta `/admin/clients/:clientId/ficha-print`. */
  readonly clientId = computed(() => Number(this.route.snapshot.paramMap.get('clientId')));

  readonly client = signal<Client | null>(null);
  readonly records = signal<ClinicalRecord[]>([]);
  /** `record.id:key` → object URL del blob ya descargado. */
  readonly imageUrls = signal<Record<string, string>>({});
  readonly loading = signal(true);

  readonly business = computed<Business | null>(() => this.auth.me()?.business ?? null);

  /** Atenciones de la historia en orden cronológico ascendente. */
  readonly sortedRecords = computed(() =>
    [...this.records()].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  );

  /** Generación del documento para el pie: fecha y hora actuales al abrir. */
  readonly generatedAt = new Date();

  ngOnInit(): void {
    this.typesStore.load();
    this.load();
  }

  load(): void {
    const id = this.clientId();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.clientsApi.getClient(id).subscribe({
      next: (client) => this.client.set(client),
      error: (err) => this.httpError.handle(err, 'cargar el paciente'),
    });
    this.recordsApi
      .getRecords({ client_id: id })
      .subscribe({
        next: (records) => {
          this.records.set(records);
          this.loadImages(records);
          this.loading.set(false);
        },
        error: (err) => {
          this.httpError.handle(err, 'cargar la ficha');
          this.loading.set(false);
        },
      });
  }

  /** Pide el blob de cada imagen referenciada y lo registra como object URL. */
  private loadImages(records: ClinicalRecord[]): void {
    for (const record of records) {
      for (const key of Object.keys(record.images ?? {})) {
        if (!record.images?.[key]) continue;
        this.recordsApi.getImageBlob(record.id, key).subscribe({
          next: (blob) => {
            this.imageUrls.update((urls) => ({
              ...urls,
              [`${record.id}:${key}`]: URL.createObjectURL(blob),
            }));
          },
          // Imagen ausente o ilegible: la ficha se imprime sin esa foto (404
          // es «sin imagen» en el contrato); no aborta el documento.
          error: () => undefined,
        });
      }
    }
  }

  imageUrl(record: ClinicalRecord, field: ClinicalRecordField): string | null {
    return this.imageUrls()[`${record.id}:${field.key}`] ?? null;
  }

  /** Tipo de ficha del registro, ya cargado en el store raíz. */
  typeFor(record: ClinicalRecord) {
    return this.typesStore.types().find((t) => t.id === record.record_type_id) ?? null;
  }

  /** Campos no-image con valor: los que imprimen fila en la tabla. */
  valueFields(record: ClinicalRecord): ClinicalRecordField[] {
    return (this.typeFor(record)?.fields ?? [])
      .filter((f) => f.type !== 'image')
      .filter((f) => {
        const value = record.values[f.key];
        return value !== undefined && value !== null && `${value}` !== '';
      });
  }

  imageFields(record: ClinicalRecord): ClinicalRecordField[] {
    return (this.typeFor(record)?.fields ?? []).filter(
      (f) => f.type === 'image' && !!record.images?.[f.key],
    );
  }

  fieldValue(record: ClinicalRecord, field: ClinicalRecordField): string {
    const value = record.values[field.key];
    if (field.type === 'date' && typeof value === 'string') return formatDate(value);
    return value == null ? '' : String(value);
  }

  fileName(path: string | null | undefined): string {
    return (path ?? '').split('/').pop() ?? '';
  }

  goBack(): void {
    this.location.back();
  }

  print(): void {
    window.print();
  }

  recordTitle(record: ClinicalRecord): string {
    return record.title;
  }
}
