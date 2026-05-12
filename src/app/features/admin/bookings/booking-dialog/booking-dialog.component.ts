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
import { MessageService } from 'primeng/api';
import { Booking, Client, Service, Provider, Location } from '../../../../core/models';
import { ApiService } from '../../../../core/services/api.service';
import { HttpErrorService } from '../../../../core/services/http-error.service';
import { DataCacheService, CACHE_KEYS, CACHE_TTL } from '../../../../core/services/data-cache.service';
import { ApiErrorResponse } from '../interfaces/booking-form-data.interface';

export interface BookingFormData {
  id?: number;
  client_id: number;
  service_id: number;
  provider_id: number | null;
  location_id: number;
  status_id: number;
  start_time: Date;
  end_time: Date;
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
  ],
  templateUrl: './booking-dialog.component.html',
  styleUrl: './booking-dialog.component.scss',
})
export class BookingDialogComponent implements OnInit {
  private api        = inject(ApiService);
  private httpError  = inject(HttpErrorService);
  private dataCache  = inject(DataCacheService);
  private messageService = inject(MessageService);

  visible = false;
  saving = signal(false);
  isEdit = signal(false);

  // Options
  clients = signal<Client[]>([]);
  services = signal<Service[]>([]);
  providers = signal<Provider[]>([]);
  locations = signal<Location[]>([]);
  statuses = signal<{ label: string; value: number }[]>([
    { label: 'Pendiente', value: 1 },
    { label: 'Confirmado', value: 2 },
    { label: 'Completado', value: 3 },
    { label: 'Cancelado', value: 4 },
  ]);

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
      label: `${s.name} (${s.duration_minutes} min) - $${s.price}`,
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
    this.statuses().map((s) => ({
      label: s.label,
      value: s.value,
    })),
  );

  ngOnInit() { /* datos cargados al abrir, no al montar */ }

  private getEmptyForm(): BookingFormData {
    return {
      client_id: 0,
      service_id: 0,
      provider_id: null,
      location_id: 0,
      status_id: 1,
      start_time: new Date(),
      end_time: new Date(),
      duration_minutes: 60,
      price: 0,
      notes: '',
    };
  }

  loadFormData(): void {
    this.dataCache.getOrFetchResource(CACHE_KEYS.CLIENTS,   () => this.api.getClients({ per_page: 500 }), CACHE_TTL.CLIENTS)
      .subscribe({ next: d => this.clients.set(d),   error: () => this.clients.set([]) });
    this.dataCache.getOrFetchResource(CACHE_KEYS.SERVICES,  () => this.api.getServices(),                 CACHE_TTL.SERVICES)
      .subscribe({ next: d => this.services.set(d),  error: () => this.services.set([]) });
    this.dataCache.getOrFetchResource(CACHE_KEYS.PROVIDERS, () => this.api.getProviders(),                CACHE_TTL.PROVIDERS)
      .subscribe({ next: d => this.providers.set(d), error: () => this.providers.set([]) });
    this.dataCache.getOrFetchResource(CACHE_KEYS.LOCATIONS, () => this.api.getLocations(),                CACHE_TTL.LOCATIONS)
      .subscribe({ next: d => this.locations.set(d), error: () => this.locations.set([]) });
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
        service_id: booking.service_id ?? booking.service?.id ?? 0,
        provider_id: booking.provider_id ?? booking.provider?.id ?? 0,
        location_id: booking.location_id ?? booking.location?.id ?? 0,
        status_id: booking.status_id,
        start_time: new Date(booking.start_time),
        end_time: new Date(booking.end_time),
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
      this.formData.service_id &&
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
    // Auto-fill duration and price from service
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
      this.formData.provider_id = null as any;
    }
  }
  onLocationChange() {
    delete this.errors['location_id'];
  }

  onStartTimeChange() {
    const start = this.formData.start_time;
    const duration = this.formData.duration_minutes || 60;
    this.formData.end_time = new Date(start.getTime() + duration * 60000);
  }

  onDurationChange() {
    const start = this.formData.start_time;
    const duration = this.formData.duration_minutes || 60;
    this.formData.end_time = new Date(start.getTime() + duration * 60000);
  }

  onSave() {
    if (!this.isFormValid()) return;

    this.saving.set(true);
    this.errors = {};

    const bookingData = {
      client_id: this.formData.client_id,
      service_id: this.formData.service_id,
      provider_id: this.formData.provider_id || undefined,
      location_id: this.formData.location_id,
      status_id: this.formData.status_id,
      start_time: this.formatDateTime(this.formData.start_time),
      end_time: this.formatDateTime(this.formData.end_time),
      duration_minutes: this.formData.duration_minutes,
      price: this.formData.price,
      notes: this.formData.notes || undefined,
    };

    const request = this.isEdit()
      ? this.api.updateBooking(this.formData.id!, bookingData)
      : this.api.createBooking(bookingData);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.isEdit() ? 'Reserva actualizada' : 'Reserva creada',
          detail: this.isEdit()
            ? 'La reserva ha sido actualizada correctamente'
            : 'La reserva ha sido creada correctamente',
        });
        this.visible = false;
        this.saving.set(false);
        this.onSuccessCallback?.();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.handleApiError(err);
      },
    });
  }

  onCancel() {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;

    this.saving.set(true);

    this.api.cancelBooking(this.formData.id!).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Reserva cancelada',
          detail: 'La reserva ha sido cancelada correctamente',
        });
        this.visible = false;
        this.saving.set(false);
        this.onCancelCallback?.();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.handleApiError(err);
      },
    });
  }

  private handleApiError(err: any): void {
    this.httpError.handle(err);

    // 409: segunda toast con el detalle de la reserva que genera el conflicto
    if (err.status === 409) {
      const conflicts = (err.error as ApiErrorResponse)?.conflicts_with;
      if (conflicts) {
        this.messageService.add({
          severity: 'info',
          summary: 'Reserva conflictiva',
          detail: `ID ${conflicts.id} · ${this.formatDateTime(conflicts.start_time)} → ${this.formatDateTime(conflicts.end_time)}`,
          life: 9000,
        });
      }
    }
  }

  private formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().replace('T', ' ').substring(0, 19);
  }
}
