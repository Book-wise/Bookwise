import { Component, computed, effect, ElementRef, inject, input, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, switchMap, concat, of, map, catchError } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { TextareaModule } from 'primeng/textarea';
import { TableModule } from 'primeng/table';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MenuItem } from 'primeng/api';
import { Booking, BookingPayment, CreateSaleRequest, Sale, SaleTransaction } from '@models';
import { SalesApiService } from '@services/api/sales-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { BwCurrencyPipe } from '@shared/pipes/bw-currency.pipe';
import { CURRENCY_CONFIG } from '@shared/config/currency.config';
import { PAYMENT_METHOD_OPTIONS } from '../../../constants/payment-methods';
import { salePaymentChipClass } from '../../../constants/booking-statuses';

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
  wc_order_id?: number | null;
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
  imports: [
    CommonModule, FormsModule,
    SkeletonModule, ButtonModule, MenuModule, TextareaModule,
    TableModule, InputNumberModule, SelectModule,
    BwCurrencyPipe,
  ],
  templateUrl: './payment-tab.component.html',
  styleUrl: './payment-tab.component.scss',
})
export class PaymentTabComponent {
  readonly currencyConfig = CURRENCY_CONFIG;

  private readonly salesApi = inject(SalesApiService);
  private readonly httpError = inject(HttpErrorService);
  private readonly el        = inject(ElementRef);

  readonly booking      = input.required<Booking>();
  readonly scrollToTxn  = input(false);

  constructor() {
    effect(() => {
      const should = this.scrollToTxn();
      const loaded = !this.vm().loading && !!this.vm().sale;
      if (should && loaded) {
        setTimeout(() => {
          this.el.nativeElement
            .querySelector('.sale-card--txn')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    });
  }

  private readonly refresh        = signal(0);
  private readonly overrideSaleId = signal<number | null>(null);

  readonly vm = toSignal(
    combineLatest([
      toObservable(this.booking),
      toObservable(this.refresh),
      toObservable(this.overrideSaleId),
    ]).pipe(
      switchMap(([booking, _r, overrideSaleId]) => {
        const saleId = overrideSaleId ?? (booking.payment as BookingPayment | null)?.id;
        if (!saleId) return of<SaleVm>({ loading: false, sale: null });
        return concat(
          of<SaleVm>({ loading: true, sale: null }),
          this.salesApi.getSale(saleId).pipe(
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
    { initialValue: { loading: true, sale: null } as SaleVm }
  );

  // ── Cobro inicial (sin sale) ──────────────────────────────────────────────────

  readonly cobroLoading = signal(false);

  initCobro(): void {
    const bookingId = this.booking().id;
    this.cobroLoading.set(true);
    this.salesApi.createSale({ booking_id: bookingId } as CreateSaleRequest).subscribe({
      next: ({ data }) => {
        this.cobroLoading.set(false);
        this.overrideSaleId.set(data.id);
      },
      error: (err) => {
        this.httpError.handle(err, 'crear venta');
        this.cobroLoading.set(false);
      },
    });
  }

  // ── Abono form state ──────────────────────────────────────────────────────────

  readonly showAbonoForm = signal(false);
  readonly abonoAmount   = signal<number | null>(null);
  readonly abonoMethod   = signal<string>('');
  readonly abonoNotes    = signal('');
  readonly abonoSaving   = signal(false);

  readonly paymentMethods = PAYMENT_METHOD_OPTIONS;

  // ── Misc state ────────────────────────────────────────────────────────────────

  readonly noteText = signal('');

  readonly saleMenuItems: MenuItem[] = [
    { label: 'Ver comprobante',    icon: 'pi pi-eye' },
    { label: 'Enviar comprobante', icon: 'pi pi-send' },
    { separator: true },
    { label: 'Eliminar venta',     icon: 'pi pi-trash', styleClass: 'bw-menu-danger' },
  ];

  // ── Helpers ──────────────────────────────────────────────────────────────────

  readonly statusChipClass = computed((): string => salePaymentChipClass(this.vm().sale?.status));

  readonly statusLabel = computed((): string => {
    const s = this.vm().sale?.status;
    if (s === 'paid')    return 'Pagado';
    if (s === 'partial') return 'Pago parcial';
    return 'No pagado';
  });

  readonly lastTransactionDate = computed((): string | null => {
    const txns = this.vm().sale?.transactions ?? [];
    if (!txns.length) return null;
    return txns.reduce((latest, t) =>
      new Date(t.paid_at) > new Date(latest.paid_at) ? t : latest
    ).paid_at;
  });

  readonly isOnline = computed((): boolean =>
    !!this.vm().sale?.wc_order_id
  );

  // ── Actions ──────────────────────────────────────────────────────────────────

  openAbonoForm(remaining: number): void {
    this.abonoAmount.set(remaining);
    this.abonoMethod.set('');
    this.abonoNotes.set('');
    this.showAbonoForm.set(true);
  }

  closeAbonoForm(): void {
    this.showAbonoForm.set(false);
    this.abonoSaving.set(false);
  }

  submitAbono(saleId: number): void {
    const amount = this.abonoAmount();
    const method = this.abonoMethod();
    if (!amount || !method) return;

    this.abonoSaving.set(true);
    this.salesApi.createTransaction(saleId, {
      amount,
      payment_method: method,
      notes: this.abonoNotes() || undefined,
    }).subscribe({
      next: () => {
        this.closeAbonoForm();
        this.refresh.update(n => n + 1);
      },
      error: (err) => {
        this.httpError.handle(err, 'registrar abono');
        this.abonoSaving.set(false);
      },
    });
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
      wc_order_id:      data.wc_order_id ?? null,
      client_name:      data.client
        ? `${data.client.first_name} ${data.client.last_name}`
        : `${booking.client?.first_name ?? ''} ${booking.client?.last_name ?? ''}`.trim(),
      items:        this.buildItems(data, booking),
      transactions: data.transactions.map(t => ({ ...t, amount: Number(t.amount) })),
    };
  }

  private buildItems(data: Sale, booking: Booking): SaleItem[] {
    if (data.booking) {
      const sessions = data.booking.pack_session?.all_sessions;
      if (sessions?.length) {
        const pricePerSession = data.booking.pack_session!.effective_price;
        return sessions.map(s => ({
          name:        data.booking!.service.name,
          description: `Sesión ${s.session_number}`,
          quantity:    1,
          unit_price:  pricePerSession,
          total:       pricePerSession,
        }));
      }
      return [{
        name:       data.booking.service.name,
        quantity:   1,
        unit_price: Number(data.booking.price),
        total:      Number(data.booking.price),
      }];
    }
    if (data.client_pack) {
      const serviceName = data.client_pack.service_pack.service?.name
        ?? data.client_pack.service_pack.name;
      return data.client_pack.sessions.map(s => ({
        name:        serviceName,
        description: `Sesión ${s.session_number}`,
        quantity:    1,
        unit_price:  s.effective_price,
        total:       s.effective_price,
      }));
    }
    return [{
      name:       booking.service?.name ?? 'Servicio',
      quantity:   1,
      unit_price: Number(booking.price) || 0,
      total:      Number(booking.price) || 0,
    }];
  }
}
