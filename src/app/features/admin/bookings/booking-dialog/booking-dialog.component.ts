import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { FloatLabelModule } from 'primeng/floatlabel';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { HttpErrorResponse } from '@angular/common/http';
import { Booking, Client, Service, Provider, CreateBooking } from '@models';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { TimezoneService } from '@services/timezone.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { ApiErrorResponse } from '../interfaces/booking-form-data.interface';
import { LanguageService } from '@services/language.service';
import { CURRENCY_CONFIG, formatCLP } from '@shared/config/currency.config';
import { map } from 'rxjs';
import { BookingStore } from '@core/stores/booking.store';

export interface BookingFormData {
  id?: number;
  client_id: number;
  service_id: number;
  service_pack_id?: number | null;
  provider_id: number | null;
  location_id: number;
  status_id: number;
  start_time: Date;
  duration_minutes: number;
  price: number;
  notes: string;
}

@Component({
  selector: 'bw-booking-dialog',
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
    FloatLabelModule,
    SkeletonModule,
  ],
  templateUrl: './booking-dialog.component.html',
  styleUrl: './booking-dialog.component.scss',
})
export class BookingDialogComponent implements OnInit {
  readonly currencyConfig = CURRENCY_CONFIG;

  private api = inject(ApiService);
  private httpError = inject(HttpErrorService);
  private messageService = inject(MessageService);
  readonly lang = inject(LanguageService);
  private readonly store = inject(BookingStore);
  private tzService = inject(TimezoneService);

  /** ReferenceStore: datos maestros */
  private refStore = inject(ReferenceStore);

  visible = false;
  saving = signal(false);
  isEdit = signal(false);

  /** Skeleton visible hasta que el store cargue */
  readonly loading = computed(() => !this.refStore.allLoaded());

  // ── Datos desde ReferenceStore ──────────────────────────────────
  readonly clients = this.refStore.clients;
  readonly services = this.refStore.services;
  readonly providers = this.refStore.providers;
  readonly locations = this.refStore.locations;
  private readonly BD_STATUS_KEYS = [
    { key: 'bd.status.1', value: 1 },
    { key: 'bd.status.2', value: 2 },
    { key: 'bd.status.3', value: 3 },
    { key: 'bd.status.4', value: 4 },
  ];

  formData: BookingFormData = this.getEmptyForm();
  errors: Record<string, string> = {};

  // Callbacks
  onSuccessCallback?: () => void;
  onCancelCallback?: () => void;

  clientOptions = computed(() =>
    this.clients().map((c) => ({
      label: `${c.first_name} ${c.last_name}`,
      value: c.id,
    })),
  );

  serviceOptions = computed(() =>
    this.services().map((s) => ({
      label: `${s.name} (${s.duration_minutes} min) - ${formatCLP(s.price)}`,
      value: s.id,
    })),
  );

  providerOptions = computed(() => {
    const opts = this.providers().map((p) => ({
      label: `${p.first_name} ${p.last_name}`,
      value: p.id,
    }));
    return [{ label: 'Sin asignar', value: 0 }, ...opts];
  });

  locationOptions = computed(() =>
    this.locations().map((l) => ({
      label: l.name,
      value: l.id,
    })),
  );

  statusOptions = computed(() =>
    this.BD_STATUS_KEYS.map((s) => ({ label: this.lang.t(s.key), value: s.value })),
  );

  ngOnInit() {
    /* datos cargados al abrir, no al montar */
  }

  private getEmptyForm(): BookingFormData {
    return {
      client_id: 0,
      service_id: 0,
      service_pack_id: null,
      provider_id: null,
      location_id: 0,
      status_id: 1,
      start_time: new Date(),
      duration_minutes: 60,
      price: 0,
      notes: '',
    };
  }

  /** Los datos vienen reactivamente desde ReferenceStore */
  loadFormData(): void {
    // No-op: el store ya carga todo en onInit
  }

  openNew(booking?: Booking) {
    this.errors = {};
    this.isEdit.set(false);
    this.loadFormData();

    if (booking) {
      this.isEdit.set(true);
      this.formData = {
        id: booking.id,
        client_id: booking.client_id ?? booking.client?.id ?? 0,
        service_id: booking.pack_session?.service_pack_id
          ? 0
          : (booking.service_id ?? booking.service?.id ?? 0),
        service_pack_id: booking.pack_session?.service_pack_id ?? null,
        provider_id: booking.provider_id ?? booking.provider?.id ?? 0,
        location_id: booking.location_id ?? booking.location?.id ?? 0,
        status_id: booking.status_id,
        start_time: new Date(booking.start_time),
        duration_minutes: booking.custom_duration_minutes || 60,
        price: Number(booking.price) || 0,
        notes: booking.notes || '',
      };
    } else {
      this.formData = this.getEmptyForm();
    }

    this.visible = true;
  }

  onClose() {
    this.visible = false;
    this.formData = this.getEmptyForm();
    this.errors = {};
  }

  isFormValid(): boolean {
    return !!(
      this.formData.client_id &&
      (this.formData.service_id || this.formData.service_pack_id) &&
      this.formData.location_id &&
      this.formData.start_time
    );
  }

  canCancel(): boolean {
    return this.isEdit() && this.formData.status_id !== 4;
  }

  onClientChange() {
    delete this.errors['client_id'];
  }
  onServiceChange() {
    delete this.errors['service_id'];
    const service = this.services().find((s) => s.id === this.formData.service_id);
    if (service) {
      this.formData.duration_minutes = service.duration_minutes;
      this.formData.price = Number(service.price) || 0;
    }
  }
  onProviderChange() {
    delete this.errors['provider_id'];
    // 0 means "no provider assigned" - convert to null
    if (this.formData.provider_id === 0) {
      this.formData.provider_id = null;
    }
  }
  onLocationChange() {
    delete this.errors['location_id'];
  }

  onSave() {
    if (!this.isFormValid()) return;

    this.saving.set(true);
    this.errors = {};

    const bookingData: CreateBooking = {
      client_id: this.formData.client_id,
      provider_id: this.formData.provider_id || undefined,
      location_id: this.formData.location_id,
      status_id: this.formData.status_id,
      start_time: this.formatDateTime(this.formData.start_time),
      custom_duration_minutes: this.formData.duration_minutes || undefined,
      notes: this.formData.notes || undefined,
    };
    if (this.formData.service_pack_id) {
      bookingData.service_pack_id = this.formData.service_pack_id;
    } else {
      bookingData.service_id = this.formData.service_id;
      bookingData.price = this.formData.price;
    }

    const request = this.isEdit()
      ? this.api.updateBooking(this.formData.id!, bookingData).pipe(
          map((res) => res.data), // <-- Transforma ApiResponse<Booking> en Booking limpio
        )
      : this.api.createBooking(bookingData);

    request.subscribe({
      next: (saved: Booking) => {
        // 🔥 MUY IMPORTANTE: Inyectamos el cambio en tu Store global aquí mismo
        // para que FullCalendar se entere del cambio de color de inmediato
        this.store.mergeBooking(saved);
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
        this.onSuccessCallback?.();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.handleApiError(err);
      },
    });
  }

  onCancel() {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;

    this.saving.set(true);

    this.api.cancelBooking(this.formData.id!).subscribe({
      next: (cancelled: Booking) => {
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('toast.booking_cancelled.summary'),
          detail: this.lang.t('toast.booking_cancelled.detail'),
          key: 'global',
        });
        this.visible = false;
        this.saving.set(false);
        this.onCancelCallback?.();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.handleApiError(err);
      },
    });
  }

  private handleApiError(err: HttpErrorResponse): void {
    this.httpError.handle(err);
  }

  private formatDateTime(date: Date | string): string {
    return this.tzService.formatDateTime(date);
  }
}
