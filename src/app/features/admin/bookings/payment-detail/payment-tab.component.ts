import { ChangeDetectionStrategy, Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { MenuItem } from 'primeng/api';
import { Booking, SaleTransaction, BookingPayment } from '../../../../core/models';

export interface SaleItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// Presentation model — mirrors GET /api/v1/sales/:id { data } shape.
// Amounts stored as numbers for easy display; API returns decimal strings.
export interface SaleDetail {
  id: number;
  date: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'paid' | 'partial' | 'unpaid';
  payment_method?: string | null;
  client_name: string;
  items: SaleItem[];
  transactions: SaleTransaction[];
}

@Component({
  selector: 'bw-payment-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  // Mock: maps booking.payment (BookingPayment) into SaleDetail for display.
  // booking.payment uses total_amount (older booking list field).
  //
  // TODO: replace the setTimeout block with a real API call:
  //   inject ApiService and call:
  //
  //   const saleId = (this.booking.payment as BookingPayment | null)?.id;
  //   if (!saleId) { this.loading.set(false); return; }
  //   this.api.getSale(saleId).subscribe({
  //     next: ({ data }) => {
  //       this.sale.set({
  //         id:               data.id,
  //         date:             data.created_at ?? this.booking.start_time,
  //         total:            Number(data.total),
  //         paid_amount:      Number(data.paid_amount),
  //         remaining_amount: Number(data.remaining_amount),
  //         status:           data.payment_status,
  //         payment_method:   data.payment_method ?? null,
  //         client_name:      data.client
  //           ? `${data.client.first_name} ${data.client.last_name}`
  //           : `${this.booking.client?.first_name ?? ''} ${this.booking.client?.last_name ?? ''}`.trim(),
  //         items:  this.buildItems(data),
  //         transactions: data.transactions,
  //       });
  //       this.loading.set(false);
  //     },
  //     error: () => { this.sale.set(null); this.loading.set(false); },
  //   });

  private loadPaymentData(): void {
    setTimeout(() => {
      const raw    = this.booking.payment as (BookingPayment & { total_amount: number }) | null;
      const hasPay = raw != null && 'total_amount' in raw;
      const total  = hasPay ? Number(raw!.total_amount) : Number(this.booking.price) || 0;

      this.sale.set({
        id:               raw?.id ?? 1,
        date:             this.booking.start_time,
        total,
        paid_amount:      hasPay ? Number(raw!.paid_amount) : 0,
        remaining_amount: hasPay ? Number(raw!.remaining_amount) : total,
        status:           (this.booking.payment_status as SaleDetail['status']) ?? 'unpaid',
        payment_method:   null,
        client_name:      `${this.booking.client?.first_name ?? ''} ${this.booking.client?.last_name ?? ''}`.trim(),
        items:            this.buildItems(),
        transactions:     [],
      });
      this.loading.set(false);
    }, 300);
  }

  private buildItems(): SaleItem[] {
    return [{
      name:       this.booking.service?.name ?? 'Servicio',
      description: this.booking.pack_session
        ? `Sesión ${this.booking.pack_session.session_number} de ${this.booking.pack_session.total_sessions}`
        : undefined,
      quantity:   1,
      unit_price: Number(this.booking.price) || 0,
      total:      Number(this.booking.price) || 0,
    }];
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
