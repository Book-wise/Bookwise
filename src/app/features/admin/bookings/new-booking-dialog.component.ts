import { Component, inject, OnInit, signal, computed, Input, Output, EventEmitter } from '@angular/core';
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
import { AccordionModule } from 'primeng/accordion';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { Booking, Client, Service, ServicePack, Location, Provider } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';

export interface BookingFormData {
  id?: number;
  client_id: number;
  service_id: number;
  provider_id: number | null;
  location_id: number;
  status_id: number;
  start_time: Date;
  duration_minutes: number;
  price: number;
  notes: string;
  internal_notes?: string;
  // Repeat options
  repeat_enabled?: boolean;
  repeat_type?: 'daily' | 'weekly' | 'monthly';
  repeat_days?: number[];
  repeat_interval?: number;
  repeat_end_type?: 'never' | 'after' | 'until';
  repeat_count?: number;
  repeat_until?: Date;
}

// Status options with colors
const BOOKING_STATUSES = [
  { label: 'Reservado', value: 1, color: '#93c5fd', severity: 'info' as const },
  { label: 'Confirmado', value: 2, color: '#fb923c', severity: 'warn' as const },
  { label: 'Asiste', value: 3, color: '#ec4899', severity: 'help' as const },
  { label: 'No asistio', value: 4, color: '#f9a8d4', severity: 'secondary' as const },
  { label: 'Pendiente', value: 5, color: '#fca5a5', severity: 'danger' as const },
  { label: 'En espera', value: 6, color: '#86efac', severity: 'success' as const },
];

const DAYS_OF_WEEK = [
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mie', value: 3 },
  { label: 'Jue', value: 4 },
  { label: 'Vie', value: 5 },
  { label: 'Sab', value: 6 },
  { label: 'Dom', value: 0 },
];

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
  selector: 'app-new-booking-dialog',
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
    AccordionModule,
    CheckboxModule
  ],
  template: `
    <!-- Main Dialog -->
    <p-dialog
      [header]="dialogTitle()"
      [(visible)]="visible"
      [modal]="true"
      [style]="{width: '720px', maxWidth: '95vw'}"
      [contentStyle]="{'overflow': 'visible'}"
      [draggable]="false"
      [resizable]="false"
      (onHide)="onClose()">

      <div class="dialog-content">

        <!-- Status Selector (always visible) -->
        <div class="field">
          <label class="field-label">Estado</label>
          <p-select
            [options]="statusOptions()"
            [(ngModel)]="formData.status_id"
            optionLabel="label"
            optionValue="value"
            styleClass="w-full">
            <ng-template pTemplate="item" let-status>
              <div class="status-option">
                <span class="status-dot" [style.backgroundColor]="status.color"></span>
                <span>{{ status.label }}</span>
              </div>
            </ng-template>
            <ng-template pTemplate="selectedItem" let-status>
              <div class="status-option">
                <span class="status-dot" [style.backgroundColor]="status.color"></span>
                <span>{{ status.label }}</span>
              </div>
            </ng-template>
          </p-select>
        </div>

        <!-- Date and Time Section -->
        <div class="datetime-section">
          <div class="date-field">
            <label class="field-label">Fecha y hora</label>
            <p-datepicker [(ngModel)]="formData.start_time" dateFormat="dd/mm/yy" [showTime]="true" hourFormat="24" inputId="bookingDate" styleClass="w-full" [appendTo]="'body'" />
          </div>

          <div class="repeat-toggle">
            <label class="field-label">&nbsp;</label>
            <p-button
              [label]="formData.repeat_enabled ? 'Repeticion On' : 'Repetir'"
              [icon]="formData.repeat_enabled ? 'pi pi-check' : 'pi pi-plus'"
              [outlined]="!formData.repeat_enabled"
              size="small"
              (onClick)="openRepeatDialog()">
            </p-button>
          </div>
        </div>

        <!-- Client/Patient Section -->
        <div class="field">
          <label class="field-label">Paciente</label>
          <p-select
            [options]="clientOptions()"
            [(ngModel)]="formData.client_id"
            placeholder="Buscar por nombre, apellido, rut, email"
            [filter]="true"
            filterPlaceholder="Buscar..."
            showClear="true"
            styleClass="w-full"
            (onFilter)="onClientFilter($event)">
            <ng-template pTemplate="item" let-client>
              <div class="client-option">
                <span class="client-name">{{ client.first_name }} {{ client.last_name }}</span>
                <span class="client-email">{{ client.email }}</span>
              </div>
            </ng-template>
          </p-select>
          <p-button label="+" icon="pi pi-plus" styleClass="p-button-text p-button-sm" (onClick)="showAddClient = true"></p-button>
        </div>

        <!-- Provider Section -->
        <div class="field">
          <label class="field-label">Profesional</label>
          <p-select
            [options]="providerOptions()"
            [(ngModel)]="formData.provider_id"
            placeholder="Seleccionar profesional"
            [showClear]="true"
            styleClass="w-full">
            <ng-template pTemplate="item" let-provider>
              <span>{{ provider.first_name }} {{ provider.last_name }}</span>
            </ng-template>
          </p-select>
        </div>

        <!-- Service/Pack Section -->
        <div class="field">
          <label class="field-label">Servicios</label>
          <p-select
            [options]="serviceOptions()"
            [(ngModel)]="formData.service_id"
            placeholder="Seleccionar servicio o pack"
            [filter]="true"
            filterPlaceholder="Buscar..."
            styleClass="w-full"
            (onChange)="onServiceChange()">
            <ng-template pTemplate="item" let-service>
              <div class="service-option">
                <span class="service-name">{{ service.name }}</span>
                <span class="service-duration">{{ service.duration_minutes }} min</span>
              </div>
            </ng-template>
          </p-select>
        </div>

        <!-- Location Section -->
        <div class="field">
          <label class="field-label">Sede / Ubicación</label>
          <p-select
            [options]="locationOptions()"
            [(ngModel)]="formData.location_id"
            placeholder="Seleccionar sede"
            optionLabel="label"
            optionValue="value"
            styleClass="w-full">
          </p-select>
        </div>

        <!-- Additional Info Accordion -->
        <p-accordion value="0">
        <p-accordion-panel value="0">
          <p-accordion-header>Información adicional</p-accordion-header>
          <p-accordion-content>
            <div class="additional-fields">
              <div class="field">
                <p-floatlabel>
                  <input pInputNumber [(ngModel)]="formData.price" mode="currency" currency="USD" locale="es-CO" inputId="price" styleClass="w-full" />
                  <label for="price">Precio</label>
                </p-floatlabel>
              </div>
              
              <div class="field">
                <label class="field-label">Notas compartidas con el paciente</label>
                <textarea pTextarea [(ngModel)]="formData.notes" rows="2" placeholder="Notas que se comparten con el paciente" class="w-full"></textarea>
              </div>
              
              <div class="field">
                <label class="field-label">Nota interna</label>
                <textarea pTextarea [(ngModel)]="formData.internal_notes" rows="2" placeholder="Notas internas (no se muestran al paciente)" class="w-full"></textarea>
              </div>
            </div>
          </p-accordion-content>
        </p-accordion-panel>
      </p-accordion>

      </div><!-- end dialog-content -->

      <ng-template pTemplate="footer">
        <div class="dialog-footer">
          <p-button 
            [label]="hasRepeatData() ? 'Guardar repetición' : 'Guardar reserva'" 
            icon="pi pi-check"
            [loading]="saving()"
            [disabled]="!isFormValid()"
            (onClick)="onSave()">
          </p-button>
        </div>
      </ng-template>
    </p-dialog>

    <!-- Repeat Dialog -->
    <p-dialog
      header="Se repite"
      [(visible)]="showRepeatDialog"
      [modal]="true"
      [style]="{width: '450px'}"
      [draggable]="false"
      [resizable]="false">
      
      <!-- Days of Week Selection -->
      <div class="repeat-days">
        <label class="section-label">Días de la semana</label>
        <div class="days-buttons">
          <p-button 
            *ngFor="let day of daysOfWeek"
            [label]="day.label"
            [styleClass]="isDaySelected(day.value) ? 'p-button-primary' : 'p-button-outlined'"
            size="small"
            (onClick)="toggleDay(day.value)">
          </p-button>
        </div>
      </div>

      <!-- Repeat Type -->
      <div class="repeat-type">
        <label class="section-label">Repetir</label>
        <div class="repeat-options">
          <p-button 
            label="Diariamente"
            [styleClass]="formData.repeat_type === 'daily' ? 'p-button-primary' : 'p-button-outlined'"
            size="small"
            (onClick)="setRepeatType('daily')">
          </p-button>
          <p-button 
            label="Semanalmente"
            [styleClass]="formData.repeat_type === 'weekly' ? 'p-button-primary' : 'p-button-outlined'"
            size="small"
            (onClick)="setRepeatType('weekly')">
          </p-button>
          <p-button 
            label="Mensualmente"
            [styleClass]="formData.repeat_type === 'monthly' ? 'p-button-primary' : 'p-button-outlined'"
            size="small"
            (onClick)="setRepeatType('monthly')">
          </p-button>
        </div>

        <div class="repeat-each" *ngIf="formData.repeat_type">
          <label>Cada</label>
          <p-inputNumber [(ngModel)]="formData.repeat_interval" [min]="1" styleClass="interval-input" />
          <span class="repeat-label">
            {{ formData.repeat_type === 'daily' ? 'días' : 
               formData.repeat_type === 'weekly' ? 'semanas' : 'meses' }}
          </span>
        </div>
      </div>

      <!-- End Section -->
      <div class="repeat-end">
        <label class="section-label">Finaliza</label>
        
        <div class="end-option">
          <p-checkbox [(ngModel)]="repeatAfterChecked" [binary]="true" inputId="repeatAfter" />
          <label for="repeatAfter">Después de</label>
          <p-inputNumber [(ngModel)]="formData.repeat_count" [min]="1" [disabled]="!repeatAfterChecked" styleClass="count-input" />
          <span>repeticiones (incluida la original)</span>
        </div>

        <div class="end-option">
          <p-checkbox [(ngModel)]="repeatUntilChecked" [binary]="true" inputId="repeatUntil" />
          <label for="repeatUntil">Hasta la fecha</label>
          <p-datepicker [(ngModel)]="formData.repeat_until" dateFormat="dd/mm/yy" [disabled]="!repeatUntilChecked" styleClass="until-input" [appendTo]="'body'" />
        </div>
      </div>

      <ng-template pTemplate="footer">
        <p-button label="Cerrar" styleClass="p-button-text" (onClick)="showRepeatDialog = false"></p-button>
        <p-button label="Aplicar" icon="pi pi-check" (onClick)="applyRepeat()"></p-button>
      </ng-template>
    </p-dialog>

    <!-- Add Client Dialog -->
    <p-dialog
      header="Nuevo Paciente"
      [(visible)]="showAddClient"
      [modal]="true"
      [style]="{width: '400px'}">
      
      <div class="add-client-form">
        <div class="field">
          <label>Nombre</label>
          <input pInputText [(ngModel)]="newClient.first_name" class="w-full" />
        </div>
        <div class="field">
          <label>Apellido</label>
          <input pInputText [(ngModel)]="newClient.last_name" class="w-full" />
        </div>
        <div class="field">
          <label>Email</label>
          <input pInputText [(ngModel)]="newClient.email" type="email" class="w-full" />
        </div>
        <div class="field">
          <label>Teléfono</label>
          <input pInputText [(ngModel)]="newClient.phone" class="w-full" />
        </div>
      </div>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" styleClass="p-button-text" (onClick)="showAddClient = false"></p-button>
        <p-button label="Guardar" icon="pi pi-check" (onClick)="saveClient()"></p-button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .status-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .datetime-section {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 1rem;
      align-items: end;
    }

    .repeat-toggle {
      align-self: end;
      display: flex;
      flex-direction: column;
    }

    .field {
      display: flex;
      flex-direction: column;
    }

    .field-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      display: block;
      margin-bottom: 0.5rem;
    }

    .client-option, .service-option {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .client-name, .service-name {
      font-weight: 500;
    }

    .client-email, .service-duration {
      font-size: 0.75rem;
      color: #6b7280;
    }

    .additional-fields .field {
      margin-bottom: 0.75rem;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      width: 100%;
    }

    .section-label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .repeat-days {
      margin-bottom: 1.5rem;
    }

    .days-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .repeat-type {
      margin-bottom: 1.5rem;
    }

    .repeat-options {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .repeat-each {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .interval-input {
      width: 60px;
    }

    .repeat-label {
      color: #6b7280;
    }

    .repeat-end {
      margin-bottom: 1rem;
    }

    .end-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .count-input {
      width: 60px;
    }

    .until-input {
      width: 120px;
    }

    .w-full {
      width: 100%;
    }

  `],
  providers: [MessageService]
})
export class NewBookingDialogComponent implements OnInit {
  private apiService = inject(ApiService);
  private messageService = inject(MessageService);

  @Input() initialDate?: Date;
  @Output() onSaved = new EventEmitter<void>();
  @Output() onCancelled = new EventEmitter<void>();

  visible = false;
  saving = signal(false);
  isEdit = signal(false);
  showRepeatDialog = false;
  showAddClient = false;

  // Form data
  formData: BookingFormData = this.getEmptyForm();
  timeHour = 9;
  timeMinute = 0;

  newClient = {
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  };

  repeatAfterChecked = false;
  repeatUntilChecked = false;

  // Options
  clients = signal<Client[]>([]);
  services = signal<(Service | ServicePack)[]>([]);
  providers = signal<Provider[]>([]);
  locations = signal<Location[]>([]);

  // Callbacks
  onSuccessCallback?: () => void;

  clientOptions = computed(() => this.clients().map(c => ({
    label: `${c.first_name} ${c.last_name}`,
    value: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email
  })));

  providerOptions = computed(() => [
    { label: 'Sin asignar', value: null as any },
    ...this.providers().map(p => ({
      label: `${p.first_name} ${p.last_name}`,
      value: p.id
    }))
  ]);

  serviceOptions = computed(() => this.services().map((s: any) => ({
    label: `${s.name} (${s.duration_minutes || 60} min)`,
    value: s.id,
    name: s.name,
    duration_minutes: s.duration_minutes || 60,
    price: s.price || 0
  })));

  locationOptions = computed(() => this.locations().map(l => ({ label: l.name, value: l.id })));

  statusOptions = computed(() => BOOKING_STATUSES);

  daysOfWeek = DAYS_OF_WEEK;

  dialogTitle = computed(() => this.isEdit() ? 'Editar Reserva' : 'Nueva Reserva');

  ngOnInit() {
    this.loadData();
  }

  private getEmptyForm(): BookingFormData {
    const now = this.initialDate || new Date();
    this.timeHour = now.getHours();
    this.timeMinute = Math.round(now.getMinutes() / 5) * 5;
    
    return {
      client_id: 0,
      service_id: 0,
      provider_id: null,
      location_id: 1,
      status_id: 1, // Reservado
      start_time: now,
      duration_minutes: 60,
      price: 0,
      notes: '',
      internal_notes: '',
      repeat_enabled: false,
      repeat_type: undefined,
      repeat_days: [],
      repeat_interval: 1,
      repeat_end_type: 'never',
      repeat_count: 1,
      repeat_until: undefined
    };
  }

  async loadData() {
    // Load clients
    this.apiService.getClients({ per_page: 100 }).subscribe({
      next: (res) => this.clients.set((res as any).data || res),
      error: () => this.clients.set([])
    });

    // Load services
    this.apiService.getServices().subscribe({
      next: (data) => this.services.set(data),
      error: () => this.services.set([])
    });

    // Load packs
    this.apiService.getPacks().subscribe({
      next: (data) => this.services.update(current => [...current, ...data]),
      error: () => {}
    });

    // Load providers
    this.apiService.getProviders().subscribe({
      next: (data) => this.providers.set(data),
      error: () => this.providers.set([])
    });

    // Load locations
    this.apiService.getLocations().subscribe({
      next: (data) => this.locations.set(data),
      error: () => this.locations.set([])
    });
  }

  openNew(booking?: Booking, initialDate?: Date) {
    this.resetForm();
    
    if (booking) {
      this.isEdit.set(true);
      const startDate = new Date(booking.start_time);
      this.formData = {
        id: booking.id,
        client_id: booking.client_id,
        service_id: booking.service_id,
        provider_id: booking.provider_id || null,
        location_id: booking.location_id,
        status_id: booking.status_id,
        start_time: startDate,
        duration_minutes: booking.custom_duration_minutes || 60,
        price: booking.price,
        notes: booking.notes || ''
      };
      this.timeHour = startDate.getHours();
      this.timeMinute = startDate.getMinutes();
    } else if (initialDate) {
      // Usar la fecha seleccionada del calendario
      this.formData.start_time = initialDate;
      this.timeHour = initialDate.getHours();
      this.timeMinute = Math.round(initialDate.getMinutes() / 5) * 5;
    }
    
    this.visible = true;
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

  isFormValid(): boolean {
    return !!(
      this.formData.client_id &&
      this.formData.service_id &&
      this.formData.start_time
    );
  }

  hasRepeatData(): boolean {
    return this.formData.repeat_enabled === true;
  }

  isDaySelected(dayValue: number): boolean {
    return this.formData.repeat_days?.includes(dayValue) || false;
  }

  toggleDay(dayValue: number) {
    if (!this.formData.repeat_days) {
      this.formData.repeat_days = [];
    }
    
    const index = this.formData.repeat_days.indexOf(dayValue);
    if (index >= 0) {
      this.formData.repeat_days.splice(index, 1);
    } else {
      this.formData.repeat_days.push(dayValue);
    }
  }

  setRepeatType(type: 'daily' | 'weekly' | 'monthly') {
    this.formData.repeat_type = type;
  }

  openRepeatDialog() {
    this.showRepeatDialog = true;
  }

  applyRepeat() {
    this.formData.repeat_enabled = true;
    
    if (this.repeatAfterChecked) {
      this.formData.repeat_end_type = 'after';
      this.formData.repeat_count = this.formData.repeat_count || 1;
    } else if (this.repeatUntilChecked) {
      this.formData.repeat_end_type = 'until';
    } else {
      this.formData.repeat_end_type = 'never';
    }
    
    this.showRepeatDialog = false;
  }

  onTimeChange() {
    const date = new Date(this.formData.start_time);
    date.setHours(this.timeHour, this.timeMinute, 0, 0);
    this.formData.start_time = date;
  }

  onServiceChange() {
    const service = this.services().find(s => s.id === this.formData.service_id);
    if (service) {
      this.formData.duration_minutes = service.duration_minutes || 60;
      this.formData.price = service.price || 0;
    }
  }

  onClientFilter(event: any) {
    // Client filtering is handled by PrimeNG Select's built-in filter
  }

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
      notes: this.formData.notes || undefined
    };

    // Add repeat data if enabled
    if (this.formData.repeat_enabled) {
      bookingData.repeat = {
        enabled: true,
        type: this.formData.repeat_type,
        days: this.formData.repeat_days,
        interval: this.formData.repeat_interval,
        end_type: this.formData.repeat_end_type,
        count: this.formData.repeat_count,
        until: this.formData.repeat_until ? this.formatDateTime(this.formData.repeat_until) : undefined
      };
    }

    const request = this.isEdit()
      ? this.apiService.updateBooking(this.formData.id!, bookingData)
      : this.apiService.createBooking(bookingData);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.isEdit() ? 'Reserva actualizada' : 'Reserva creada',
          detail: this.isEdit() ? 'La reserva ha sido actualizada correctamente' : 'La reserva ha sido creada correctamente'
        });
        this.visible = false;
        this.saving.set(false);
        this.onSaved.emit();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.handleApiError(err);
      }
    });
  }

  saveClient() {
    this.apiService.createClient({
      first_name: this.newClient.first_name,
      last_name: this.newClient.last_name,
      email: this.newClient.email,
      phone: this.newClient.phone
    }).subscribe({
      next: (client) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Cliente creado',
          detail: 'El nuevo cliente ha sido registrado correctamente'
        });
        this.showAddClient = false;
        this.formData.client_id = client.id;
        this.loadData();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo crear el cliente'
        });
      }
    });
  }

  private handleApiError(err: any) {
    const errorData = err.error as ApiErrorResponse;
    
    if (err.status === 409) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Conflicto de horario',
        detail: errorData?.detail || 'Ya existe una reserva en este horario'
      });
    } else if (err.status === 422) {
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
        detail: 'Tu sesión ha expirado'
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Ha ocurrido un error al procesar la solicitud'
      });
    }
  }

  private formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().replace('T', ' ').substring(0, 19);
  }
}