import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ClientDetailStore, PatientTab } from '@core/stores/client-detail.store';
import { TimezoneService } from '@services/timezone.service';

@Component({
  selector: 'bw-patient-detail-content',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, ButtonModule, SkeletonModule],
  templateUrl: './patient-detail-content.component.html',
  styleUrl: './patient-detail-content.component.scss',
})
export class PatientDetailContentComponent {
  readonly detailStore = inject(ClientDetailStore);
  private readonly timezone = inject(TimezoneService);

  readonly view = input.required<PatientTab>();
  readonly returnRequested = output<void>();

  readonly activePacks = computed(() =>
    this.detailStore.packs().data.filter(pack => pack.status === 'active'),
  );

  readonly sessions = computed(() => this.activePacks().flatMap(pack => {
    const packName = pack.service_pack?.service?.name ?? pack.service_pack?.name ?? 'Plan';
    return Array.from({ length: pack.total_sessions }, (_, index) => ({
      sessionNumber: index + 1,
      packName,
      status: index + 1 <= pack.used_sessions ? 'Completada' : 'Pendiente',
    }));
  }));

  formatBookingTime(iso: string): string {
    return this.timezone.formatCardDate(iso);
  }

  requestReturn(): void {
    this.returnRequested.emit();
  }
}
