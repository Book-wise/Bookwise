import { Component, computed, inject, input, signal, effect } from '@angular/core';
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

  readonly viewOptions = computed(() => [
    { label: 'Historial de paciente', value: 'paciente' },
    { label: 'Historial de pagos',    value: 'pagos' },
    { label: 'Historial de reserva',  value: 'reserva' },
  ]);

  /** Load historial data when the booking (and thus client) changes. */
  constructor() {
    effect(() => {
      const clientId = this.booking().client?.id;
      if (clientId) {
        this.historialStore.loadForClient(clientId);
      }
    });
  }
}
