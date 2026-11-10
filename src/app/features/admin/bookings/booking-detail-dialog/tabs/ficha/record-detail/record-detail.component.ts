import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { HttpErrorResponse } from '@angular/common/http';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { LanguageService } from '@services/language.service';
import { HttpErrorService } from '@services/http-error.service';
import { ClinicalRecordsApiService } from '@services/api/clinical-records-api.service';
import { ClinicalRecordsStore } from '@core/stores/clinical-records.store';
import type {
  ClinicalRecord,
  ClinicalRecordField,
  ClinicalRecordFieldType,
  ClinicalRecordType,
} from '@models';
import { buildRecordForm, toSelectOptions } from '../record-form-fields';
import { formatDate, formatDateTime } from '../record-format';

/**
 * Formatos y tamaño que acepta `POST /clinical-records/{id}/image`
 * (jpeg | png | webp, máximo 10 MB). Se validan también en el cliente para dar
 * feedback inmediato sin gastar la subida.
 */
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Un campo de la ficha ya resuelto para pintar (lectura o edición). */
export interface RecordDetailField {
  key: string;
  label: string;
  /** `null` cuando el tipo no está en el catálogo y solo se conoce la clave. */
  type: ClinicalRecordFieldType | null;
  value: unknown;
}

/** Imagen de un campo `image` ya descargada como object URL. */
interface RecordImage {
  url: string;
  filename: string;
}

/**
 * Detalle **inline** de una ficha clínica (`design/ficha-detalle-inline/01-master-detalle.html`).
 *
 * Vive dentro de la pestaña Ficha del diálogo de reserva — nunca en un `p-dialog`
 * propio. Arranca en modo lectura (solo los campos con valor), «Editar ficha»
 * construye el mismo formulario dinámico del diálogo de captura y «Guardar
 * cambios» hace `PATCH /clinical-records/{id}` vía `ClinicalRecordsStore.update`.
 * «‹ Volver a las fichas» emite `back` y el padre vuelve a la lista.
 *
 * **Campos `image` (F10, decisión L14):** no forman parte de `values` ni del
 * submit del formulario. En lectura se piden como blob con el interceptor de
 * auth (`GET /clinical-records/{id}/image/{key}`) porque la ruta no es pública,
 * y se pintan con un object URL que se revoca al destruir. En edición se suben
 * en el momento de elegir el archivo (`store.uploadImage`). «Imprimir ficha»
 * pide el PDF al servidor (`GET /clinical-records/{id}/pdf`), que ya trae las
 * imágenes embebidas; si falla, cae a la impresión del navegador.
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
  private readonly recordsApi = inject(ClinicalRecordsApiService);
  private readonly httpError = inject(HttpErrorService);
  private readonly destroyRef = inject(DestroyRef);

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

  /** Imágenes ya descargadas, por clave de campo. */
  readonly images = signal<Record<string, RecordImage>>({});
  /** Claves cuyo blob no se pudo leer (incluye 404: la API lo trata como «sin imagen»). */
  readonly imageFailures = signal<Record<string, boolean>>({});
  /** Error inline por campo `image` (archivo demasiado grande o subida rechazada). */
  readonly imageErrors = signal<Record<string, string>>({});

  /** `accept` del input de archivo: el mismo set que valida el backend. */
  readonly acceptedImageTypes = ACCEPTED_IMAGE_TYPES.join(',');

  /** Claves ya pedidas al servidor (evita repetir el GET en cada render). */
  private readonly requestedImages = new Set<string>();
  /** Ficha a la que pertenecen las imágenes cacheadas. */
  private requestedRecordId: number | null = null;
  /** Object URLs vivos, para revocarlos al destruir el componente. */
  private readonly objectUrls = new Set<string>();

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

  /** Campos `image` del tipo: su valor lo gestiona el servidor, no `values`. */
  readonly imageFields = computed<ClinicalRecordField[]>(() =>
    this.editFields().filter((field) => field.type === 'image'),
  );

  constructor() {
    // Descarga las imágenes de la ficha cuando se conoce el registro y su tipo
    // (el catálogo puede llegar después de montar el detalle).
    effect(() => {
      const record = this.record();
      const fields = this.imageFields();
      untracked(() => this.loadImages(record, fields));
    });

    this.destroyRef.onDestroy(() => this.revokeAllImages());
  }

  enterEdit(): void {
    this.submitted.set(false);
    this.imageErrors.set({});
    this.form.set(this.buildForm());
    this.mode.set('edit');
  }

  /** «Cancelar»: descarta lo escrito y vuelve a la lectura sin guardar. */
  onCancel(): void {
    this.submitted.set(false);
    this.imageErrors.set({});
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

  /**
   * «Imprimir ficha»: pide el PDF al servidor (con las imágenes ya embebidas,
   * decisión L15) y lo abre como blob. Si la API falla, se imprime la vista.
   */
  onPrint(): void {
    this.recordsApi.getPdf(this.record().id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.objectUrls.add(url);
        window.open(url, '_blank');
        // Se revoca más tarde: la pestaña nueva necesita el URL vivo un rato.
        setTimeout(() => this.revokeImageUrl(url), 60_000);
      },
      error: () => window.print(),
    });
  }

  /** Abre la imagen ya descargada en una pestaña nueva. */
  onViewImage(field: ClinicalRecordField): void {
    const image = this.images()[field.key];
    if (!image) return;
    window.open(image.url, '_blank');
  }

  /** Descarga la imagen ya descargada con un nombre derivado del campo. */
  onDownloadImage(field: ClinicalRecordField): void {
    const image = this.images()[field.key];
    if (!image) return;

    const anchor = document.createElement('a');
    anchor.href = image.url;
    anchor.download = image.filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  /**
   * Sube la imagen de un campo `image` en el momento de elegir el archivo: no
   * pasa por «Guardar cambios» ni toca `values` (el servidor responde
   * `422 clinical_record_image_managed` si el cliente manda la clave).
   */
  onImageSelected(field: ClinicalRecordField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // Permite volver a elegir el mismo archivo (re-subir reemplaza en el server).
    input.value = '';
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      this.setImageError(field.key, this.t('ficha.detail.image_too_large'));
      return;
    }

    this.setImageError(field.key, null);
    this.recordsStore.uploadImage(this.record().id, field.key, file).subscribe({
      next: () => this.refreshImage(field.key),
      error: (err: HttpErrorResponse) => {
        // 403 al subir = la ficha no es de un paciente/reserva del usuario:
        // se avisa en neutro en vez de mostrar el error técnico.
        if (err?.status === 403) {
          this.setImageError(field.key, this.t('ficha.detail.image_forbidden'));
          return;
        }
        this.httpError.handle(err, this.t('ficha.detail.image_upload'));
      },
    });
  }

  /** Imagen lista de un campo, o `null` si no hay ruta o todavía no llegó. */
  imageFor(key: string): RecordImage | null {
    return this.images()[key] ?? null;
  }

  /** Hay una ruta de imagen y la descarga sigue en vuelo (sin fallo aún). */
  isImagePending(field: ClinicalRecordField): boolean {
    const hasPath = !!this.record().images?.[field.key];
    if (!hasPath || this.imageFailures()[field.key]) return false;
    return !this.images()[field.key];
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

  /** Pide el blob de cada campo `image` que tenga ruta y no se haya pedido. */
  private loadImages(record: ClinicalRecord, fields: ClinicalRecordField[]): void {
    // Si el detalle pasa a mostrar otra ficha, no se reusan sus imágenes.
    if (this.requestedRecordId !== record.id) {
      this.requestedRecordId = record.id;
      this.requestedImages.clear();
      this.imageFailures.set({});
      this.clearAllImages();
    }

    for (const field of fields) {
      if (!record.images?.[field.key]) continue;
      if (this.requestedImages.has(field.key)) continue;
      this.requestedImages.add(field.key);
      this.fetchImage(record.id, field.key);
    }
  }

  private fetchImage(id: number, key: string): void {
    this.recordsApi.getImageBlob(id, key).subscribe({
      next: (blob) => this.setImage(key, blob),
      // 404 = la ficha no tiene imagen visible: estado vacío, no un error.
      error: () => this.imageFailures.update((map) => ({ ...map, [key]: true })),
    });
  }

  /** Reemplaza la imagen de una clave tras una subida (el archivo cambió). */
  private refreshImage(key: string): void {
    this.clearImage(key);
    this.imageFailures.update((map) => ({ ...map, [key]: false }));
    this.requestedImages.add(key);
    this.fetchImage(this.record().id, key);
  }

  private setImage(key: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    this.objectUrls.add(url);
    this.images.update((map) => ({ ...map, [key]: { url, filename: imageFilename(key, blob.type) } }));
  }

  private clearImage(key: string): void {
    const current = this.images()[key];
    if (current) this.revokeImageUrl(current.url);
    this.images.update((map) => {
      const next = { ...map };
      delete next[key];
      return next;
    });
  }

  private revokeImageUrl(url: string): void {
    if (!this.objectUrls.delete(url)) return;
    URL.revokeObjectURL(url);
  }

  private clearAllImages(): void {
    for (const key of Object.keys(this.images())) this.clearImage(key);
  }

  private revokeAllImages(): void {
    for (const url of [...this.objectUrls]) this.revokeImageUrl(url);
  }

  private setImageError(key: string, error: string | null): void {
    this.imageErrors.update((map) => {
      const next = { ...map };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  }

  private hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim() !== '';
  }
}

/** Nombre de archivo para «Descargar»: `key.ext` según el mime del blob. */
function imageFilename(key: string, mime: string): string {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return `${key}.${ext}`;
}
