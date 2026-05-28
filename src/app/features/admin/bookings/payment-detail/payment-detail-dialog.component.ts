import { Component, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { Booking } from '../../../../core/models';

@Component({
  selector: 'bw-payment-detail-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, TagModule, DividerModule, CurrencyPipe, DatePipe],
  templateUrl: './payment-detail-dialog.component.html',
  styleUrl: './payment-detail-dialog.component.scss',
})
export class PaymentDetailDialogComponent {
  visible = false;
  booking = signal<Booking | null>(null);

  open(booking: Booking): void {
    this.booking.set(booking);
    this.visible = true;
  }

  close(): void {
    this.visible = false;
    this.booking.set(null);
  }

  get payment() {
    const b = this.booking();
    const p = b?.payment as any;
    return p && typeof p === 'object' && 'total' in p ? p : null;
  }

  get statusSeverity(): 'success' | 'warn' | 'danger' {
    const status = this.booking()?.payment_status;
    if (status === 'paid')    return 'success';
    if (status === 'partial') return 'warn';
    return 'danger';
  }

  get statusLabel(): string {
    const status = this.booking()?.payment_status;
    if (status === 'paid')    return 'Pagado';
    if (status === 'partial') return 'Pago parcial';
    return 'No pagado';
  }
}
