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
import { Booking, Client, Service, ServicePack, Location, Provider } from '../../../../core/models';
import { ApiService } from '../../../../core/services/api.service';
import { HttpErrorService } from '../../../../core/services/http-error.service';
import { BookingFormData } from '../interfaces/booking-form-data.interface';
import { BOOKING_STATUSES } from '../constants/booking-statuses';
import { DAYS_OF_WEEK, REPEAT_TYPE_OPTIONS } from '../constants/repeat-options';
import { PhoneInputComponent } from '../../../../shared/components/phone-input/phone-input.component';
import { forkJoin } from 'rxjs';

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
  ],
  templateUrl: './booking-form-dialog.component.html',
  styleUrls: ['./booking-form-dialog.component.scss'],
})
export class BookingFormDialogComponent implements OnInit {
  private apiService    = inject(ApiService);
  private httpError     = inject(HttpErrorService);
  private messageService = inject(MessageService);
  private cdr           = inject(ChangeDetectorRef);

  @Input() initialDate?: Date;
  @Output() onSaved = new EventEmitter<void>();
  @Output() onCancelled = new EventEmitter<void>();

  visible     = false;
  saving      = signal(false);
  loadingData = signal(false);
  isEdit      = signal(false);
  showRepeatDialog = false;
  showAddClient = false;

  formData: BookingFormData = this.getEmptyForm();

  newClient = { first_name: '', last_name: '', email: '', phone: '' };

  repeatAfterChecked = false;
  repeatUntilChecked = false;

  clients = signal<Client[]>([]);
  services = signal<(Service | ServicePack)[]>([]);
  providers = signal<Provider[]>([]);
  locations = signal<Location[]>([]);

  onSuccessCallback?: () => void;

  clientOptions = computed(() =>
    this.clients().map((c) => ({
      label: `${c.first_name} ${c.last_name}`,
      value: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
    })),
  );

  providerOptions = computed(() => [
    { label: 'Sin asignar', value: null as any },
    ...this.providers().map((p) => ({ label: `${p.first_name} ${p.last_name}`, value: p.id })),
  ]);

  serviceOptions = computed(() =>
    this.services().map((s: any) => ({
      label: `${s.name} (${s.duration_minutes || 60} min)`,
      value: s.id,
      name: s.name,
      duration_minutes: s.duration_minutes || 60,
      price: s.price || 0,
    })),
  );

  locationOptions = computed(() => this.locations().map((l) => ({ label: l.name, value: l.id })));

  statusOptions = computed(() => BOOKING_STATUSES);
  daysOfWeek = DAYS_OF_WEEK;
  repeatTypeOptions = REPEAT_TYPE_OPTIONS;
  dialogTitle = computed(() => (this.isEdit() ? 'Editar Reserva' : 'Nueva Reserva'));

  ngOnInit() {
    this.loadData();
  }

  // ── Time input helpers ──────────────────────────────────────────────────────

  getTimeString(): string {
    const d = this.formData.start_time;
    if (!d) return '09:00';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  onTimeInputChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (!val) return;
    const [h, m] = val.split(':').map(Number);
    const d = new Date(this.formData.start_time || new Date());
    d.setHours(h, m, 0, 0);
    this.formData.start_time = d;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  private getEmptyForm(): BookingFormData {
    const now = this.initialDate || new Date();
    return {
      client_id: 0,
      service_id: 0,
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

  loadData(): void {
    this.loadingData.set(true);
    forkJoin({
      clients:   this.apiService.getClients({ per_page: 100 }),
      services:  this.apiService.getServices(),
      packs:     this.apiService.getPacks(),
      providers: this.apiService.getProviders(),
      locations: this.apiService.getLocations(),
    }).subscribe({
      next: ({ clients, services, packs, providers, locations }) => {
        this.clients.set((clients as any).data ?? clients);
        this.services.set([...services, ...packs]);
        this.providers.set(providers);
        this.locations.set(locations);
        this.loadingData.set(false);
      },
      error: (err) => {
        this.httpError.handle(err, 'cargar datos del formulario');
        this.loadingData.set(false);
      },
    });
  }

  openNew(booking?: Booking, initialDate?: Date) {
    this.resetForm();

    if (booking) {
      this.isEdit.set(true);
      const startDate = new Date(booking.start_time);
      this.formData = {
        id: booking.id,
        client_id: booking.client_id ?? booking.client?.id ?? 0,
        service_id: booking.service_id ?? booking.service?.id ?? 0,
        provider_id: booking.provider_id ?? booking.provider?.id ?? null,
        location_id: booking.location_id ?? booking.location?.id ?? 0,
        status_id: booking.status_id,
        start_time: startDate,
        duration_minutes: booking.custom_duration_minutes || 60,
        price: Number(booking.price) || 0,
        notes: booking.notes || '',
      };
    } else if (initialDate) {
      this.formData.start_time = initialDate;
    }

    this.visible = true;
    this.cdr.detectChanges();
  }

  private resetForm() {
    this.formData = this.getEmptyForm();
    this.isEdit.set(false);
    this.showRepeatDialog = false;
    this.showAddClient = false;
    this.repeatAfterChecked = false;
    this.repeatUntilChecked = false;
  }

  onClose() {
    this.visible = false;
    this.resetForm();
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  isFormValid(): boolean {
    return !!(this.formData.client_id && this.formData.service_id && this.formData.start_time);
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

  onServiceChange() {
    const service = this.services().find((s) => s.id === this.formData.service_id);
    if (service) {
      this.formData.duration_minutes = service.duration_minutes || 60;
      this.formData.price = Number(service.price) || 0;
    }
  }

  onClientFilter(_event: any) {}

  // ── Save ────────────────────────────────────────────────────────────────────

  onSave() {
    if (!this.isFormValid()) return;
    this.saving.set(true);

    const startDate = new Date(this.formData.start_time);
    const endDate = new Date(startDate.getTime() + this.formData.duration_minutes * 60000);

    const bookingData: any = {
      client_id: this.formData.client_id,
      service_id: this.formData.service_id,
      provider_id: this.formData.provider_id || undefined,
      location_id: this.formData.location_id,
      status_id: this.formData.status_id,
      start_time: this.formatDateTime(startDate),
      end_time: this.formatDateTime(endDate),
      duration_minutes: this.formData.duration_minutes,
      price: this.formData.price,
      notes: this.formData.notes || undefined,
    };

    if (this.formData.repeat_enabled) {
      bookingData.repeat = {
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
    }

    const request = this.isEdit()
      ? this.apiService.updateBooking(this.formData.id!, bookingData)
      : this.apiService.createBooking(bookingData);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.isEdit() ? '¡Reserva actualizada!' : '¡Reserva creada!',
          detail:   this.isEdit() ? 'Los cambios se guardaron correctamente.' : 'La reserva quedó registrada en la agenda.',
        });
        this.visible = false;
        this.saving.set(false);
        this.onSaved.emit();
      },
      error: (err: any) => {
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
      })
      .subscribe({
        next: (client) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Cliente creado',
            detail: 'El nuevo cliente ha sido registrado correctamente',
          });
          this.showAddClient = false;
          this.formData.client_id = client.id;
          this.loadData();
        },
        error: (err) => {
          this.httpError.handle(err, 'crear cliente');
        },
      });
  }

  private handleApiError(err: any): void {
    this.httpError.handle(err, 'guardar reserva');
  }

  private formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().replace('T', ' ').substring(0, 19);
  }
}
