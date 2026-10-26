import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { RadioButtonModule } from 'primeng/radiobutton';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { MessageService } from 'primeng/api';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { AccountsApiService } from '@services/api/accounts-api.service';
import { SiiActivitiesApiService } from '@services/api/sii-activities-api.service';
import { LocationsApiService } from '@services/api/locations-api.service';
import {
  AccountSummary,
  LocationComuna,
  Region,
  SiiActivity,
  TaxpayerType,
  UpdateAccountBillingData,
} from '@models';
import { rutValidator } from '@shared/validators/rut.validator';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';

/**
 * "Datos de facturación" (`/admin/facturacion/datos`): perfil fiscal de la
 * **cuenta** (no del negocio), el pagador de la suscripción.
 *
 * Contrato: `Bookwise-API/docs/api/billing-frontend.md` §9. Todos los campos son
 * nullable — una cuenta nace sin perfil fiscal, así que el formulario se trata
 * como "incompleto" y nunca exige completarlo para guardar.
 *
 * Solo `owner`/`billing` con membership activa pueden editar; el resto ve el
 * formulario deshabilitado.
 */
@Component({
  selector: 'bw-billing-data',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    RadioButtonModule,
    AutoCompleteModule,
    PhoneInputComponent,
  ],
  templateUrl: './billing-data.component.html',
  styleUrls: ['./billing-data.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingDataComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly accountsApi = inject(AccountsApiService);
  private readonly siiApi = inject(SiiActivitiesApiService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly lang = inject(LanguageService);

  readonly saving = signal(false);
  readonly regions = signal<Region[]>([]);
  readonly comunas = signal<LocationComuna[]>([]);
  readonly giroSuggestions = signal<SiiActivity[]>([]);

  /** Cuenta activa: la resuelve el backend con `current_account_id`. */
  readonly account = computed<AccountSummary | null>(() => {
    const me = this.auth.me();
    const accounts = me?.accounts ?? [];
    if (!accounts.length) return null;

    const id = me?.current_account_id ?? null;
    const active = id == null ? undefined : accounts.find((a) => a.id === id);
    if (active) return active;

    // Sin `current_account_id` solo hay una respuesta segura cuando el usuario
    // tiene una única cuenta: con varias no se adivina (se escribiría el perfil
    // fiscal de una cuenta ajena).
    return accounts.length === 1 ? accounts[0] : null;
  });

  /** Solo dueño o rol de facturación, con membership activa, editan. */
  readonly canEdit = computed(() => {
    const account = this.account();
    if (!account || account.membership_status !== 'active') return false;
    return account.role === 'owner' || account.role === 'billing';
  });

  readonly taxpayerOptions: Array<{ labelKey: string; value: TaxpayerType }> = [
    { labelKey: 'billing.data.taxpayer.company', value: 'company' },
    { labelKey: 'billing.data.taxpayer.individual', value: 'individual' },
  ];

  readonly form = this.fb.group({
    taxpayer_type: this.fb.control<TaxpayerType | null>(null),
    rut: this.fb.control('', { validators: [rutValidator(), Validators.maxLength(20)] }),
    legal_name: this.fb.control('', { validators: [Validators.maxLength(255)] }),
    // El select/autocomplete trabaja con el objeto; el payload manda solo el id.
    sii_activity: this.fb.control<SiiActivity | null>(null),
    billing_address: this.fb.control('', { validators: [Validators.maxLength(255)] }),
    billing_region_id: this.fb.control<number | null>(null),
    billing_comuna_id: this.fb.control<number | null>(null),
    billing_phone: this.fb.control(''),
    billing_email: this.fb.control('', { validators: [Validators.email, Validators.maxLength(255)] }),
  });

  constructor() {
    // El formulario se habilita/deshabilita según el rol de cuenta. Se hace acá
    // (no con `disabled` en el template) para no romper el binding de FormGroup.
    effect(() => {
      const canEdit = this.canEdit();
      if (canEdit) this.form.enable({ emitEvent: false });
      else this.form.disable({ emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.form.controls.billing_region_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((regionId) => {
        // Cambiar de región invalida la comuna: se limpia y se recargan las de
        // la región nueva. Ambas viajan en el mismo PATCH.
        this.form.controls.billing_comuna_id.setValue(null, { emitEvent: false });
        this.loadComunas(regionId);
      });

    this.loadRegions();
    this.seed();
  }

  /** Busca giros contra el catálogo SII (server-side, 700 códigos). */
  searchGiro(event: { query: string }): void {
    this.siiApi
      .search({ search: event.query, perPage: 25 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.giroSuggestions.set(res.data),
        error: () => this.giroSuggestions.set([]),
      });
  }

  save(): void {
    const account = this.account();
    if (!account || !this.canEdit() || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.accountsApi
      .updateBillingData(account.id, this.buildPayload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.auth.updateAccount(res.data);
          this.form.markAsPristine();
          this.messageService.add({
            severity: 'success',
            summary: this.lang.t('billing.data.saved'),
            key: 'global',
            life: 3500,
          });
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.applyFieldErrors(err);
          this.messageService.add({
            severity: 'error',
            summary: this.lang.t('ui.error'),
            detail: this.lang.t('billing.data.save_error'),
            key: 'global',
            life: 4500,
          });
        },
      });
  }

  /** Payload del PATCH: solo el perfil fiscal, `sii_activity_id` en vez del objeto. */
  private buildPayload(): UpdateAccountBillingData {
    const value = this.form.getRawValue();
    return {
      rut: blankToNull(value.rut),
      taxpayer_type: value.taxpayer_type ?? null,
      legal_name: blankToNull(value.legal_name),
      sii_activity_id: value.sii_activity?.id ?? null,
      billing_email: blankToNull(value.billing_email),
      billing_phone: blankToNull(value.billing_phone),
      billing_address: blankToNull(value.billing_address),
      billing_region_id: value.billing_region_id ?? null,
      billing_comuna_id: value.billing_comuna_id ?? null,
    };
  }

  /** Siembra el formulario desde el bloque fiscal de la cuenta. */
  private seed(): void {
    const account = this.account();
    if (!account) return;

    this.form.patchValue(
      {
        taxpayer_type: account.taxpayer_type,
        rut: account.rut ?? '',
        legal_name: account.legal_name ?? '',
        sii_activity: account.sii_activity ?? null,
        billing_address: account.billing_address ?? '',
        billing_region_id: account.billing_region_id ?? null,
        billing_comuna_id: account.billing_comuna_id ?? null,
        billing_phone: account.billing_phone ?? '',
        billing_email: account.billing_email ?? '',
      },
      { emitEvent: false },
    );
    this.form.markAsPristine();

    if (account.billing_region_id) this.loadComunas(account.billing_region_id, account.billing_comuna_id ?? null);
  }

  private loadRegions(): void {
    this.locationsApi
      .getRegions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.regions.set(res.data),
        error: () => this.regions.set([]),
      });
  }

  private loadComunas(regionId: number | null, keepComunaId: number | null = null): void {
    if (regionId == null) {
      this.comunas.set([]);
      return;
    }
    this.locationsApi
      .getComunas(regionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.comunas.set(res.data);
          if (keepComunaId != null) {
            this.form.controls.billing_comuna_id.setValue(keepComunaId, { emitEvent: false });
          }
        },
        error: () => this.comunas.set([]),
      });
  }

  /** Mapea los `errors` del 422 a los controles para feedback por campo. */
  private applyFieldErrors(err: HttpErrorResponse): void {
    if (err.status !== 422) return;
    const errors = (err.error as { errors?: Record<string, string[]> } | null)?.errors;
    if (!errors) return;

    const map: Record<string, keyof typeof this.form.controls> = {
      rut: 'rut',
      legal_name: 'legal_name',
      sii_activity_id: 'sii_activity',
      billing_email: 'billing_email',
      billing_phone: 'billing_phone',
      billing_address: 'billing_address',
      billing_region_id: 'billing_region_id',
      billing_comuna_id: 'billing_comuna_id',
    };

    for (const [field, controlName] of Object.entries(map)) {
      const messages = errors[field];
      if (!messages?.length) continue;
      this.form.controls[controlName].setErrors({ server: messages[0] });
      this.form.controls[controlName].markAsTouched();
    }
  }
}

/** El contrato trata `null` como "limpio"; un string vacío también. */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}
