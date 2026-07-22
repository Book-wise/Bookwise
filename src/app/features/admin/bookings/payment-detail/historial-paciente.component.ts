import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { Booking } from '@models';
import { HistorialStore } from '@core/stores/historial.store';
import { TimezoneService } from '@services/timezone.service';

@Component({
  selector: 'bw-historial-paciente',
  standalone: true,
  imports: [CommonModule, TabsModule, TableModule, SkeletonModule],
  templateUrl: './historial-paciente.component.html',
  styleUrl: './historial-paciente.component.scss',
})
export class HistorialPacienteComponent {
  private readonly historialStore = inject(HistorialStore);
  private readonly tzService      = inject(TimezoneService);

  readonly loading    = this.historialStore.loading;
  readonly rawBookings = this.historialStore.bookings;

  formatCardDate(iso: string): string {
    return this.tzService.formatCardDate(iso);
  }

  readonly activeSubTab = signal<'atenciones' | 'creaciones'>('atenciones');

  /** Bookings with status_id === 3 (Asiste), newest first */
  readonly attendedBookings = computed(() =>
    this.rawBookings()
      .filter(b => b.status_id === 3)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
  );

  /** All bookings sorted by created_at desc */
  readonly createdBookings = computed(() =>
    this.rawBookings()
      .filter(b => b.created_at)
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()),
  );

  readonly currentList = computed(() =>
    this.activeSubTab() === 'atenciones' ? this.attendedBookings() : this.createdBookings(),
  );

  onTabChange(value: string | number | undefined): void {
    if (value === 'atenciones' || value === 'creaciones') {
      this.activeSubTab.set(value);
    }
  }

  providerLabel(booking: Booking): string {
    if (booking.provider) {
      return `${booking.provider.first_name} ${booking.provider.last_name}`;
    }
    return 'No tiene';
  }
}
