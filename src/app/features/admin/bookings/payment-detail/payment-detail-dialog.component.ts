import { Component, signal } from '@angular/core';
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
  imports: [CommonModule, DialogModule, ButtonModule, TagModule, TabsModule, SkeletonModule, PaymentTabComponent],
  templateUrl: './payment-detail-dialog.component.html',
  styleUrl: './payment-detail-dialog.component.scss',
})
export class PaymentDetailDialogComponent {
  visible = false;
  booking = signal<Booking | null>(null);
  activeTab = signal<BookingTab>('pago');

  open(booking: Booking, tab: BookingTab = 'pago'): void {
    this.booking.set(booking);
    this.activeTab.set(tab);
    this.visible = true;
  }

  close(): void {
    this.visible = false;
    this.booking.set(null);
  }

  get payment() {
    const p = this.booking()?.payment as any;
    return p && typeof p === 'object' && 'total' in p ? p : null;
  }

  get paymentStatusSeverity(): 'success' | 'warn' | 'danger' {
    const s = this.booking()?.payment_status;
    if (s === 'paid')    return 'success';
    if (s === 'partial') return 'warn';
    return 'danger';
  }

  get paymentStatusLabel(): string {
    const s = this.booking()?.payment_status;
    if (s === 'paid')    return 'Pagado';
    if (s === 'partial') return 'Pago parcial';
    return 'No pagado';
  }

  get statusSeverity(): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | undefined {
    const name = this.booking()?.status?.name?.toLowerCase();
    if (!name) return undefined;
    if (name.includes('confirm'))  return 'success';
    if (name.includes('cancel'))   return 'danger';
    if (name.includes('pendiente') || name.includes('espera')) return 'warn';
    if (name.includes('asiste') || name.includes('completa')) return 'info';
    return 'secondary';
  }
}
