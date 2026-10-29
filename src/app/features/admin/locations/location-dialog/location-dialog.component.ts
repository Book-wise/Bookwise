import { ChangeDetectionStrategy, Component, inject, input, output, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';
import { HttpErrorService, isCapacityLimitError } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { Router } from '@angular/router';
import { ReferenceStore } from '@core/stores/reference.store';
import { Location } from '@models';

/** Requiere al menos un día laborable seleccionado (working_days no vacío). */
const nonEmptyWorkingDays = (control: AbstractControl): ValidationErrors | null =>
  Array.isArray(control.value) && control.value.length > 0 ? null : { required: true };

export type DialogMode = 'create' | 'edit' | 'view';

@Component({
  selector: 'bw-location-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, DialogModule, ButtonModule, InputTextModule,
    SelectModule, ToggleSwitchModule, DatePickerModule,
  ],
  templateUrl: './location-dialog.component.html',
  styleUrls: ['./location-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationDialogComponent {
  private httpError = inject(HttpErrorService);
  private refStore = inject(ReferenceStore);
  private messageService = inject(MessageService);
  private router = inject(Router);
  protected readonly lang = inject(LanguageService);

  /** Cuota de sucursales agotada (403 `tenant_location_limit_reached`). */
  readonly capacityError = signal(false);

  visible = input(false);
  mode = input<DialogMode>('create');
  location = input<Location | null>(null);

  closed = output<void>();
  saved = output<void>();

  /** Emitted when user clicks "Editar" in view mode to request switch to edit mode. */
  editRequested = output<void>();

  saving = signal(false);

  /** Horas tal como se mostraron al abrir el diálogo (ms epoch), para distinguir
   *  si el admin las editó. Sin edición no se envían, así un horario "sin
   *  configurar" (null) no se materializa como el default 08:00/22:00. */
  private loadedHours: { opening: number | null; closing: number | null } = { opening: null, closing: null };

  /** Internal mode allows override from view→edit via switchToEdit(). */
  private internalMode = signal<DialogMode>('create');

  /** Días de la semana (ISO 1=lunes … 7=domingo) para los checkboxes de atención. */
  readonly weekDays = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mié' },
    { value: 4, label: 'Jue' },
    { value: 5, label: 'Vie' },
    { value: 6, label: 'Sáb' },
    { value: 7, label: 'Dom' },
  ];

  form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    city: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    regionId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    comunaId: new FormControl<number | null>(null),
    codigoPostal: new FormControl('', { nonNullable: true }),
    openingTime: new FormControl<Date | null>(null),
    closingTime: new FormControl<Date | null>(null),
    workingDays: new FormControl<number[]>([1, 2, 3, 4, 5, 6], { validators: [nonEmptyWorkingDays] }),
    worksOnHolidays: new FormControl(false, { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
  });

  private regionIdChanges = toSignal(this.form.controls.regionId.valueChanges, { initialValue: null });
  private formStatus = toSignal(this.form.statusChanges, { initialValue: 'INVALID' });

  isView = computed(() => this.internalMode() === 'view');
  isCreate = computed(() => this.internalMode() === 'create');
  title = computed(() => {
    if (this.isCreate()) return 'Nueva sucursal';
    if (this.isView()) return this.location()?.name ?? '';
    return 'Editar sucursal';
  });
  saveLabel = computed(() => this.isCreate() ? 'Crear sucursal' : 'Guardar cambios');
  isFormValid = computed(() => this.formStatus() === 'VALID');

  regionOptions = computed(() => this.refStore.regions().map(r => ({ label: r.name, value: r.id })));
  comunaOptions = computed(() => {
    const rid = this.regionIdChanges();
    if (rid == null) return [];
    const comunas = this.refStore.comunasByRegion()[rid];
    return comunas ? comunas.map(c => ({ label: c.name, value: c.id })) : [];
  });

  constructor() {
    effect(() => {
      const mode = this.mode();
      const loc = this.location();
      // `visible` como dependencia: al reabrir el diálogo se limpia el CTA de
      // cuota, que pertenece a la operación anterior.
      const isOpen = this.visible();
      this.internalMode.set(mode);
      untracked(() => {
        if (isOpen) this.capacityError.set(false);
        if (loc) {
          this.form.patchValue({
            name: loc.name,
            address: loc.address,
            city: loc.city,
            regionId: loc.region_id ?? null,
            comunaId: loc.comuna_id ?? null,
            codigoPostal: loc.codigo_postal ?? '',
            openingTime: this.parseTimeToDate(loc.opening_time ?? loc.effective_opening_time),
            closingTime: this.parseTimeToDate(loc.closing_time ?? loc.effective_closing_time),
            workingDays: loc.working_days ?? [1, 2, 3, 4, 5, 6],
            worksOnHolidays: loc.works_on_holidays ?? false,
            active: loc.active,
          });
        } else {
          this.form.reset({
            name: '',
            address: '',
            city: '',
            regionId: null,
            comunaId: null,
            codigoPostal: '',
            openingTime: null,
            closingTime: null,
            workingDays: [1, 2, 3, 4, 5, 6],
            worksOnHolidays: false,
            active: true,
          });
        }
        this.loadedHours = {
          opening: this.form.controls.openingTime.value?.getTime() ?? null,
          closing: this.form.controls.closingTime.value?.getTime() ?? null,
        };
        // Apply disabled state AFTER populating
        if (mode === 'view') {
          this.form.disable();
        } else {
          this.form.enable();
        }
      });
    });
  }

  /** Convert "HH:mm" or "HH:mm:ss" string to Date for the time picker */
  private parseTimeToDate(time: string | null | undefined): Date | null {
    if (!time) return null;
    const parts = time.split(':');
    if (parts.length < 2) return null;
    const d = new Date(0);
    d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    return d;
  }

  /** Format Date to "HH:mm:ss", or explicit null to clear the configured hours. */
  private formatTimeOrNull(date: Date | null): string | null {
    if (!date) return null;
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}:00`;
  }

  onRegionChange(): void {
    this.form.controls.comunaId.setValue(null);
  }

  onCodigoPostalInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '');
    if (sanitized !== input.value) {
      this.form.controls.codigoPostal.setValue(sanitized, { emitEvent: false });
    }
  }

  hasWorkingDay(day: number): boolean {
    return (this.form.controls.workingDays.value ?? []).includes(day);
  }

  toggleWorkingDay(day: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.form.controls.workingDays.value ?? [];
    const next = checked
      ? [...current, day].sort((a, b) => a - b)
      : current.filter((d) => d !== day);
    this.form.controls.workingDays.setValue(next);
  }

  switchToEdit(): void {
    this.editRequested.emit();
  }

  onSave(): void {
    if (!this.isFormValid() || this.saving()) return;

    const raw = this.form.getRawValue();
    const payload: Partial<Location> = {
      name: raw.name!.trim(),
      address: raw.address!.trim(),
      city: raw.city!.trim(),
      region_id: raw.regionId!,
      comuna_id: raw.comunaId ?? undefined,
      codigo_postal: raw.codigoPostal?.trim() || undefined,
      working_days: raw.workingDays ?? [],
      works_on_holidays: raw.worksOnHolidays,
      active: raw.active!,
    };
    // Solo se envían las horas que el admin editó: un horario "sin configurar"
    // (null, prellenado con effective_*) no debe materializarse como default.
    const openingEdited =
      (raw.openingTime?.getTime() ?? null) !== this.loadedHours.opening;
    const closingEdited =
      (raw.closingTime?.getTime() ?? null) !== this.loadedHours.closing;
    if (openingEdited) payload.opening_time = this.formatTimeOrNull(raw.openingTime);
    if (closingEdited) payload.closing_time = this.formatTimeOrNull(raw.closingTime);

    this.saving.set(true);
    // Mutación vía store: createLocation (append) / updateLocation (merge
    // canónico) patchan refStore.locations con la respuesta del server; el
    // dialog NO llama locationsApi para mutar (U6).
    const obs = this.isCreate()
      ? this.refStore.createLocation(payload)
      : this.refStore.updateLocation(this.location()!.id, payload);

    obs.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.capacityError.set(false);
        this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        // 403 `tenant_location_limit_reached`: cupo del plan agotado. Se muestra
        // CTA de upgrade en vez del toast genérico.
        if (isCapacityLimitError(err)) {
          this.capacityError.set(true);
          return;
        }
        this.httpError.handle(err, 'guardar sucursal');
      },
    });
  }

  onClose(): void {
    this.closed.emit();
  }

  goToBilling(): void {
    this.router.navigate(['/admin/facturacion']);
  }
}
