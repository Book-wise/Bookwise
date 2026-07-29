import { ChangeDetectionStrategy, Component, inject, input, output, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';
import { LocationsApiService } from '@services/api/locations-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Location } from '@models';

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
  private locationsApi = inject(LocationsApiService);
  private httpError = inject(HttpErrorService);
  private refStore = inject(ReferenceStore);
  private messageService = inject(MessageService);

  visible = input(false);
  mode = input<DialogMode>('create');
  location = input<Location | null>(null);

  closed = output<void>();
  saved = output<void>();

  /** Emitted when user clicks "Editar" in view mode to request switch to edit mode. */
  editRequested = output<void>();

  saving = signal(false);

  /** Internal mode allows override from view→edit via switchToEdit(). */
  private internalMode = signal<DialogMode>('create');

  form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    city: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    regionId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    comunaId: new FormControl<number | null>(null),
    codigoPostal: new FormControl('', { nonNullable: true }),
    openingTime: new FormControl<Date | null>(null),
    closingTime: new FormControl<Date | null>(null),
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
      this.internalMode.set(mode);
      untracked(() => {
        if (loc) {
          this.form.patchValue({
            name: loc.name,
            address: loc.address,
            city: loc.city,
            regionId: loc.region_id ?? null,
            comunaId: loc.comuna_id ?? null,
            codigoPostal: loc.codigo_postal ?? '',
            openingTime: this.parseTimeToDate(loc.opening_time),
            closingTime: this.parseTimeToDate(loc.closing_time),
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
            active: true,
          });
        }
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

  /** Format Date to "HH:mm:ss" string for the API */
  private formatTimeToString(date: Date | null): string | undefined {
    if (!date) return undefined;
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
      opening_time: this.formatTimeToString(raw.openingTime),
      closing_time: this.formatTimeToString(raw.closingTime),
      active: raw.active!,
    };

    this.saving.set(true);
    const obs = this.isCreate()
      ? this.locationsApi.createLocation(payload)
      : this.locationsApi.updateLocation(this.location()!.id, payload);

    obs.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.httpError.handle(err, 'guardar sucursal');
      },
    });
  }

  onClose(): void {
    this.closed.emit();
  }
}
