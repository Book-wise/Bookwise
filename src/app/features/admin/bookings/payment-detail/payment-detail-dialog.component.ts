import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { SkeletonModule } from 'primeng/skeleton';
import { Booking } from '../../../../core/models';
import { PaymentTabComponent } from './payment-tab.component';

export type BookingTab = 'reserva' | 'pago' | 'recordatorios' | 'paciente' | 'ficha' | 'historial';

@Component({
  selector: 'bw-payment-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DialogModule, ButtonModule, TagModule, TabsModule, SkeletonModule, PaymentTabComponent],
  templateUrl: './payment-detail-dialog.component.html',
  styleUrl: './payment-detail-dialog.component.scss',
})
export class PaymentDetailDialogComponent {
  visible   = signal(false);
  booking   = signal<Booking | null>(null);
  activeTab = signal<BookingTab>('pago');

  // Computed to avoid recalculation in template
  readonly statusSeverity = computed(() => {
    const name = this.booking()?.status?.name?.toLowerCase();
    if (!name) return undefined as any;
    if (name.includes('confirm'))  return 'success';
    if (name.includes('cancel'))   return 'danger';
    if (name.includes('pendiente') || name.includes('espera')) return 'warn';
    if (name.includes('asiste') || name.includes('completa')) return 'info';
    return 'secondary';
  });

  open(booking: Booking, tab: BookingTab = 'pago'): void {
    this.booking.set(booking);
    this.activeTab.set(tab);
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
    this.booking.set(null);
  }
}
