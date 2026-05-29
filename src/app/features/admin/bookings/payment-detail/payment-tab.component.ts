import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { MenuItem } from 'primeng/api';
import { Booking } from '../../../../core/models';

export interface SaleItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface SaleTransaction {
  id: string;
  date: string;
  payment_method: string;
  amount: number;
}

export interface SaleDetail {
  id: number;
  date: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'paid' | 'partial' | 'unpaid';
  client_name: string;
  items: SaleItem[];
  transactions: SaleTransaction[];
}

@Component({
  selector: 'bw-payment-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonModule, ButtonModule, MenuModule, TextareaModule, TagModule],
  templateUrl: './payment-tab.component.html',
  styleUrl: './payment-tab.component.scss',
})
export class PaymentTabComponent implements OnInit {
  @Input() booking!: Booking;

  loading  = signal(true);
  sale     = signal<SaleDetail | null>(null);
  noteText = signal('');

  saleMenuItems: MenuItem[] = [
    { label: 'Ver comprobante',    icon: 'pi pi-eye' },
    { label: 'Enviar comprobante', icon: 'pi pi-send' },
    { separator: true },
    { label: 'Eliminar venta',     icon: 'pi pi-trash', styleClass: 'bw-menu-danger' },
  ];

  ngOnInit(): void {
    this.loadPaymentData();
  }

  // ── Data loading ─────────────────────────────────────────────────────────────
  // TODO: replace with real API call → this.api.getSale(this.booking.payment?.id)

  private loadPaymentData(): void {
    setTimeout(() => {
      const raw    = this.booking.payment as any;
      const hasPay = raw && typeof raw === 'object' && 'total' in raw;
      const total  = hasPay ? Number(raw.total) : Number(this.booking.price) || 0;

      const items: SaleItem[] = [{
        name: this.booking.service?.name ?? 'Servicio',
        description: this.booking.pack_session
          ? `Sesión ${this.booking.pack_session.session_number} de ${this.booking.pack_session.total_sessions}`
          : undefined,
        quantity:   1,
        unit_price: Number(this.booking.price) || 0,
        total:      Number(this.booking.price) || 0,
      }];

      const transactions: SaleTransaction[] = hasPay ? [{
        id:             `TXN-${String(raw.id ?? 1).padStart(4, '0')}`,
        date:           this.booking.created_at ?? this.booking.start_time,
        payment_method: 'Efectivo',
        amount:         Number(raw.paid_amount ?? total),
      }] : [];

      this.sale.set({
        id:                raw?.id ?? 1,
        date:              this.booking.start_time,
        total,
        paid_amount:       hasPay ? Number(raw.paid_amount) : 0,
        remaining_amount:  hasPay ? Number(raw.remaining_amount) : total,
        status:            (this.booking.payment_status as SaleDetail['status']) ?? 'unpaid',
        client_name:       `${this.booking.client?.first_name ?? ''} ${this.booking.client?.last_name ?? ''}`.trim(),
        items,
        transactions,
      });
      this.loading.set(false);
    }, 300);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  get statusSeverity(): 'success' | 'warn' | 'danger' {
    const s = this.sale()?.status;
    if (s === 'paid')    return 'success';
    if (s === 'partial') return 'warn';
    return 'danger';
  }

  get statusLabel(): string {
    const s = this.sale()?.status;
    if (s === 'paid')    return 'Pagado';
    if (s === 'partial') return 'Pago parcial';
    return 'No pagado';
  }

  saveNote(): void {
    // TODO: call api to persist note
    console.log('Note saved:', this.noteText());
  }
}
