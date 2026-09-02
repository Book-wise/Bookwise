import { ChangeDetectionStrategy, Component, inject, input, output, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Provider, Role } from '@models';
import { roleMeta } from '../../roles/role-meta';
import { applyAdminGeneralInvariant, isAdminGeneralLocked } from '../../roles/role-guards';

export type DialogMode = 'create' | 'edit' | 'view';

interface RoleOption {
  label: string;
  value: string;
  /** P-multiselect disables per option via a property name (optionDisabled="disabled"). */
  disabled: boolean;
}

/**
 * Roles multiselect rule: when editing, the provider must keep at least one
 * role. In view mode the control is disabled (form.disable()) and therefore
 * excluded from form validity; in create mode the roles section does not
 * exist, so the empty default must not invalidate the form.
 */
function rolesRequiredWhenEditing(mode: () => DialogMode): ValidatorFn {
  return (control: AbstractControl): { rolesRequired: true } | null => {
    if (mode() === 'create') return null;
    const value = control.value as string[] | null;
    return value && value.length > 0 ? null : { rolesRequired: true };
  };
}

@Component({
  selector: 'bw-provider-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, DialogModule, ButtonModule, InputTextModule,
    SelectModule, ToggleSwitchModule, MultiSelectModule, TooltipModule,
  ],
  templateUrl: './provider-dialog.component.html',
  styleUrls: ['./provider-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderDialogComponent {
  private httpError = inject(HttpErrorService);
  private refStore = inject(ReferenceStore);
  private messageService = inject(MessageService);
  protected readonly lang = inject(LanguageService);

  /** Resuelve color/icono de un rol (fallback gris + pi-user). */
  protected readonly roleMeta = roleMeta;

  visible = input(false);
  mode = input<DialogMode>('create');
  provider = input<Provider | null>(null);

  /** Catálogo de roles de negocio (opciones del multiselect), provisto por el padre. */
  catalogRoles = input<Role[]>([]);

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
    roleNames: new FormControl<string[]>([], {
      nonNullable: true,
      validators: [rolesRequiredWhenEditing(() => this.internalMode())],
    }),
  });

  private formStatus = toSignal(this.form.statusChanges, { initialValue: 'INVALID' });

  isView = computed(() => this.internalMode() === 'view');
  isCreate = computed(() => this.internalMode() === 'create');

  /** Roles actuales del provider editado (desde el input, holder de admin_general). */
  private currentRoleNames(): string[] {
    return (this.provider()?.roles ?? []).map((r) => r.name);
  }

  /** Roles del catálogo mapeados a opciones `{ label, value }` para el p-multiselect. */
  readonly roleOptions = computed<RoleOption[]>(() =>
    this.catalogRoles().map((r) => ({
      label: this.roleLabel(r.name),
      value: r.name,
      disabled: this.roleIsLocked(r.name),
    })),
  );

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

  /**
   * Error visible de roles vacíos: solo en edición (create no tiene sección de
   * roles y view queda excluido por `form.disable()`). Lee `formStatus` (señal)
   * para invalidar el caché del computed cuando el set pasa a vacío o vuelve a
   * tener un rol — los flags dirty/touched del control no son fiables con los
   * value-setters de Angular v21 (markAsDirty diferido).
   */
  readonly showRolesEmptyError = computed(() => {
    if (this.isCreate() || this.isView()) return false;
    void this.formStatus();
    return (this.form.controls.roleNames.value ?? []).length === 0;
  });

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
        const roleNames = prov ? (prov.roles ?? []).map((r) => r.name) : [];
        if (prov) {
          this.form.patchValue({
            firstName: prov.first_name,
            lastName: prov.last_name,
            email: prov.email,
            phone: prov.phone ?? '',
            locationId: prov.location?.id ?? null,
            active: prov.active,
            roleNames,
          });
        } else {
          this.form.reset({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            locationId: null,
            active: true,
            roleNames: [],
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

  roleLabel(name: string): string {
    const key = `roles.role.${name}`;
    return this.lang.has(key) ? this.lang.t(key) : name;
  }

  /** Regla compartida (role-guards): admin_general no puede removerse ni asignarse. */
  private roleIsLocked(name: string): boolean {
    return isAdminGeneralLocked(this.currentRoleNames(), name);
  }

  isRoleOptionLocked(option: RoleOption): boolean {
    return option.disabled;
  }

  /** Sanitizador del multiselect: re-aplica la invariante de admin_general. */
  onRolesChange(): void {
    const control = this.form.controls.roleNames;
    const sanitized = applyAdminGeneralInvariant(this.currentRoleNames(), control.value);
    if (!this.sameRoleSet(sanitized, control.value)) {
      control.setValue(sanitized);
    }
  }

  private sameRoleSet(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((name) => b.includes(name));
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

    if (this.isCreate()) {
      this.saveCreate(payload);
      return;
    }
    this.saveEdit(payload, raw.roleNames ?? []);
  }

  /** Create: un solo POST vía store (append con la respuesta del server). */
  private saveCreate(payload: Record<string, any>): void {
    this.saving.set(true);
    this.refStore.createProvider(payload).subscribe({
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

  /**
   * Edit: guardado secuencial vía store — básicos primero (PATCH) y, recién si
   * responde OK, roles (PATCH roles). Un fallo de básicos aborta antes de tocar
   * roles; un fallo de roles muestra toast específico y NO emite saved (el
   * dialog queda abierto; el PATCH de básicos es idempotente → reintento seguro).
   */
  private saveEdit(payload: Record<string, any>, rawRoleNames: string[]): void {
    const provider = this.provider();
    if (!provider) return;

    const roleNames = applyAdminGeneralInvariant(this.currentRoleNames(), rawRoleNames);

    this.saving.set(true);
    this.refStore.saveProviderBasics(provider.id, payload).subscribe({
      next: (res) => {
        this.refStore.assignProviderRoles(provider.id, roleNames).subscribe({
          next: () => {
            this.saving.set(false);
            this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
            this.saved.emit();
          },
          error: () => {
            this.saving.set(false);
            this.messageService.add({
              severity: 'error',
              summary: this.lang.t('providers.save_roles_failed'),
              key: 'global',
            });
          },
        });
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
