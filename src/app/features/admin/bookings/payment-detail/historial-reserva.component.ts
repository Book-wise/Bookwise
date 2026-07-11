import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { Booking } from '@models';
import { HistorialStore } from '@core/stores/historial.store';

@Component({
  selector: 'bw-historial-reserva',
  standalone: true,
  imports: [CommonModule, TagModule, SkeletonModule],
  templateUrl: './historial-reserva.component.html',
  styleUrl: './historial-reserva.component.scss',
})
export class HistorialReservaComponent {
  private readonly historialStore = inject(HistorialStore);

  readonly loading  = this.historialStore.loading;
  readonly bookings = this.historialStore.bookings;

  actionLabel(booking: Booking): string {
    const via = booking.last_modified_via && booking.last_modified_via !== booking.created_via
      ? booking.last_modified_via
      : null;

    if (via) {
      switch (via) {
        case 'admin_calendar': return 'Modificada por Calendario';
        case 'agent':          return 'Modificada por Asistente';
      }
    }

    switch (booking.created_via) {
      case 'admin_calendar': return 'Creada por Calendario';
      case 'agent':          return 'Creada por Asistente';
      case 'online_webhook': return 'Creada Online';
      default:               return '—';
    }
  }
}
