import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ClientsStore } from '@core/stores/clients.store';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { isValidRut } from '@shared/validators/rut.validator';
import { Client } from '@models';

/**
 * Alta y edición de cliente de "Base de Pacientes". Con `client = null` es alta;
 * con un `Client` es edición (mismo form, precargado). El RUT se valida en el
 * front con `isValidRut` (módulo 11) y el backend vuelve a validarlo con
 * `ChileanRutRule` (único por tenant).
 */
@Component({
  selector: 'bw-client-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, InputTextModule],
  templateUrl: './client-form-dialog.component.html',
  styleUrl: './client-form-dialog.component.scss',
})
export class ClientFormDialogComponent {
  private readonly clientsStore = inject(ClientsStore);
  private readonly httpError = inject(HttpErrorService);
  protected readonly lang = inject(LanguageService);

  readonly visible = input<boolean>(false);
  /** null = alta; Client = edición. */
  readonly client = input<Client | null>(null);

  readonly closed = output<void>();
  readonly saved = output<Client>();

  readonly mode = computed<'create' | 'edit'>(() => (this.client() ? 'edit' : 'create'));

  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly rut = signal('');
  readonly gender = signal('');
  readonly birthDate = signal('');
  readonly saving = signal(false);

  readonly rutInvalid = computed(() => this.rut().trim().length > 0 && !isValidRut(this.rut()));

  readonly canSave = computed(
    () =>
      this.firstName().trim().length > 0 &&
      this.lastName().trim().length > 0 &&
      this.email().trim().length > 0 &&
      !this.rutInvalid() &&
      !this.saving(),
  );

  constructor() {
    // Precarga (o limpia) el form cada vez que se abre.
    effect(() => {
      const c = this.client();
      if (!this.visible()) return;
      this.firstName.set(c?.first_name ?? '');
      this.lastName.set(c?.last_name ?? '');
      this.email.set(c?.email ?? '');
      this.phone.set(c?.phone ?? '');
      this.rut.set(c?.rut ?? '');
      this.gender.set(c?.gender ?? '');
      this.birthDate.set(c?.birth_date ?? '');
      this.saving.set(false);
    });
  }

  save(): void {
    if (!this.canSave()) return;
    const editing = this.client();
    const payload: Partial<Client> = {
      first_name: this.firstName().trim(),
      last_name: this.lastName().trim(),
      email: this.email().trim(),
      phone: this.phone().trim() || null,
      rut: this.rut().trim() || null,
      gender: this.gender().trim() || null,
      birth_date: this.birthDate().trim() || null,
    };

    this.saving.set(true);
    const request$ = editing
      ? this.clientsStore.update(editing.id, payload)
      : this.clientsStore.create(payload);

    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.saved.emit(res);
      },
      error: (err) => {
        this.saving.set(false);
        this.httpError.handle(err, editing ? 'editar cliente' : 'crear cliente');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
