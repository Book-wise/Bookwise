import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  Input,
  Output,
  EventEmitter,
  ViewChild,
} from '@angular/core';
import { NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { AccordionModule } from 'primeng/accordion';
import { CheckboxModule } from 'primeng/checkbox';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { HttpErrorResponse } from '@angular/common/http';
import { DateTime } from 'luxon';
import {
  Booking,
  Client,
  ClientPack,
  Service,
  Provider,
  CreateBooking,
  BookingRepeat,
} from '@models';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { TimezoneService } from '@services/timezone.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { BookingFormData } from '../interfaces/booking-form-data.interface';
import { BOOKING_STATUSES } from '../constants/booking-statuses';
import { DAYS_OF_WEEK, REPEAT_TYPE_OPTIONS } from '../constants/repeat-options';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { RutDirective } from '@shared/validators/rut.directive';
import { BwCurrencyPipe } from '@shared/pipes/bw-currency.pipe';
import { CURRENCY_CONFIG } from '@shared/config/currency.config';
import { Subject, of } from 'rxjs';
import { debounceTime, switchMap, catchError, takeUntil, map } from 'rxjs/operators';
import { SimilarPatientsService } from '../similar-patients.service';
import { SkeletonModule } from 'primeng/skeleton';
import { matchSimilarClients, dedupeById, stripDigits } from '@shared/utils/client-similarity.util';
import { PatientCardComponent } from '@shared/components/patient-card';



@Component({
  selector: 'bw-booking-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    InputTextModule,
    TextareaModule,
    InputNumberModule,
    ButtonModule,
    DialogModule,
    DatePickerModule,
    AccordionModule,
    CheckboxModule,
    RadioButtonModule,
    TooltipModule,
    PhoneInputComponent,
    RutDirective,
    SkeletonModule,
    PatientCardComponent,
    BwCurrencyPipe,
  ],
  templateUrl: './booking-form-dialog.component.html',
  styleUrls: ['./booking-form-dialog.component.scss'],
})
export class BookingFormDialogComponent implements OnInit, OnDestroy {
  readonly currencyConfig = CURRENCY_CONFIG;

  private providersApi = inject(ProvidersApiService);
  private bookingsApi = inject(BookingsApiService);
  private clientsApi = inject(ClientsApiService);
  private servicesApi = inject(ServicesApiService);
  private httpError = inject(HttpErrorService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  readonly lang = inject(LanguageService);
  private tzService = inject(TimezoneService);

  /** ReferenceStore: fuente Ãºnica de datos maestros */
  private refStore = inject(ReferenceStore);
  private similarService = inject(SimilarPatientsService);

  @Input() initialDate?: Date;
  @Input() lockedProviderId: number | null = null;
  @Output() onSaved = new EventEmitter<void>();
  @Output() onCancelled = new EventEmitter<void>();

  visible = false;
  saving = signal(false);
  providersLoading = signal(false);
  isEdit = signal(false);
  showRepeatDialog = false;
  showServicePanel = false;
  showPatientPanel = false;
  savingService = signal(false);

  /** Skeleton visible hasta que el store tenga datos Y los providers estÃ©n cargados */
  readonly loadingData = computed(() => !this.refStore.allLoaded() || this.providersLoading());

  // â”€â”€ Similar-patients pre-check (duplicate detection) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  similarClients = signal<Client[]>([]);
  showSimilarDialog = signal(false);
  selectedClientOption = signal<number | 'new'>('new');
  precheckPending = signal(false);

  private precheckTrigger$ = new Subject<string>();
  private destroy$ = new Subject<void>();
  private saveInProgress = false;

  @ViewChild('patientForm') patientForm?: NgForm;

  formData: BookingFormData = this.getEmptyForm();

  newClient = { first_name: '', last_name: '', email: '', phone: '', rut: '' };
  newService = { name: '', price: 0, duration_minutes: 60 };

  repeatAfterChecked = false;
  repeatUntilChecked = false;

  // Datos desde ReferenceStore
  readonly clients = this.refStore.clients;
  readonly providers = signal<Provider[]>([]); // location-filtered, se llena manualmente
  readonly locations = this.refStore.locations;

  /**
   * Servicio que se está editando aunque esté inactivo: se mantiene visible para
   * no romper la edición de una reserva vieja (el selector quedaría vacío).
   */
  private readonly keepServiceId = signal<number | null>(null);
  /** Pack de la reserva que se edita aunque esté inactivo (paso Variación). */
  private readonly keepPackId = signal<number | null>(null);
  /** Servicio elegido en el paso 1; deriva las opciones de variación. */
  readonly selectedServiceId = signal<number | null>(null);
  /** Packs del cliente para el resumen read-only (cacheado por cliente). */
  readonly clientPacks = signal<ClientPack[]>([]);
  private readonly clientPacksClientId = signal<number | null>(null);

  /**
   * Servicios ACTIVOS ofrecidos en el selector. Un servicio inactivo no debe
   * poder elegirse; la excepción es el que ya está en la reserva que se edita.
   * Los packs se ofrecen aparte, en el paso "Variación".
   */
  readonly services = computed<Service[]>(() => {
    const keepId = this.keepServiceId();
    return this.refStore.services().filter(
      (s) => s.active || (keepId !== null && s.id === keepId),
    );
  });

  // â”€â”€ Selected-client reactive mirror (signal + computed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly selectedClientId = signal<number | null>(null);
  readonly selectedClient = computed(
    () => this.clients().find((c) => c.id === this.selectedClientId()) ?? null,
  );

  onSuccessCallback?: () => void;
  selectedServiceKey = '';
  selectedVariationKey = '';
  private _pendingServiceId = 0;

  readonly hours = Array.from({ length: 24 }, (_, i) => ({
    label: i.toString().padStart(2, '0'),
    value: i,
  }));
  readonly minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => ({
    label: m.toString().padStart(2, '0'),
    value: m,
  }));

  get mobileHour(): number {
    return this.formData.start_time
      ? this.tzService.getHourInZone(this.formData.start_time)
      : 9;
  }
  set mobileHour(h: number) {
    const base = this.formData.start_time || new Date();
    const dt = DateTime.fromJSDate(base).setZone(this.tzService.activeTimezone());
    this.formData.start_time = dt.set({ hour: h, minute: dt.minute, second: 0, millisecond: 0 }).toJSDate();
  }

  get mobileMinute(): number {
    return this.formData.start_time
      ? this.tzService.getMinuteInZone(this.formData.start_time)
      : 0;
  }
  set mobileMinute(m: number) {
    const base = this.formData.start_time || new Date();
    const dt = DateTime.fromJSDate(base).setZone(this.tzService.activeTimezone());
    this.formData.start_time = dt.set({ minute: m, second: 0, millisecond: 0 }).toJSDate();
  }

  intervalLabel(): string {
    const count = this.formData.repeat_interval ?? 2;
    if (this.formData.repeat_type === 'weekly') {
      return this.lang.t(count === 1 ? 'booking_form.repeat.week' : 'booking_form.repeat.weeks');
    }
    return this.lang.t(count === 1 ? 'booking_form.repeat.month' : 'booking_form.repeat.months');
  }

  occurrencesLabel(): string {
    const count = this.formData.repeat_count ?? 2;
    return this.lang.t(count === 1 ? 'common.occurrence' : 'common.occurrences');
  }

  clientOptions = computed(() =>
    this.clients().map((c) => ({
      label: `${c.first_name} ${c.last_name}`,
      value: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
    })),
  );

  /**
   * Opciones de profesional (D1): en selección NUEVA solo se ofrecen providers activos.
   * Al editar una reserva, el provider asignado se conserva aunque esté inactivo
   * (p.id === formData.provider_id) para que la selección siga resolviéndose.
   * El filtro vive en este consumidor; ReferenceStore no filtra lecturas.
   */
  providerOptions = computed<Array<{ label: string; value: number | null }>>(() => {
    const selectedProviderId = this.formData.provider_id;
    return [
      { label: this.lang.t('misc.unassigned'), value: null },
      ...this.providers()
        .filter((p) => p.active || p.id === selectedProviderId)
        .map((p) => ({ label: `${p.first_name} ${p.last_name}`, value: p.id })),
    ];
  });

  serviceOptions = computed(() =>
    this.services().map((s: Service) => ({
      label: `${s.name} (${s.duration_minutes || 60} min)`,
      value: `svc_${s.id}`,
      name: s.name,
      duration_minutes: s.duration_minutes || 60,
      price: s.price || 0,
      _id: s.id,
    })),
  );

  /**
   * Variaciones (términos) del servicio elegido: los service_packs ACTIVOS de
   * ese servicio (más el pack de la reserva que se edita), ordenados por
   * total_sessions ascendente. El badge se mide contra el precio de 1 sesión.
   */
  readonly variationOptions = computed(() => {
    const serviceId = this.selectedServiceId();
    if (!serviceId) return [];

    const keepPackId = this.keepPackId();
    const reference = this.referencePerSession(serviceId);

    return this.refStore
      .packs()
      .filter((p) => p.service_id === serviceId)
      .filter((p) => p.active || (keepPackId !== null && p.id === keepPackId))
      .slice()
      .sort((a, b) => a.total_sessions - b.total_sessions)
      .map((p) => {
        const sessions = p.total_sessions || 1;
        const price = Number(p.price) || 0;
        return {
          value: `term_${p.id}`,
          label: p.name || `${sessions}`,
          sessions,
          price,
          perSession: sessions > 0 ? price / sessions : price,
          discountPercent: this.computeDiscountPercent(price, sessions, reference),
          duration_minutes: p.duration_minutes ?? this.serviceDuration(serviceId) ?? 60,
          _id: p.id,
        };
      });
  });

  /** Resumen read-only del pack ACTIVO del paciente para el servicio elegido. */
  readonly activeClientPack = computed<ClientPack | null>(() => {
    const serviceId = this.selectedServiceId();
    if (!serviceId) return null;

    return (
      this.clientPacks().find((p) => {
        if (p.status !== 'active') return false;
        const viaNested = p.service_pack?.service_id === serviceId;
        const viaCatalog = this.refStore
          .packs()
          .some((sp) => sp.id === p.service_pack_id && sp.service_id === serviceId);
        return viaNested || viaCatalog;
      }) ?? null
    );
  });

  /** Precio de referencia por sesión: el pack de 1 sesión, o el precio base. */
  private referencePerSession(serviceId: number): number {
    const oneSession = this.refStore
      .packs()
      .find((p) => p.service_id === serviceId && p.total_sessions === 1);
    if (oneSession) return Number(oneSession.price) || 0;
    const service = this.services().find((s) => s.id === serviceId);
    return Number(service?.price ?? 0) || 0;
  }

  private serviceDuration(serviceId: number): number {
    return this.services().find((s) => s.id === serviceId)?.duration_minutes || 60;
  }

  private computeDiscountPercent(termPrice: number, sessions: number, reference: number): number {
    if (reference <= 0 || sessions <= 0 || termPrice <= 0) return 0;
    const percent = Math.round((1 - termPrice / sessions / reference) * 100);
    return percent > 0 ? percent : 0;
  }

  paidPackSummary(pack: ClientPack): string {
    return this.lang.t('booking_form.variation.paid_summary', {
      used: String(pack.used_sessions),
      total: String(pack.total_sessions),
    });
  }

  locationOptions = computed(() => this.locations().map((l) => ({ label: l.name, value: l.id })));

  statusOptions = computed(() =>
    BOOKING_STATUSES.map((s) => ({ ...s, label: this.lang.t(s.labelKey) })),
  );
  daysOfWeek = computed(() =>
    DAYS_OF_WEEK.map((d) => ({ label: this.lang.t(d.labelKey), value: d.value })),
  );
  repeatTypeOptions = computed(() =>
    REPEAT_TYPE_OPTIONS.map((o) => ({ label: this.lang.t(o.labelKey), value: o.value })),
  );
  dialogTitle = computed(() => {
    const client = this.selectedClient();
    if (client) {
      return this.lang.t('booking_form.title.for_client', {
        name: `${client.first_name} ${client.last_name}`,
      });
    }
    return this.lang.t(this.isEdit() ? 'booking_form.title.edit' : 'booking_form.title.create');
  });

  ngOnInit() {
    this.precheckTrigger$
      .pipe(
        debounceTime(400),
        switchMap((term) =>
          this.similarService
            .precheck(term, {
              first_name: this.newClient.first_name,
              last_name: this.newClient.last_name,
              email: this.newClient.email,
              phone: this.newClient.phone,
            })
            .pipe(catchError(() => of([] as Client[]))),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((candidates) => this.onPrecheckResult(candidates));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // â”€â”€ Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private getEmptyForm(): BookingFormData {
    const now = this.initialDate || new Date();
    return {
      client_id: 0,
      service_id: 0,
      service_pack_id: null,
      provider_id: null,
      location_id: 1,
      status_id: 1,
      start_time: now,
      duration_minutes: 60,
      price: 0,
      notes: '',
      internal_notes: '',
      repeat_enabled: false,
      repeat_type: undefined,
      repeat_days: [],
      repeat_interval: 1,
      repeat_end_type: 'after',
      repeat_count: 1,
      repeat_until: undefined,
    };
  }

  /**
   * Carga los providers filtrados por location actual.
   * El resto de datos maestros (clients, services, packs, locations)
   * viene reactivamente desde ReferenceStore.
   */
  private loadProviders(): void {
    this.providersLoading.set(true);
    this.providersApi
      .getProviders(
        this.formData.location_id ? { location_id: this.formData.location_id } : undefined,
      )
      .subscribe({
        next: (data) => {
          this.providers.set(data);
          this.providersLoading.set(false);
          if (this._pendingServiceId) {
            this.selectedServiceKey = this.resolveServiceKey(this._pendingServiceId);
            this._pendingServiceId = 0;
          }
        },
        error: (err) => {
          this.httpError.handle(err, 'cargar profesionales');
          this.providersLoading.set(false);
        },
      });
  }

  /** Punto de entrada Ãºnico para cargar datos al abrir el diÃ¡logo */
  loadFormData(): void {
    this.loadProviders();
  }

  openNew(booking?: Booking, initialDate?: Date, locationId?: number | null) {
    this.resetForm();

    if (booking) {
      this.isEdit.set(true);
      const startDate = new Date(booking.start_time);
      const packId = booking.pack_session?.service_pack_id ?? null;
      const pack = packId ? this.refStore.packs().find((p) => p.id === packId) : undefined;
      const serviceId = booking.service_id ?? booking.service?.id ?? pack?.service_id ?? 0;
      this.formData = {
        ...this.getEmptyForm(),
        id: booking.id,
        client_id: booking.client_id ?? booking.client?.id ?? 0,
        service_id: serviceId,
        service_pack_id: packId,
        provider_id: this.lockedProviderId ?? booking.provider_id ?? booking.provider?.id ?? null,
        location_id: booking.location_id ?? booking.location?.id ?? 1,
        status_id: booking.status_id,
        start_time: startDate,
        duration_minutes: booking.custom_duration_minutes || 60,
        price: Number(booking.price) || 0,
        notes: booking.notes || '',
      };
      this._pendingServiceId = serviceId;
      this.keepServiceId.set(serviceId || null);
      this.keepPackId.set(packId);
      this.selectedServiceId.set(serviceId || null);
      this.selectedVariationKey = packId ? `term_${packId}` : '';
      this.selectedClientId.set(this.formData.client_id || null);
    } else {
      if (initialDate) this.formData.start_time = initialDate;
      if (locationId) this.formData.location_id = locationId;
      if (this.lockedProviderId) this.formData.provider_id = this.lockedProviderId;
    }

    this.loadClientPacksIfNeeded();
    this.loadFormData();
    this.visible = true;
    this.cdr.detectChanges();
  }

  private resetForm() {
    this.formData = this.getEmptyForm();
    this.selectedClientId.set(null);
    this.selectedServiceKey = '';
    this.selectedVariationKey = '';
    this.selectedServiceId.set(null);
    this._pendingServiceId = 0;
    this.keepServiceId.set(null);
    this.keepPackId.set(null);
    this.clientPacks.set([]);
    this.clientPacksClientId.set(null);
    this.isEdit.set(false);
    this.showRepeatDialog = false;
    this.showServicePanel = false;
    this.showPatientPanel = false;
    this.newClient = { first_name: '', last_name: '', email: '', phone: '', rut: '' };
    this.repeatAfterChecked = false;
    this.repeatUntilChecked = false;
    this.similarClients.set([]);
    this.showSimilarDialog.set(false);
    this.selectedClientOption.set('new');
    this.precheckPending.set(false);
    this.saveInProgress = false;
  }

  onClose() {
    this.visible = false;
    this.resetForm();
  }

  // â”€â”€ Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  isFormValid(): boolean {
    return !!(this.formData.client_id && this.selectedServiceKey && this.formData.start_time);
  }

  hasRepeatData(): boolean {
    return this.formData.repeat_enabled === true;
  }

  // â”€â”€ Repeat dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  isDaySelected(dayValue: number): boolean {
    return this.formData.repeat_days?.includes(dayValue) || false;
  }

  toggleDay(dayValue: number) {
    if (!this.formData.repeat_days) this.formData.repeat_days = [];
    const idx = this.formData.repeat_days.indexOf(dayValue);
    if (idx >= 0) this.formData.repeat_days.splice(idx, 1);
    else this.formData.repeat_days.push(dayValue);
  }

  setRepeatType(type: 'daily' | 'weekly' | 'monthly') {
    this.formData.repeat_type = type;
  }

  openRepeatDialog() {
    this.showRepeatDialog = true;
  }

  applyRepeat() {
    this.formData.repeat_enabled = true;
    this.showRepeatDialog = false;
  }

  // â”€â”€ Service change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private resolveServiceKey(serviceId: number): string {
    return serviceId ? `svc_${serviceId}` : '';
  }

  onServiceChange() {
    const option = this.serviceOptions().find((o) => o.value === this.selectedServiceKey);
    if (option) {
      this.formData.service_id = option._id;
      this.selectedServiceId.set(option._id);
      this.formData.duration_minutes = option.duration_minutes;
      this.formData.price = Number(option.price) || 0;
    } else {
      this.selectedServiceId.set(null);
    }
    this.formData.service_pack_id = null;
    this.selectedVariationKey = '';
    this.loadClientPacksIfNeeded();
  }

  onVariationChange() {
    const option = this.variationOptions().find((o) => o.value === this.selectedVariationKey);
    if (!option) return;
    this.formData.service_pack_id = option._id;
    this.formData.duration_minutes = option.duration_minutes;
    this.formData.price = option.price;
  }

  onLocationChange(): void {
    this.formData.provider_id = null;
    this.loadProviders();
  }

  onClientFilter(): void {}

  onClientChange(): void {
    this.selectedClientId.set(this.formData.client_id || null);
    this.loadClientPacksIfNeeded();
  }

  /**
   * Resumen del pack del paciente: cacheado por cliente (no se re-consulta si
   * el cliente no cambió) y tolerante a error (sin resumen, sin toast).
   */
  private loadClientPacksIfNeeded(): void {
    const clientId = this.formData.client_id;
    const serviceId = this.selectedServiceId();

    if (!clientId || !serviceId) {
      this.clientPacks.set([]);
      this.clientPacksClientId.set(null);
      return;
    }

    if (this.clientPacksClientId() === clientId) return;

    this.clientPacksClientId.set(clientId);
    this.clientPacks.set([]);

    this.clientsApi
      .getClientPacks(clientId)
      .pipe(takeUntil(this.destroy$), catchError(() => of([] as ClientPack[])))
      .subscribe((packs) => this.clientPacks.set(packs));
  }

  // â”€â”€ Save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  onSave() {
    if (!this.formData.client_id) {
      this.messageService.add({
        severity: 'warn',
        summary: this.lang.t('toast.patient_required.summary'),
        detail: this.lang.t('toast.patient_required.detail'),
        key: 'global',
        life: 4000,
      });
      return;
    }
    if (!this.isFormValid()) return;
    this.saving.set(true);

    const startDate = new Date(this.formData.start_time);

    const bookingData: CreateBooking = {
      client_id: this.formData.client_id,
      provider_id: this.formData.provider_id || undefined,
      location_id: this.formData.location_id,
      status_id: this.formData.status_id,
      start_time: this.formatDateTime(startDate),
      custom_duration_minutes: this.formData.duration_minutes || undefined,
      notes: this.formData.notes || undefined,
    };

    if (this.formData.service_pack_id) {
      bookingData.service_pack_id = this.formData.service_pack_id;
    } else {
      bookingData.service_id = this.formData.service_id;
      bookingData.price = this.formData.price;
    }

    if (this.formData.repeat_enabled) {
      const repeat: BookingRepeat = {
        enabled: true,
        type: this.formData.repeat_type,
        days: this.formData.repeat_days,
        interval: this.formData.repeat_interval,
        end_type: this.formData.repeat_end_type,
        count: this.formData.repeat_count,
        until: this.formData.repeat_until
          ? this.formatDateTime(this.formData.repeat_until)
          : undefined,
      };
      bookingData.repeat = repeat;
    }

    const request = this.isEdit()
      ? this.bookingsApi.updateBooking(this.formData.id!, bookingData).pipe(
          map((res) => res.data), // <-- Transforma ApiResponse<Booking> en Booking limpio
        )
      : this.bookingsApi.createBooking(bookingData);

    request.subscribe({
      next: (saved: Booking) => {
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t(
            this.isEdit() ? 'toast.booking_updated.summary' : 'toast.booking_created.summary',
          ),
          detail: this.lang.t(
            this.isEdit() ? 'toast.booking_updated.detail' : 'toast.booking_created.detail',
          ),
          key: 'global',
        });
        this.visible = false;
        this.saving.set(false);
        this.onSaved.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.handleApiError(err);
      },
    });
  }

  saveClient(form?: NgForm) {
    if (this.precheckPending()) return;
    this.saveInProgress = true;
    if (form) {
      form.form.markAllAsTouched();
      if (form.invalid) {
        this.saveInProgress = false;
        return;
      }
    }
    this.clientsApi
      .createClient({
        first_name: this.newClient.first_name,
        last_name: this.newClient.last_name,
        email: this.newClient.email,
        phone: this.newClient.phone || undefined,
        rut: this.newClient.rut || undefined,
      })
      .subscribe({
        next: (client) => {
          this.messageService.add({
            severity: 'success',
            summary: this.lang.t('toast.client_created.summary'),
            detail: this.lang.t('toast.client_created.detail'),
            key: 'global',
          });
          this.showPatientPanel = false;
          this.formData.client_id = client.id;
          this.selectedClientId.set(client.id);
          this.refStore.invalidateClients();
          this.loadFormData();
        },
        error: (err) => {
          this.saveInProgress = false;
          this.httpError.handle(err, 'crear cliente');
        },
      });
  }

  private handleApiError(err: HttpErrorResponse): void {
    this.httpError.handle(err, 'guardar reserva');
  }

  private formatDateTime(date: Date | string): string {
    return this.tzService.formatDateTime(date);
  }

  // â”€â”€ Service creation panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  openServicePanel(): void {
    this.newService = { name: '', price: 0, duration_minutes: 60 };
    this.showPatientPanel = false;
    this.showServicePanel = true;
  }

  closeServicePanel(): void {
    this.showServicePanel = false;
  }

  // â”€â”€ Patient creation panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  openPatientPanel(): void {
    this.newClient = { first_name: '', last_name: '', email: '', phone: '', rut: '' };
    this.showServicePanel = false;
    this.showPatientPanel = true;
    this.saveInProgress = false;
    this.precheckPending.set(false);
    this.similarClients.set([]);
  }

  closePatientPanel(): void {
    this.showPatientPanel = false;
    this.newClient = { first_name: '', last_name: '', email: '', phone: '', rut: '' };
    this.saveInProgress = false;
    this.precheckPending.set(false);
  }

  // â”€â”€ Similar-patients pre-check (duplicate detection) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** Proxy so `p-radioButton`'s template-driven `[(ngModel)]` can bind to the signal. */
  get selectedClientOptionValue(): number | 'new' {
    return this.selectedClientOption();
  }
  set selectedClientOptionValue(value: number | 'new') {
    this.selectedClientOption.set(value);
  }

  /** Proxy so `p-dialog`'s `[(visible)]` can bind to the signal. */
  get showSimilarDialogValue(): boolean {
    return this.showSimilarDialog();
  }
  set showSimilarDialogValue(value: boolean) {
    this.showSimilarDialog.set(value);
  }

  /**
   * Triggers a debounced similarity pre-check for the given contact value.
   * No-ops if the patient-creation panel isn't open, or if the value doesn't
   * meet the per-kind eligibility gate (email: >=5 chars, phone: >=6 digits).
   */
  onContactBlur(value: string, kind: 'email' | 'phone'): void {
    if (!this.showPatientPanel) return;

    const trimmed = (value ?? '').trim();
    if (!trimmed) return;

    const eligible = kind === 'email' ? trimmed.length >= 5 : stripDigits(trimmed).length >= 6;

    if (!eligible) return;

    this.precheckPending.set(true);
    this.precheckTrigger$.next(trimmed);
  }

  onPhoneChanged(value: string): void {
    this.onContactBlur(value, 'phone');
  }

  onPrecheckResult(candidates: Client[]): void {
    this.precheckPending.set(false);
    if (this.saveInProgress) return;

    const matches = matchSimilarClients(candidates, this.newClient);
    const merged = dedupeById([...this.similarClients(), ...matches]);

    this.similarClients.set(merged);
    this.showSimilarDialog.set(merged.length > 0);
    if (merged.length) this.selectedClientOption.set('new');
  }

  onSimilarCancel(): void {
    this.showSimilarDialog.set(false);
    this.similarClients.set([]);
    this.selectedClientOption.set('new');
  }

  onSimilarAccept(): void {
    const option = this.selectedClientOption();
    this.showSimilarDialog.set(false);

    if (option === 'new') {
      this.similarClients.set([]);
      this.precheckPending.set(false);
      this.saveClient(this.patientForm);
      return;
    }

    this.formData.client_id = option;
    this.selectedClientId.set(option);
    this.showPatientPanel = false;
    this.newClient = { first_name: '', last_name: '', email: '', phone: '', rut: '' };
    this.similarClients.set([]);
    this.saveInProgress = false;

    this.messageService.add({
      severity: 'success',
      summary: this.lang.t('toast.existing_client_assigned.summary'),
      detail: this.lang.t('toast.existing_client_assigned.detail'),
      key: 'global',
    });
  }

  saveNewService(): void {
    if (!this.newService.name || !this.newService.duration_minutes) return;
    this.savingService.set(true);
    this.servicesApi.createService(this.newService).subscribe({
      next: (service) => {
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('toast.service_created.summary'),
          detail: service.name,
          key: 'global',
          life: 3000,
        });
        this.refStore.invalidateServices();
        this.savingService.set(false);
        this.showServicePanel = false;
        this.loadFormData();
      },
      error: (err) => {
        this.httpError.handle(err, 'crear servicio');
        this.savingService.set(false);
      },
    });
  }
}
