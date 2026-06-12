import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  signal,
  computed,
  Input,
  Output,
  EventEmitter,
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
import { Booking, Client, Service, ServicePack, Location, Provider, CreateBooking, BookingRepeat } from '@models';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { DataCacheService, CACHE_KEYS, CACHE_TTL } from '@services/data-cache.service';
import { LanguageService } from '@services/language.service';
import { BookingUpdateService } from '@services/booking-update.service';
import { BookingFormData } from '../interfaces/booking-form-data.interface';
import { BOOKING_STATUSES } from '../constants/booking-statuses';
import { DAYS_OF_WEEK, REPEAT_TYPE_OPTIONS } from '../constants/repeat-options';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { RutDirective } from '@shared/validators/rut.directive';
import { CURRENCY_CONFIG } from '@shared/config/currency.config';
import { forkJoin } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';

/** Service or ServicePack tagged with _isPack by loadFormData() — never sent to the API. */
type TaggedService = (Service | ServicePack) & { _isPack?: boolean };

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
  ],
  templateUrl: './booking-form-dialog.component.html',
  styleUrls: ['./booking-form-dialog.component.scss'],
})
export class BookingFormDialogComponent implements OnInit {
  readonly currencyConfig = CURRENCY_CONFIG;

  private apiService     = inject(ApiService);
  private httpError      = inject(HttpErrorService);
  private messageService = inject(MessageService);
  private cdr            = inject(ChangeDetectorRef);
  private dataCache      = inject(DataCacheService);
  readonly lang          = inject(LanguageService);
  private bookingUpdate  = inject(BookingUpdateService);

  @Input() initialDate?: Date;
  @Input() lockedProviderId: number | null = null;
  @Output() onSaved = new EventEmitter<void>();
  @Output() onCancelled = new EventEmitter<void>();

  visible     = false;
  saving           = signal(false);
  loadingData      = signal(false);
  loadingProviders = signal(false);
  isEdit      = signal(false);
  showRepeatDialog  = false;
  showServicePanel  = false;
  showPatientPanel  = false;
  savingService     = signal(false);

  formData: BookingFormData = this.getEmptyForm();

  newClient  = { first_name: '', last_name: '', email: '', phone: '', rut: '' };
  newService = { name: '', price: 0, duration_minutes: 60 };

  repeatAfterChecked = false;
  repeatUntilChecked = false;

  clients = signal<Client[]>([]);
  services = signal<(Service | ServicePack)[]>([]);
  providers = signal<Provider[]>([]);
  locations = signal<Location[]>([]);

  onSuccessCallback?: () => void;
  selectedServiceKey = '';
  private _pendingServiceId = 0;

  readonly hours   = Array.from({ length: 24 }, (_, i) => ({ label: i.toString().padStart(2, '0'), value: i }));
  readonly minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => ({
    label: m.toString().padStart(2, '0'), value: m,
  }));

  get mobileHour(): number {
    return this.formData.start_time?.getHours() ?? 9;
  }
  set mobileHour(h: number) {
    const d = new Date(this.formData.start_time || new Date());
    d.setHours(h, d.getMinutes(), 0, 0);
    this.formData.start_time = d;
  }

  get mobileMinute(): number {
    return this.formData.start_time?.getMinutes() ?? 0;
  }
  set mobileMinute(m: number) {
    const d = new Date(this.formData.start_time || new Date());
    d.setMinutes(m, 0, 0);
    this.formData.start_time = d;
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

  providerOptions = computed<Array<{ label: string; value: number | null }>>(() => [
    { label: this.lang.t('misc.unassigned'), value: null },
    ...this.providers().map((p) => ({ label: `${p.first_name} ${p.last_name}`, value: p.id })),
  ]);

  serviceOptions = computed(() =>
    this.services().map((s: TaggedService) => ({
      label: `${s.name} (${s.duration_minutes || 60} min)`,
      value: s._isPack ? `pack_${s.id}` : `svc_${s.id}`,
      name: s.name,
      duration_minutes: s.duration_minutes || 60,
      price: s.price || 0,
      _id: s.id as number,
    })),
  );

  locationOptions = computed(() => this.locations().map((l) => ({ label: l.name, value: l.id })));

  statusOptions = computed(() =>
    BOOKING_STATUSES.map(s => ({ ...s, label: this.lang.t(s.labelKey) }))
  );
  daysOfWeek = computed(() =>
    DAYS_OF_WEEK.map(d => ({ label: this.lang.t(d.labelKey), value: d.value }))
  );
  repeatTypeOptions = computed(() =>
    REPEAT_TYPE_OPTIONS.map(o => ({ label: this.lang.t(o.labelKey), value: o.value }))
  );
  dialogTitle = computed(() => this.lang.t(this.isEdit() ? 'booking_form.title.edit' : 'booking_form.title.create'));

  ngOnInit() { /* datos cargados al abrir, no al montar */ }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

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

  loadFormData(): void {
    this.loadingData.set(true);
    this.loadingProviders.set(true);
    forkJoin({
      clients:   this.dataCache.getOrFetchResource(CACHE_KEYS.CLIENTS,   () => this.apiService.getClients({ per_page: 100 }), CACHE_TTL.CLIENTS),
      services:  this.dataCache.getOrFetchResource(CACHE_KEYS.SERVICES,  () => this.apiService.getServices(),                 CACHE_TTL.SERVICES),
      packs:     this.dataCache.getOrFetchResource(CACHE_KEYS.PACKS,     () => this.apiService.getPacks(),                    CACHE_TTL.PACKS),
      providers: this.apiService.getProviders(
        this.formData.location_id ? { location_id: this.formData.location_id } : undefined
      ),
      locations: this.dataCache.getOrFetchResource(CACHE_KEYS.LOCATIONS, () => this.apiService.getLocations(),                CACHE_TTL.LOCATIONS),
    }).subscribe({
      next: ({ clients, services, packs, providers, locations }) => {
        this.clients.set(clients);
        this.services.set([
          ...services,
          ...(packs.data ?? []).map(p => ({ ...p, _isPack: true })),
        ]);
        this.providers.set(providers);
        this.locations.set(locations);
        if (this._pendingServiceId) {
          this.selectedServiceKey = this.resolveServiceKey(this._pendingServiceId);
          this._pendingServiceId = 0;
        }
        this.loadingData.set(false);
        this.loadingProviders.set(false);
      },
      error: (err) => {
        this.httpError.handle(err, 'cargar datos del formulario');
        this.loadingData.set(false);
        this.loadingProviders.set(false);
      },
    });
  }

  openNew(booking?: Booking, initialDate?: Date, locationId?: number | null) {
    this.resetForm();

    if (booking) {
      this.isEdit.set(true);
      const startDate = new Date(booking.start_time);
      const packId    = booking.pack_session?.service_pack_id ?? null;
      const serviceId = packId ? 0 : (booking.service_id ?? booking.service?.id ?? 0);
      this.formData = {
        ...this.getEmptyForm(),
        id:               booking.id,
        client_id:        booking.client_id ?? booking.client?.id ?? 0,
        service_id:       serviceId,
        service_pack_id:  packId,
        provider_id:      this.lockedProviderId ?? booking.provider_id ?? booking.provider?.id ?? null,
        location_id:      booking.location_id ?? booking.location?.id ?? 1,
        status_id:        booking.status_id,
        start_time:       startDate,
        duration_minutes: booking.custom_duration_minutes || 60,
        price:            Number(booking.price) || 0,
        notes:            booking.notes || '',
      };
      this._pendingServiceId = packId ?? serviceId;
    } else {
      if (initialDate) this.formData.start_time = initialDate;
      if (locationId)  this.formData.location_id = locationId;
      if (this.lockedProviderId) this.formData.provider_id = this.lockedProviderId;
    }

    this.loadFormData();
    this.visible = true;
    this.cdr.detectChanges();
  }

  private resetForm() {
    this.formData = this.getEmptyForm();
    this.selectedServiceKey = '';
    this._pendingServiceId = 0;
    this.isEdit.set(false);
    this.showRepeatDialog = false;
    this.showServicePanel = false;
    this.showPatientPanel = false;
    this.newClient = { first_name: '', last_name: '', email: '', phone: '', rut: '' };
    this.repeatAfterChecked = false;
    this.repeatUntilChecked = false;
  }

  onClose() {
    this.visible = false;
    this.resetForm();
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  isFormValid(): boolean {
    return !!(this.formData.client_id && this.selectedServiceKey && this.formData.start_time);
  }

  hasRepeatData(): boolean {
    return this.formData.repeat_enabled === true;
  }

  // ── Repeat dialog ───────────────────────────────────────────────────────────

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

  // ── Service change ──────────────────────────────────────────────────────────

  private resolveServiceKey(serviceId: number): string {
    if (!serviceId) return '';
    const opts = this.serviceOptions();
    if (opts.find(o => o.value === `pack_${serviceId}`)) return `pack_${serviceId}`;
    return `svc_${serviceId}`;
  }

  onServiceChange() {
    const option = this.serviceOptions().find(o => o.value === this.selectedServiceKey);
    if (option) {
      const isPack = this.selectedServiceKey.startsWith('pack_');
      this.formData.service_id      = isPack ? 0 : option._id;
      this.formData.service_pack_id = isPack ? option._id : null;
      this.formData.duration_minutes = option.duration_minutes;
      this.formData.price            = Number(option.price) || 0;
    }
  }

  onLocationChange(): void {
    this.formData.provider_id = null;
    this.loadingProviders.set(true);
    this.apiService.getProviders({ location_id: this.formData.location_id }).subscribe({
      next: (data) => { this.providers.set(data); this.loadingProviders.set(false); },
      error: (err) => { this.httpError.handle(err, 'cargar profesionales'); this.loadingProviders.set(false); },
    });
  }

  onClientFilter(): void {}

  // ── Save ────────────────────────────────────────────────────────────────────

  onSave() {
    if (!this.formData.client_id) {
      this.messageService.add({ severity: 'warn', summary: this.lang.t('toast.patient_required.summary'), detail: this.lang.t('toast.patient_required.detail'), life: 4000 });
      return;
    }
    if (!this.isFormValid()) return;
    this.saving.set(true);

    const startDate = new Date(this.formData.start_time);

    const bookingData: CreateBooking = {
      client_id:               this.formData.client_id,
      provider_id:             this.formData.provider_id || undefined,
      location_id:             this.formData.location_id,
      status_id:               this.formData.status_id,
      start_time:              this.formatDateTime(startDate),
      custom_duration_minutes: this.formData.duration_minutes || undefined,
      notes:                   this.formData.notes || undefined,
    };

    if (this.formData.service_pack_id) {
      bookingData.service_pack_id = this.formData.service_pack_id;
    } else {
      bookingData.service_id = this.formData.service_id;
      bookingData.price      = this.formData.price;
    }

    if (this.formData.repeat_enabled) {
      const repeat: BookingRepeat = {
        enabled:  true,
        type:     this.formData.repeat_type,
        days:     this.formData.repeat_days,
        interval: this.formData.repeat_interval,
        end_type: this.formData.repeat_end_type,
        count:    this.formData.repeat_count,
        until:    this.formData.repeat_until ? this.formatDateTime(this.formData.repeat_until) : undefined,
      };
      bookingData.repeat = repeat;
    }

    const request = this.isEdit()
      ? this.apiService.updateBooking(this.formData.id!, bookingData)
      : this.apiService.createBooking(bookingData);

    request.subscribe({
      next: (saved: Booking) => {
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t(this.isEdit() ? 'toast.booking_updated.summary' : 'toast.booking_created.summary'),
          detail:  this.lang.t(this.isEdit() ? 'toast.booking_updated.detail'  : 'toast.booking_created.detail'),
        });
        this.visible = false;
        this.saving.set(false);
        this.bookingUpdate.notify(saved);
        this.onSaved.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.handleApiError(err);
      },
    });
  }

  saveClient(form?: NgForm) {
    if (form) {
      form.form.markAllAsTouched();
      if (form.invalid) return;
    }
    this.apiService
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
            detail:  this.lang.t('toast.client_created.detail'),
          });
          this.showPatientPanel = false;
          this.formData.client_id = client.id;
          this.dataCache.invalidateCacheEntries(CACHE_KEYS.CLIENTS);
          this.loadFormData();
        },
        error: (err) => {
          this.httpError.handle(err, 'crear cliente');
        },
      });
  }

  private handleApiError(err: HttpErrorResponse): void {
    this.httpError.handle(err, 'guardar reserva');
  }

  private formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().replace('T', ' ').substring(0, 19);
  }

  // ── Service creation panel ───────────────────────────────────────────────────

  openServicePanel(): void {
    this.newService = { name: '', price: 0, duration_minutes: 60 };
    this.showPatientPanel = false;
    this.showServicePanel = true;
  }

  closeServicePanel(): void {
    this.showServicePanel = false;
  }

  // ── Patient creation panel ──────────────────────────────────────────────────

  openPatientPanel(): void {
    this.newClient = { first_name: '', last_name: '', email: '', phone: '', rut: '' };
    this.showServicePanel = false;
    this.showPatientPanel = true;
  }

  closePatientPanel(): void {
    this.showPatientPanel = false;
    this.newClient = { first_name: '', last_name: '', email: '', phone: '', rut: '' };
  }

  saveNewService(): void {
    if (!this.newService.name || !this.newService.duration_minutes) return;
    this.savingService.set(true);
    this.apiService.createService(this.newService).subscribe({
      next: (service) => {
        this.messageService.add({ severity: 'success', summary: this.lang.t('toast.service_created.summary'), detail: service.name, life: 3000 });
        this.dataCache.invalidateCacheEntries(CACHE_KEYS.SERVICES);
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
