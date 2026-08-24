import { Component, computed, inject, input, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Booking } from '@models';
import { HistorialStore } from '@core/stores/historial.store';
import { HistorialPacienteComponent } from './historial-paciente.component';
import { HistorialPagosComponent } from './historial-pagos.component';
import { HistorialReservaComponent } from './historial-reserva.component';

@Component({
  selector: 'bw-historial-tab',
  standalone: true,
  imports: [CommonModule, HistorialPacienteComponent, HistorialPagosComponent, HistorialReservaComponent],
  templateUrl: './historial-tab.component.html',
  styleUrl: './historial-tab.component.scss',
})
export class HistorialTabComponent {
  private readonly historialStore = inject(HistorialStore);

  readonly booking = input.required<Booking>();
  readonly selectedView = signal<string>('paciente');

  /** Extract client ID from the booking input. */
  readonly clientId = computed(() => this.booking().client?.id ?? 0);

  readonly viewOptions = computed(() => [
    { label: 'Historial de paciente', value: 'paciente' },
    { label: 'Historial de pagos',    value: 'pagos' },
    { label: 'Historial de reserva',  value: 'reserva' },
  ]);

  /** Refresh historial data when the booking input reference changes
   *  (parent replaces the object after edit — status change, time edit).
   *  Uses refreshForClient which bypasses the loadedClients cache. */
  constructor() {
    effect(() => {
      const booking = this.booking();
      const clientId = booking.client?.id;
      if (clientId) {
        // Force re-fetch whenever booking reference changes (status edit, time edit).
        // Wrapped in untracked to prevent tracking historial store signals
        // read internally by refreshForClient, which would create an infinite loop.
        untracked(() => this.historialStore.refreshForClient(clientId));
      }
    });
  }
}
