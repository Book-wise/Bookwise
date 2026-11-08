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
import { RouterLink } from '@angular/router';
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
import { isValidRut, rutValidator } from '@shared/validators/rut.validator';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';

/** Clave de cada uno de los 9 datos fiscales (los mismos del PATCH). */
type FiscalField =
  | 'taxpayer_type'
  | 'rut'
  | 'legal_name'
  | 'sii_activity'
  | 'billing_address'
  | 'billing_region_id'
  | 'billing_comuna_id'
  | 'billing_phone'
  | 'billing_email';

/** Valor crudo del formulario (mismas claves que `form.getRawValue()`). */
interface BillingFormValue {
  taxpayer_type: TaxpayerType | null;
  rut: string;
  legal_name: string;
  sii_activity: SiiActivity | null;
  billing_address: string;
  billing_region_id: number | null;
  billing_comuna_id: number | null;
  billing_phone: string;
  billing_email: string;
}

interface WizardField {
  control: FiscalField;
  labelKey: string;
}

interface WizardStep {
  id: number;
  titleKey: string;
  fields: WizardField[];
}

type StepStatus = 'complete' | 'partial' | 'empty';

interface StepView {
  id: number;
  title: string;
  status: StepStatus;
  statusLabel: string;
  summary: string;
  done: number;
  total: number;
}

interface MissingField {
  control: FiscalField;
  stepId: number;
  label: string;
}

/** Pasos del asistente. El universo de 9 campos es el indicador de completitud. */
const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    titleKey: 'billing.data.section.basic',
    fields: [
      { control: 'taxpayer_type', labelKey: 'billing.data.taxpayer_type' },
      { control: 'rut', labelKey: 'billing.data.rut' },
      { control: 'legal_name', labelKey: 'billing.data.legal_name' },
      { control: 'sii_activity', labelKey: 'billing.data.sii_activity' },
    ],
  },
  {
    id: 2,
    titleKey: 'billing.data.section.address',
    fields: [
      { control: 'billing_address', labelKey: 'billing.data.address' },
      { control: 'billing_region_id', labelKey: 'billing.data.region' },
      { control: 'billing_comuna_id', labelKey: 'billing.data.comuna' },
    ],
  },
  {
    id: 3,
    titleKey: 'billing.data.section.contact',
    fields: [
      { control: 'billing_phone', labelKey: 'billing.data.phone' },
      { control: 'billing_email', labelKey: 'billing.data.email' },
    ],
  },
];

const TOTAL_FIELDS = WIZARD_STEPS.reduce((sum, step) => sum + step.fields.length, 0);

/** Un dato cuenta como completo cuando tiene un valor real (no `null`/blanco). */
function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

/**
 * "Datos de facturación" (`/admin/facturacion/datos`): perfil fiscal de la
 * **cuenta** (no del negocio), el pagador de la suscripción, presentado como
 * asistente por pasos (rail de progreso + panel de un solo paso).
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
    RouterLink,
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

  /** Paso activo del asistente (1..3). */
  readonly step = signal(1);
  readonly totalFields = TOTAL_FIELDS;

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

  /** Snapshot reactivo del formulario (el formulario no es signal, se espeja). */
  private readonly formSnapshot = signal<BillingFormValue>(this.form.getRawValue() as BillingFormValue);

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

    // Mantiene el snapshot al día con cada edición (getRawValue incluye disabled).
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.syncSnapshot();
    });

    this.loadRegions();
    this.seed();
    this.syncSnapshot();
  }

  /** Mapa campo → completo, recalculado sobre cada cambio del formulario. */
  private readonly completeness = computed<Map<FiscalField, boolean>>(() => {
    const snapshot = this.formSnapshot();
    const result = new Map<FiscalField, boolean>();
    for (const step of WIZARD_STEPS) {
      for (const field of step.fields) {
        result.set(field.control, this.isFieldComplete(field.control, snapshot));
      }
    }
    return result;
  });

  /** Vista por paso (título, estado, resumen) para el rail y el panel. */
  readonly stepViews = computed<StepView[]>(() => {
    const complete = this.completeness();
    return WIZARD_STEPS.map((def) => this.toStepView(def, complete));
  });

  readonly activeStep = computed<StepView>(() => {
    const current = this.step();
    return this.stepViews().find((s) => s.id === current) ?? this.stepViews()[0];
  });

  readonly doneCount = computed<number>(() => {
    const complete = this.completeness();
    let count = 0;
    complete.forEach((isComplete) => {
      if (isComplete) count += 1;
    });
    return count;
  });

  /** Datos que todavía faltan, con su label y el paso que los contiene. */
  readonly missing = computed<MissingField[]>(() => {
    const complete = this.completeness();
    const result: MissingField[] = [];
    for (const def of WIZARD_STEPS) {
      for (const field of def.fields) {
        if (!complete.get(field.control)) {
          result.push({ control: field.control, stepId: def.id, label: this.lang.t(field.labelKey) });
        }
      }
    }
    return result;
  });

  /** Label del botón primario: avanza en los pasos 1–2, guarda y queda en el 3. */
  readonly primaryLabel = computed<string>(() =>
    this.step() < 3
      ? this.lang.t('billing.data.wizard.save_next')
      : this.lang.t('billing.data.save'),
  );

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

  goBack(): void {
    this.step.update((s) => Math.max(1, s - 1));
  }

  /** Variante de `.bw-chip` según el estado de un paso. */
  stepChipClass(status: StepStatus): string {
    if (status === 'complete') return 'bw-chip--success';
    if (status === 'partial') return 'bw-chip--warning';
    return 'bw-chip--secondary';
  }

  save(advance = false): void {
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
          // Solo avanza cuando el guardado salió bien y hay un paso siguiente.
          if (advance && this.step() < 3) {
            this.step.update((s) => Math.min(3, s + 1));
          }
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

  private syncSnapshot(): void {
    this.formSnapshot.set(this.form.getRawValue() as BillingFormValue);
  }

  private isFieldComplete(control: FiscalField, snapshot: BillingFormValue): boolean {
    // `rut` solo cuenta si pasa módulo 11; el resto, con que tenga valor.
    if (control === 'rut') return isValidRut(snapshot.rut);
    // El email cuenta solo si no está vacío y su formato es válido.
    if (control === 'billing_email') {
      return hasValue(snapshot.billing_email) && !this.form.controls.billing_email.hasError('email');
    }
    return hasValue(snapshot[control]);
  }

  private toStepView(def: WizardStep, complete: Map<FiscalField, boolean>): StepView {
    const missingFields = def.fields.filter((field) => !complete.get(field.control));
    const done = def.fields.length - missingFields.length;
    const total = def.fields.length;
    const status: StepStatus = done === total ? 'complete' : done === 0 ? 'empty' : 'partial';

    return {
      id: def.id,
      title: this.lang.t(def.titleKey),
      status,
      statusLabel: this.statusLabel(status, done, total, missingFields),
      summary: this.stepSummary(def, complete),
      done,
      total,
    };
  }

  private statusLabel(
    status: StepStatus,
    done: number,
    total: number,
    missingFields: WizardField[],
  ): string {
    if (status === 'complete') return this.lang.t('billing.data.wizard.state.complete');
    if (status === 'empty') return this.lang.t('billing.data.wizard.state.empty');

    const missing = total - done;
    if (missing === 1) {
      return this.lang.t('billing.data.wizard.state.missing_one', {
        field: this.lang.t(missingFields[0].labelKey),
      });
    }
    return this.lang.t('billing.data.wizard.state.missing_many', { n: String(missing) });
  }

  /** Resumen de una línea con los datos ya cargados del paso (orden de campos). */
  private stepSummary(def: WizardStep, complete: Map<FiscalField, boolean>): string {
    const snapshot = this.formSnapshot();
    const parts: string[] = [];
    for (const field of def.fields) {
      if (!complete.get(field.control)) continue;
      const text = this.fieldDisplay(field.control, snapshot);
      if (text) parts.push(text);
    }
    return parts.join(' · ');
  }

  private fieldDisplay(control: FiscalField, snapshot: BillingFormValue): string {
    switch (control) {
      case 'taxpayer_type': {
        const value = snapshot.taxpayer_type;
        if (!value) return '';
        return this.lang.t(
          value === 'company' ? 'billing.data.taxpayer.company' : 'billing.data.taxpayer.individual',
        );
      }
      case 'sii_activity':
        return snapshot.sii_activity?.description ?? '';
      case 'billing_region_id':
        return this.regionName(snapshot.billing_region_id);
      case 'billing_comuna_id':
        return this.comunaName(snapshot.billing_comuna_id);
      default: {
        const value = snapshot[control];
        return typeof value === 'string' ? value : '';
      }
    }
  }

  private regionName(id: number | null): string {
    if (id == null) return '';
    return this.regions().find((region) => region.id === id)?.name ?? '';
  }

  private comunaName(id: number | null): string {
    if (id == null) return '';
    return this.comunas().find((comuna) => comuna.id === id)?.name ?? '';
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
