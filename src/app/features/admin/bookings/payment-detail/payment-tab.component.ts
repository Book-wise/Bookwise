import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { Booking } from '../../../../core/models';

export interface PaymentDisplay {
  total: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'paid' | 'partial' | 'unpaid';
}

@Component({
  selector: 'bw-payment-tab',
  standalone: true,
  imports: [CommonModule, TagModule, SkeletonModule],
  templateUrl: './payment-tab.component.html',
  styleUrl: './payment-tab.component.scss',
})
export class PaymentTabComponent implements OnInit {
  @Input() booking!: Booking;

  loading   = signal(true);
  payment   = signal<PaymentDisplay | null>(null);

  ngOnInit(): void {
    this.loadPaymentData();
  }

  // ── Data loading ────────────────────────────────────────────────────────────
  // TODO: replace with real API call → this.api.getBookingPayment(this.booking.id)

  private loadPaymentData(): void {
    setTimeout(() => {
      const raw = this.booking.payment as any;
      if (raw && typeof raw === 'object' && 'total' in raw) {
        this.payment.set({
          total:            Number(raw.total),
          paid_amount:      Number(raw.paid_amount),
          remaining_amount: Number(raw.remaining_amount),
          status:           (this.booking.payment_status as PaymentDisplay['status']) ?? 'unpaid',
        });
      } else {
        this.payment.set(null);
      }
      this.loading.set(false);
    }, 300);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  get statusSeverity(): 'success' | 'warn' | 'danger' {
    const s = this.payment()?.status;
    if (s === 'paid')    return 'success';
    if (s === 'partial') return 'warn';
    return 'danger';
  }

  get statusLabel(): string {
    const s = this.payment()?.status;
    if (s === 'paid')    return 'Pagado';
    if (s === 'partial') return 'Pago parcial';
    return 'No pagado';
  }
}
