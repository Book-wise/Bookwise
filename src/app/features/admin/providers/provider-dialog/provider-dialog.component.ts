import { ChangeDetectionStrategy, Component, inject, input, output, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Provider } from '@models';

export type DialogMode = 'create' | 'edit' | 'view';

@Component({
  selector: 'bw-provider-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, DialogModule, ButtonModule, InputTextModule,
    SelectModule, ToggleSwitchModule,
  ],
  templateUrl: './provider-dialog.component.html',
  styleUrls: ['./provider-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderDialogComponent {
  private api = inject(ApiService);
  private httpError = inject(HttpErrorService);
  private refStore = inject(ReferenceStore);
  private messageService = inject(MessageService);

  visible = input(false);
  mode = input<DialogMode>('create');
  provider = input<Provider | null>(null);

  closed = output<void>();
  saved = output<void>();

  /** Emitted when user clicks "Editar" in view mode to request switch to edit mode. */
  editRequested = output<void>();

  saving = signal(false);

  /** Internal mode allows override from view→edit via switchToEdit(). */
  private internalMode = signal<DialogMode>('create');

  form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true }),
    locationId: new FormControl<number | null>(null),
    active: new FormControl(true, { nonNullable: true }),
  });

  private formStatus = toSignal(this.form.statusChanges, { initialValue: 'INVALID' });

  isView = computed(() => this.internalMode() === 'view');
  isCreate = computed(() => this.internalMode() === 'create');
  title = computed(() => {
    if (this.isCreate()) return 'Nuevo profesional';
    if (this.isView()) {
      const p = this.provider();
      return p ? `${p.first_name} ${p.last_name}` : '';
    }
    return 'Editar profesional';
  });
  saveLabel = computed(() => (this.isCreate() ? 'Crear profesional' : 'Guardar cambios'));
  isFormValid = computed(() => this.formStatus() === 'VALID');

  locationOptions = computed(() =>
    this.refStore
      .locations()
      .filter((l) => l.active)
      .map((l) => ({ label: l.name, value: l.id }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  constructor() {
    effect(() => {
      const mode = this.mode();
      const prov = this.provider();
      this.internalMode.set(mode);
      untracked(() => {
        if (prov) {
          this.form.patchValue({
            firstName: prov.first_name,
            lastName: prov.last_name,
            email: prov.email,
            phone: prov.phone ?? '',
            locationId: prov.location?.id ?? null,
            active: prov.active,
          });
        } else {
          this.form.reset({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            locationId: null,
            active: true,
          });
        }
        if (mode === 'view') {
          this.form.disable();
        } else {
          this.form.enable();
        }
      });
    });
  }

  switchToEdit(): void {
    this.editRequested.emit();
  }

  onSave(): void {
    if (!this.isFormValid() || this.saving()) return;

    const raw = this.form.getRawValue();
    const payload: Record<string, any> = {
      first_name: raw.firstName!.trim(),
      last_name: raw.lastName!.trim(),
      email: raw.email!.trim(),
      phone: raw.phone?.trim() || null,
      active: raw.active!,
    };
    if (raw.locationId != null) {
      payload['location_id'] = raw.locationId;
    }

    this.saving.set(true);
    const obs = this.isCreate()
      ? this.api.createProvider(payload)
      : this.api.updateProvider(this.provider()!.id, payload);

    obs.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.httpError.handle(err, 'guardar profesional');
      },
    });
  }

  onClose(): void {
    this.closed.emit();
  }
}
