import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageService } from 'primeng/api';
import { Booking, Client, Service, Provider, Location } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';

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

interface ApiErrorResponse {
  error: string;
  detail: string;
  conflicts_with?: {
    id: number;
    start_time: string;
    end_time: string;
  };
}

@Component({
  selector: 'app-booking-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    InputTextModule,
    InputTextareaModule,
    InputNumberModule,
    ButtonModule,
    DialogModule,
    DatePickerModule,
    FloatLabelModule
  ],
  template: `
    <p-dialog
      [header]="isEdit() ? 'Editar Reserva' : 'Nueva Reserva'"
      [(visible)]="visible"
      [modal]="true"
      [style]="{width: '500px'}"
      [draggable]="false"
      [resizable]="false"
      (onHide)="onClose()">
      
      <div class="form-grid">
        <!-- Cliente -->
        <div class="field">
          <p-select
            [options]="clientOptions()"
            [(ngModel)]="formData.client_id"
            placeholder="Seleccionar cliente"
            [filter]="true"
            filterPlaceholder="Buscar..."
            styleClass="w-full"
            (onChange)="onClientChange()">
          </p-select>
          <small *ngIf="errors['client_id']" class="p-error">{{ errors['client_id'] }}</small>
        </div>

        <!-- Servicio -->
        <div class="field">
          <p-select
            [options]="serviceOptions()"
            [(ngModel)]="formData.service_id"
            placeholder="Seleccionar servicio"
            styleClass="w-full"
            (onChange)="onServiceChange()">
          </p-select>
          <small *ngIf="errors['service_id']" class="p-error">{{ errors['service_id'] }}</small>
        </div>

        <!-- Ubicación -->
        <div class="field">
          <p-select
            [options]="locationOptions()"
            [(ngModel)]="formData.location_id"
            placeholder="Seleccionar ubicación"
            styleClass="w-full"
            (onChange)="onLocationChange()">
          </p-select>
          <small *ngIf="errors['location_id']" class="p-error">{{ errors['location_id'] }}</small>
        </div>

        <!-- Profesional (nullable) -->
        <div class="field">
          <p-select
            [options]="providerOptions()"
            [(ngModel)]="formData.provider_id"
            placeholder="Seleccionar profesional (opcional)"
            [showClear]="true"
            styleClass="w-full"
            (onChange)="onProviderChange()">
          </p-select>
        </div>

        <!-- Fecha y Hora -->
        <div class="field-row">
          <div class="field">
            <p-floatlabel>
              <input pDatePicker [(ngModel)]="formData.start_time" dateFormat="dd/mm/yy" [showTime]="true" hourFormat="24" styleClass="w-full" (onClose)="onStartTimeChange()" inputId="startTime" />
              <label for="startTime">Fecha y hora</label>
            </p-floatlabel>
          </div>
          
          <div class="field">
            <p-floatlabel>
              <input pInputNumber [(ngModel)]="formData.duration_minutes" [min]="15" [max]="240" styleClass="w-full" (onInput)="onDurationChange()" inputId="duration" />
              <label for="duration">Duración (min)</label>
            </p-floatlabel>
          </div>
        </div>

        <!-- Estado -->
        <div class="field" *ngIf="isEdit()">
          <p-select
            [options]="statusOptions()"
            [(ngModel)]="formData.status_id"
            placeholder="Estado"
            styleClass="w-full">
          </p-select>
        </div>

        <!-- Precio -->
        <div class="field">
          <p-floatlabel>
            <input pInputNumber [(ngModel)]="formData.price" mode="currency" currency="USD" locale="es-CO" styleClass="w-full" inputId="price" />
            <label for="price">Precio</label>
          </p-floatlabel>
        </div>

        <!-- Notas -->
        <div class="field">
          <textarea pInputTextarea [(ngModel)]="formData.notes" rows="3" placeholder="Notas adicionales" class="w-full"></textarea>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="dialog-footer">
          <p-button 
            *ngIf="isEdit() && canCancel()"
            label="Cancelar Reserva" 
            icon="pi pi-times" 
            styleClass="p-button-danger p-button-outlined"
            (onClick)="onCancel()">
          </p-button>
          
          <div class="spacer"></div>
          
          <p-button 
            label="Cerrar" 
            styleClass="p-button-text"
            (onClick)="onClose()">
          </p-button>
          
          <p-button 
            [label]="isEdit() ? 'Actualizar' : 'Crear'" 
            icon="pi pi-check"
            [loading]="saving()"
            [disabled]="!isFormValid()"
            (onClick)="onSave()">
          </p-button>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .form-grid {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .field-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .w-full {
      width: 100%;
    }

    .p-error {
      font-size: 0.75rem;
    }

    .dialog-footer {
      display: flex;
      gap: 0.5rem;
      width: 100%;
    }

    .spacer {
      flex: 1;
    }
  `],
  providers: [MessageService]
})
export class BookingDialogComponent implements OnInit {
  private api = inject(ApiService);
  private messageService = inject(MessageService);

  visible = false;
  saving = signal(false);
  isEdit = signal(false);

  // Options
  clients = signal<Client[]>([]);
  services = signal<Service[]>([]);
  providers = signal<Provider[]>([]);
  locations = signal<Location[]>([]);
  statuses = signal<{label: string; value: number}[]>([
    { label: 'Pendiente', value: 1 },
    { label: 'Confirmado', value: 2 },
    { label: 'Completado', value: 3 },
    { label: 'Cancelado', value: 4 }
  ]);

  formData: BookingFormData = this.getEmptyForm();
  errors: Record<string, string> = {};

  // Callbacks
  onSuccessCallback?: () => void;
  onCancelCallback?: () => void;

  clientOptions = computed(() => this.clients().map(c => ({
    label: `${c.first_name} ${c.last_name}`,
    value: c.id
  })));

  serviceOptions = computed(() => this.services().map(s => ({
    label: `${s.name} (${s.duration_minutes} min) - $${s.price}`,
    value: s.id
  })));

  providerOptions = computed(() => [
    { label: 'Sin asignar', value: null },
    ...this.providers().map(p => ({
      label: `${p.first_name} ${p.last_name}`,
      value: p.id
    }))
  ]);

  locationOptions = computed(() => this.locations().map(l => ({
    label: l.name,
    value: l.id
  })));

  statusOptions = computed(() => this.statuses().map(s => ({
    label: s.label,
    value: s.value
  })));

  ngOnInit() {
    this.loadData();
  }

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
      notes: ''
    };
  }

  async loadData() {
    // Load clients
    this.api.getClients({ per_page: 500 }).subscribe({
      next: (res) => this.clients.set((res as any).data || res),
      error: () => this.clients.set([])
    });

    // Load services
    this.api.getServices().subscribe({
      next: (data) => this.services.set(data),
      error: () => this.services.set([])
    });

    // Load providers
    this.api.getProviders().subscribe({
      next: (data) => this.providers.set(data),
      error: () => this.providers.set([])
    });

    // Load locations
    this.api.getLocations().subscribe({
      next: (data) => this.locations.set(data),
      error: () => this.locations.set([])
    });
  }

  openNew(booking?: Booking) {
    this.errors = {};
    this.isEdit.set(false);
    
    if (booking) {
      this.isEdit.set(true);
      this.formData = {
        id: booking.id,
        client_id: booking.client_id,
        service_id: booking.service_id,
        provider_id: booking.provider_id || null,
        location_id: booking.location_id,
        status_id: booking.status_id,
        start_time: new Date(booking.start_time),
        end_time: new Date(booking.end_time),
        duration_minutes: booking.custom_duration_minutes || 60,
        price: booking.price,
        notes: booking.notes || ''
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

  onClientChange() { delete this.errors['client_id']; }
  onServiceChange() {
    delete this.errors['service_id'];
    // Auto-fill duration and price from service
    const service = this.services().find(s => s.id === this.formData.service_id);
    if (service) {
      this.formData.duration_minutes = service.duration_minutes;
      this.formData.price = service.price;
    }
  }
  onProviderChange() { delete this.errors['provider_id']; }
  onLocationChange() { delete this.errors['location_id']; }
  
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
      provider_id: this.formData.provider_id,
      location_id: this.formData.location_id,
      status_id: this.formData.status_id,
      start_time: this.formatDateTime(this.formData.start_time),
      end_time: this.formatDateTime(this.formData.end_time),
      duration_minutes: this.formData.duration_minutes,
      price: this.formData.price,
      notes: this.formData.notes
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
            : 'La reserva ha sido creada correctamente'
        });
        this.visible = false;
        this.saving.set(false);
        this.onSuccessCallback?.();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.handleApiError(err);
      }
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
          detail: 'La reserva ha sido cancelada correctamente'
        });
        this.visible = false;
        this.saving.set(false);
        this.onCancelCallback?.();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.handleApiError(err);
      }
    });
  }

  private handleApiError(err: any) {
    const errorData = err.error as ApiErrorResponse;
    
    if (err.status === 409) {
      // Overlap conflict
      this.messageService.add({
        severity: 'warn',
        summary: 'Conflicto de horario',
        detail: errorData?.detail || 'Ya existe una reserva en este horario'
      });
      
      if (errorData?.conflicts_with) {
        this.messageService.add({
          severity: 'info',
          summary: 'Reserva Conflictiva',
          detail: `ID: ${errorData.conflicts_with.id} - ${this.formatDateTime(errorData.conflicts_with.start_time)} a ${this.formatDateTime(errorData.conflicts_with.end_time)}`
        });
      }
    } else if (err.status === 422) {
      // Validation errors
      if (errorData?.detail) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error de validación',
          detail: errorData.detail
        });
      }
    } else if (err.status === 401) {
      this.messageService.add({
        severity: 'error',
        summary: 'No autorizado',
        detail: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
      });
    } else if (err.status === 403) {
      this.messageService.add({
        severity: 'error',
        summary: 'Acceso denegado',
        detail: 'No tienes permisos para realizar esta acción.'
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Ha ocurrido un error al procesar la solicitud.'
      });
    }
  }

  private formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().replace('T', ' ').substring(0, 19);
  }
}