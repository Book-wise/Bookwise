import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ToastService } from '@shared/components/toast-modal/toast.service';
import {
  AvailabilityService,
  ProviderAvailabilitySlot,
} from '@services/availability.service';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { AuthService } from '@services/auth.service';
import { Location } from '@models';

const DAYS_OF_WEEK = [
  { label: 'Domingo', value: 0 },
  { label: 'Lunes', value: 1 },
  { label: 'Martes', value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves', value: 4 },
  { label: 'Viernes', value: 5 },
  { label: 'Sábado', value: 6 },
];

@Component({
  selector: 'bw-provider-availability',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    SelectModule,
    ToggleSwitchModule,
    TableModule,
    DialogModule,
  ],
  templateUrl: './provider-availability.component.html',
  styleUrls: ['./provider-availability.component.scss'],
})
export class ProviderAvailabilityComponent implements OnInit {
  private toast     = inject(ToastService);
  private httpError = inject(HttpErrorService);
  private availabilityService = inject(AvailabilityService);
  private api  = inject(ApiService);
  private auth = inject(AuthService);

  locations = signal<Location[]>([]);
  availabilitySlots = signal<ProviderAvailabilitySlot[]>([]);
  saving = signal(false);
  showAddDialog = false;

  DAYS_OF_WEEK = DAYS_OF_WEEK;

  newSlot: ProviderAvailabilitySlot = {
    provider_id: 0,
    location_id: 1,
    day_of_week: 1,
    start_time: '09:00',
    end_time: '18:00',
    is_active: true,
  };

  ngOnInit(): void {
    this.loadLocations();
    this.loadAvailability();
  }

  loadLocations(): void {
    this.api.getLocations().subscribe({
      next: (data) => this.locations.set(data),
      error: (err) => { this.locations.set([]); this.httpError.handle(err, 'cargar locations'); },
    });
  }

loadAvailability(): void {
    const providerId = this.auth.user()?.provider_id;
    if (!providerId) return;
    
    this.newSlot.provider_id = providerId;
    
    this.availabilityService.getProviderAvailability(providerId).subscribe({
      next: (response) => {
        const data = (response as any).data || response;
        this.availabilitySlots.set(data);
      },
      error: (err) => this.httpError.handle(err, 'cargar disponibilidad'),
    });
  }

  getDayLabel(dayOfWeek: number): string {
    return DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.label || '';
  }

  getSlotsForDay(dayOfWeek: number): ProviderAvailabilitySlot[] {
    return this.availabilitySlots().filter((s) => s.day_of_week === dayOfWeek);
  }

  addSlot(): void {
    if (!this.newSlot.start_time || !this.newSlot.end_time) {
      this.toast.error('Error', 'Debe seleccionar hora de inicio y fin');
      return;
    }

    if (this.newSlot.start_time >= this.newSlot.end_time) {
      this.toast.error('Error', 'La hora de inicio debe ser menor a la hora de fin');
      return;
    }

    const exists = this.availabilitySlots().some(
      (s) =>
        s.day_of_week === this.newSlot.day_of_week &&
        s.start_time === this.newSlot.start_time &&
        s.end_time === this.newSlot.end_time,
    );

    if (exists) {
      this.toast.error('Error', 'Ya existe un horario similar para este día');
      return;
    }

    this.availabilitySlots.update((slots) => [...slots, { ...this.newSlot }]);
    this.showAddDialog = false;

    // Reset newSlot
    this.newSlot = {
      provider_id: this.newSlot.provider_id,
      location_id: this.newSlot.location_id,
      day_of_week: 1,
      start_time: '09:00',
      end_time: '18:00',
      is_active: true,
    };
  }

  removeSlot(slot: ProviderAvailabilitySlot): void {
    this.availabilitySlots.update((slots) => slots.filter((s) => s !== slot));
  }

saveAvailability(): void {
    const providerId = this.auth.user()?.provider_id;
    if (!providerId) return;
    
    this.saving.set(true);
    
    this.availabilityService.saveProviderAvailability(providerId, this.availabilitySlots()).subscribe({
      next: (response) => {
        const data = (response as any).data || response;
        this.availabilitySlots.set(data);
        this.toast.success('Guardado', 'Tu disponibilidad ha sido actualizada');
        this.saving.set(false);
      },
      error: (err) => {
        this.httpError.handle(err, 'guardar disponibilidad');
        this.saving.set(false);
      }
    });
  }
}
