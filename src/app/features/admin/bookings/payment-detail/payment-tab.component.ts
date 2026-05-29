import { Component, inject, input, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, concat, of, map, catchError } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { MenuItem } from 'primeng/api';
import { Booking, BookingPayment, Sale, SaleTransaction } from '@models';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';

export interface SaleItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

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

interface SaleVm {
  loading: boolean;
  sale: SaleDetail | null;
}

@Component({
  selector: 'bw-payment-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonModule, ButtonModule, MenuModule, TextareaModule, TagModule, TableModule],
  templateUrl: './payment-tab.component.html',
  styleUrl: './payment-tab.component.scss',
})
export class PaymentTabComponent {
  private readonly api       = inject(ApiService);
  private readonly httpError = inject(HttpErrorService);

  readonly booking = input.required<Booking>();

  readonly vm = toSignal(
    toObservable(this.booking).pipe(
      switchMap(booking => {
        const saleId = (booking.payment as BookingPayment | null)?.id;
        if (!saleId) return of<SaleVm>({ loading: false, sale: null });
        return concat(
          of<SaleVm>({ loading: true, sale: null }),
          this.api.getSale(saleId).pipe(
            map(({ data }) => ({
              loading: false,
              sale:    this.buildSaleDetail(data, booking),
            } as SaleVm)),
            catchError(err => {
              this.httpError.handle(err, 'cargar venta');
              return of<SaleVm>({ loading: false, sale: null });
            })
          )
        );
      })
    ),
    { initialValue: { loading: false, sale: null } as SaleVm }
  );

  readonly noteText = signal('');

  readonly saleMenuItems: MenuItem[] = [
    { label: 'Ver comprobante',    icon: 'pi pi-eye' },
    { label: 'Enviar comprobante', icon: 'pi pi-send' },
    { separator: true },
    { label: 'Eliminar venta',     icon: 'pi pi-trash', styleClass: 'bw-menu-danger' },
  ];

  // ── Helpers ──────────────────────────────────────────────────────────────────

  get statusSeverity(): 'success' | 'warn' | 'danger' {
    const s = this.vm().sale?.status;
    if (s === 'paid')    return 'success';
    if (s === 'partial') return 'warn';
    return 'danger';
  }

  get statusLabel(): string {
    const s = this.vm().sale?.status;
    if (s === 'paid')    return 'Pagado';
    if (s === 'partial') return 'Pago parcial';
    return 'No pagado';
  }

  saveNote(): void {
    console.log('Note saved:', this.noteText());
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private buildSaleDetail(data: Sale, booking: Booking): SaleDetail {
    return {
      id:               data.id,
      date:             data.created_at ?? booking.start_time,
      total:            Number(data.total),
      paid_amount:      Number(data.paid_amount),
      remaining_amount: Number(data.remaining_amount),
      status:           data.payment_status,
      payment_method:   data.payment_method ?? null,
      client_name:      data.client
        ? `${data.client.first_name} ${data.client.last_name}`
        : `${booking.client?.first_name ?? ''} ${booking.client?.last_name ?? ''}`.trim(),
      items:        this.buildItems(data, booking),
      transactions: data.transactions,
    };
  }

  private buildItems(data: Sale, booking: Booking): SaleItem[] {
    if (data.booking) {
      return [{
        name:        data.booking.service.name,
        description: booking.pack_session
          ? `Sesión ${booking.pack_session.session_number} de ${booking.pack_session.total_sessions}`
          : undefined,
        quantity:   1,
        unit_price: Number(data.booking.price),
        total:      Number(data.booking.price),
      }];
    }
    if (data.client_pack) {
      return [{
        name:        data.client_pack.service_pack.name,
        description: `${data.client_pack.total_sessions} sesiones`,
        quantity:    1,
        unit_price:  Number(data.client_pack.service_pack.price),
        total:       Number(data.client_pack.service_pack.price),
      }];
    }
    return [{
      name:       booking.service?.name ?? 'Servicio',
      quantity:   1,
      unit_price: Number(booking.price) || 0,
      total:      Number(booking.price) || 0,
    }];
  }
}
