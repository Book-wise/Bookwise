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
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { ServicesApiService } from '@services/api/services-api.service';
import type {
  CreateServicePayload,
  Service,
  ServiceStatus,
  ServiceVariation,
  ServiceVariationInput,
} from '@models';

export type ServiceDialogMode = 'create' | 'edit';

/**
 * Etiqueta de término sugerida a partir de la cantidad de sesiones.
 * Es una SUGERENCIA, no una imposición: el usuario puede escribir otra.
 * Grafía canónica del negocio (producción Woo): «1 sesion» (sin tilde, singular)
 * y «{n} sesiones» para n > 1.
 */
export function suggestTermForSessions(totalSessions: number): string {
  if (!Number.isFinite(totalSessions) || totalSessions < 1) return '';
  return totalSessions === 1 ? '1 sesion' : `${totalSessions} sesiones`;
}

/** `duration_minutes` 5–480 (contrato). */
const durationRange: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return n >= 5 && n <= 480 ? null : { durationRange: true };
};

/** `slot_interval_minutes` 5–120 (si viene). */
const slotRange: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return n >= 5 && n <= 120 ? null : { slotRange: true };
};

/** `price` ≥ 0. */
const nonNegative: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  return Number(value) >= 0 ? null : { nonNegative: true };
};

/** `total_sessions` entero ≥ 1. */
const sessionsInteger: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? null : { sessionsInvalid: true };
};

/** `compare_at_price` (si viene) debe ser > `price`. Evita el 422 `pack_discount_invalid`. */
const compareAtGreaterThanPrice: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const price = group.get('price')?.value;
  const compareAt = group.get('compareAtPrice')?.value;
  if (compareAt === null || compareAt === undefined || compareAt === '') return null;
  if (price === null || price === undefined || price === '') return null;
  return Number(compareAt) > Number(price) ? null : { compareAtInvalid: true };
};

interface VariationFormValue {
  id?: number | null;
  term: string;
  totalSessions: number | null;
  price: number | null;
  compareAtPrice?: number | null;
  sku?: string;
  active: boolean;
}

@Component({
  selector: 'bw-service-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
  ],
  templateUrl: './service-form-dialog.component.html',
  styleUrls: ['./service-form-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceFormDialogComponent {
  private readonly servicesApi = inject(ServicesApiService);
  private readonly httpError = inject(HttpErrorService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly lang = inject(LanguageService);

  visible = input(false);
  mode = input<ServiceDialogMode>('create');
  service = input<Service | null>(null);

  closed = output<void>();
  saved = output<void>();

  readonly saving = signal(false);
  /** Edición abierta con un servicio de lista que no trae `variations`: se pide el detalle. */
  readonly loadingService = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly imageError = signal<string | null>(null);

  private readonly ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(120)],
    }),
    description: new FormControl('', { nonNullable: true }),
    durationMinutes: new FormControl<number | null>(null, {
      validators: [Validators.required, durationRange],
    }),
    price: new FormControl<number | null>(null, {
      validators: [Validators.required, nonNegative],
    }),
    slotIntervalMinutes: new FormControl<number | null>(null, {
      validators: [slotRange],
    }),
    status: new FormControl<ServiceStatus>('active', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    variations: new FormArray<FormGroup>([]),
  });

  private formValue = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  private formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  readonly isCreate = computed(() => this.mode() === 'create');
  readonly isFormValid = computed(() => this.formStatus() === 'VALID');
  readonly title = computed(() =>
    this.lang.t(this.isCreate() ? 'packs.form.title_create' : 'packs.form.title_edit'),
  );
  readonly saveLabel = computed(() => this.lang.t('packs.form.save'));
  readonly activeState = computed(() => this.formValue()?.status === 'active');

  readonly imageThumbUrl = computed(() => {
    const service = this.service();
    return service?.image_thumb_url ?? service?.image_url ?? null;
  });

  readonly statusOptions = computed<{ label: string; value: ServiceStatus }[]>(() => {
    if (this.isCreate()) {
      return [
        { label: this.lang.t('packs.form.status.draft'), value: 'draft' },
        { label: this.lang.t('packs.form.status.active'), value: 'active' },
      ];
    }
    const current = this.currentStatus();
    if (current === 'draft') {
      return [
        { label: this.lang.t('packs.form.status.draft'), value: 'draft' },
        { label: this.lang.t('packs.form.status.active'), value: 'active' },
      ];
    }
    if (current === 'inactive') {
      return [
        { label: this.lang.t('packs.form.status.inactive'), value: 'inactive' },
        { label: this.lang.t('packs.form.status.active'), value: 'active' },
      ];
    }
    return [
      { label: this.lang.t('packs.form.status.active'), value: 'active' },
      { label: this.lang.t('packs.form.status.inactive'), value: 'inactive' },
    ];
  });

  readonly statusHint = computed(() => {
    if (this.isCreate()) return this.lang.t('packs.form.status.create_hint');
    const current = this.currentStatus();
    if (current === 'draft') return this.lang.t('packs.form.status.draft_hint');
    if (current === 'active') return this.lang.t('packs.form.status.active_hint');
    return this.lang.t('packs.form.status.inactive_hint');
  });

  get variations(): FormArray<FormGroup> {
    return this.form.controls.variations;
  }

  constructor() {
    effect(() => {
      const visible = this.visible();
      const mode = this.mode();
      const service = this.service();
      if (!visible) return;

      untracked(() => {
        this.saving.set(false);
        this.loadingService.set(false);
        this.selectedFile.set(null);
        this.imageError.set(null);

        if (mode === 'create' || !service) {
          this.populateCreate();
          return;
        }

        this.populateEdit(service);
        // La lista trae los datos básicos pero no siempre `variations`:
        // se pide el detalle para poder sincronizar los `id` al guardar.
        if (!service.variations) {
          const requestedId = service.id;
          this.loadingService.set(true);
          this.servicesApi
            .getService(requestedId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (full) => {
                // Respuesta de una apertura anterior: no pisar el formulario actual.
                if (this.service()?.id !== requestedId) return;
                this.loadingService.set(false);
                this.populateEdit(full);
              },
              error: (err) => {
                if (this.service()?.id !== requestedId) return;
                this.loadingService.set(false);
                this.httpError.handle(err, 'cargar servicio');
              },
            });
        }
      });
    });
  }

  private currentStatus(): ServiceStatus {
    const service = this.service();
    if (!service) return 'active';
    return this.resolveStatus(service);
  }

  private resolveStatus(service: Service): ServiceStatus {
    return service.status ?? (service.active ? 'active' : 'inactive');
  }

  private populateCreate(): void {
    this.form.reset({
      name: '',
      description: '',
      durationMinutes: null,
      price: null,
      slotIntervalMinutes: null,
      status: 'active',
    });
    this.replaceVariations([]);
  }

  private populateEdit(service: Service): void {
    this.form.reset({
      name: service.name ?? '',
      description: service.description ?? '',
      durationMinutes: service.duration_minutes ?? null,
      price: this.toNumber(service.price),
      slotIntervalMinutes: service.slot_interval_minutes ?? null,
      status: this.resolveStatus(service),
    });
    this.replaceVariations(service.variations ?? []);
  }

  private replaceVariations(variations: ServiceVariation[]): void {
    this.variations.clear();
    for (const variation of variations) {
      this.variations.push(this.buildVariationGroup(variation));
    }
  }

  private buildVariationGroup(variation?: ServiceVariation): FormGroup {
    return new FormGroup(
      {
        id: new FormControl<number | null>(variation?.id ?? null),
        term: new FormControl(variation?.term ?? '', {
          nonNullable: true,
          validators: [Validators.required],
        }),
        totalSessions: new FormControl<number | null>(
          variation ? variation.total_sessions : null,
          { validators: [Validators.required, sessionsInteger] },
        ),
        price: new FormControl<number | null>(variation ? this.toNumber(variation.price) : null, {
          validators: [Validators.required, nonNegative],
        }),
        compareAtPrice: new FormControl<number | null>(
          variation?.compare_at_price != null ? this.toNumber(variation.compare_at_price) : null,
        ),
        sku: new FormControl(variation?.sku ?? '', { nonNullable: true }),
        active: new FormControl(variation?.active ?? true, { nonNullable: true }),
      },
      { validators: [compareAtGreaterThanPrice] },
    );
  }

  private toNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  // ── Variaciones ───────────────────────────────────────────────────────────
  addVariation(): void {
    this.variations.push(this.buildVariationGroup());
  }

  removeVariation(index: number): void {
    const group = this.variations.at(index);
    const id = group.get('id')?.value;
    // Confirmación solo cuando el término ya existe en el backend (se eliminará al guardar).
    if (id != null && !window.confirm(this.lang.t('packs.form.remove_confirm'))) {
      return;
    }
    this.variations.removeAt(index);
  }

  applyTermSuggestion(index: number): void {
    const group = this.variations.at(index);
    const sessions = group.get('totalSessions')?.value;
    const term = suggestTermForSessions(Number(sessions));
    if (!term) return;
    group.get('term')?.setValue(term);
    group.get('term')?.markAsTouched();
  }

  variationPerSession(index: number): number {
    const rows = (this.formValue() as { variations?: VariationFormValue[] }).variations;
    const row = rows?.[index];
    if (!row) return 0;
    const sessions = Number(row.totalSessions);
    if (!Number.isFinite(sessions) || sessions <= 0) return 0;
    return Number(row.price ?? 0) / sessions;
  }

  variationDiscount(index: number): number | null {
    const rows = (this.formValue() as { variations?: VariationFormValue[] }).variations;
    const row = rows?.[index];
    if (!row) return null;
    const price = Number(row.price);
    const compareAt = Number(row.compareAtPrice);
    if (!Number.isFinite(price) || price <= 0) return null;
    if (!Number.isFinite(compareAt) || compareAt <= 0) return null;
    if (compareAt <= price) return null;
    return Math.round((1 - price / compareAt) * 100);
  }

  formatClp(value: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    })
      .format(Math.round(value))
      .replace(/\s/g, '');
  }

  // ── Validación visible ────────────────────────────────────────────────────
  fieldError(control: AbstractControl | null): string | null {
    if (!control || !control.invalid || (!control.touched && !control.dirty)) return null;
    const errors = control.errors;
    if (!errors) return null;
    if (errors['required']) return this.lang.t('packs.form.error.required');
    if (errors['minlength'] || errors['maxlength']) return this.lang.t('packs.form.error.name_length');
    if (errors['durationRange']) return this.lang.t('packs.form.error.duration_range');
    if (errors['slotRange']) return this.lang.t('packs.form.error.slot_range');
    if (errors['nonNegative']) return this.lang.t('packs.form.error.price_negative');
    if (errors['sessionsInvalid']) return this.lang.t('packs.form.error.sessions_invalid');
    return null;
  }

  compareAtError(index: number): string | null {
    const group = this.variations.at(index);
    if (!group.errors?.['compareAtInvalid']) return null;
    return this.lang.t('packs.form.error.compare_at_price');
  }

  // ── Imagen ────────────────────────────────────────────────────────────────
  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const typeOk =
      this.ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!typeOk) {
      this.selectedFile.set(null);
      this.imageError.set(this.lang.t('packs.form.image.error_type'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.selectedFile.set(null);
      this.imageError.set(this.lang.t('packs.form.image.error_size'));
      return;
    }
    this.imageError.set(null);
    this.selectedFile.set(file);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  onSave(): void {
    if (!this.isFormValid() || this.saving() || this.loadingService()) return;

    const payload = this.buildPayload();
    this.saving.set(true);

    if (this.isCreate()) {
      this.servicesApi.createService(payload).subscribe({
        next: () => this.completeSave('packs.form.created'),
        error: (err: HttpErrorResponse) => this.failSave(err),
      });
      return;
    }

    const service = this.service();
    if (!service) {
      this.saving.set(false);
      return;
    }
    this.servicesApi.updateService(service.id, payload).subscribe({
      next: () => this.afterUpdate(service.id),
      error: (err: HttpErrorResponse) => this.failSave(err),
    });
  }

  private buildPayload(): CreateServicePayload {
    const raw = this.form.getRawValue() as {
      name: string;
      description: string;
      durationMinutes: number | null;
      price: number | null;
      slotIntervalMinutes: number | null;
      status: ServiceStatus;
    };
    return {
      name: raw.name.trim(),
      description: raw.description?.trim() || undefined,
      duration_minutes: Number(raw.durationMinutes),
      price: Number(raw.price),
      slot_interval_minutes:
        raw.slotIntervalMinutes != null ? Number(raw.slotIntervalMinutes) : undefined,
      status: raw.status,
      // `active` es el espejo del estado en el backend: se deriva para no enviar
      // un par contradictorio (p. ej. status=draft + active=true).
      active: raw.status === 'active',
      variations: this.variations.controls.map((group) => this.variationPayload(group)),
    };
  }

  private variationPayload(group: FormGroup): ServiceVariationInput {
    const raw = group.getRawValue() as VariationFormValue;
    const payload: ServiceVariationInput = {
      term: (raw.term ?? '').trim(),
      total_sessions: Number(raw.totalSessions),
      price: Number(raw.price),
      compare_at_price: raw.compareAtPrice != null ? Number(raw.compareAtPrice) : null,
      sku: raw.sku?.trim() ? raw.sku.trim() : null,
      active: raw.active ?? true,
    };
    // Sync por id (contrato): solo en edición se mandan los ids existentes; las
    // ausentes se soft-deletean. En create ninguna variación lleva id.
    if (!this.isCreate() && raw.id != null) {
      payload.id = raw.id;
    }
    return payload;
  }

  private afterUpdate(id: number): void {
    const file = this.selectedFile();
    if (!file) {
      this.completeSave('packs.form.saved');
      return;
    }
    this.servicesApi.uploadServiceImage(id, file).subscribe({
      next: () => this.completeSave('packs.form.saved_image'),
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.httpError.handle(err, 'subir imagen');
        // Los datos ya se guardaron: se cierra igual para que el padre refresque.
        this.saved.emit();
      },
    });
  }

  private completeSave(messageKey: string): void {
    this.saving.set(false);
    this.messageService.add({ severity: 'success', summary: this.lang.t(messageKey), key: 'global' });
    this.saved.emit();
  }

  private failSave(err: HttpErrorResponse): void {
    this.saving.set(false);
    this.httpError.handle(err, 'guardar servicio');
  }

  onClose(): void {
    this.closed.emit();
  }
}
