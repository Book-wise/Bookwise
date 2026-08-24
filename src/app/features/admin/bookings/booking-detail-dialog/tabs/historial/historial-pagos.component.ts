import { Component, computed, inject, signal, AfterViewInit, OnDestroy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of, map, catchError } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { DateTime } from 'luxon';
import { Sale, SaleTransaction } from '@models';
import { SalesApiService } from '@services/api/sales-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { HistorialStore } from '@core/stores/historial.store';
import { TimezoneService } from '@services/timezone.service';
import { BwCurrencyPipe } from '@shared/pipes/bw-currency.pipe';
import { salePaymentChipClass } from '../../../constants/booking-statuses';
import { PaginatedCounterComponent } from './paginated-counter.component';
import { ScrollTopButtonComponent } from './scroll-top-button.component';
import { LoadMoreButtonComponent } from './load-more-button.component';

interface SaleItem {
  name: string;
  description?: string;
  provider?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

type ViewMode = 'list' | 'detail' | 'loading';

@Component({
  selector: 'bw-historial-pagos',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    SkeletonModule,
    BwCurrencyPipe,
    PaginatedCounterComponent,
    ScrollTopButtonComponent,
    LoadMoreButtonComponent,
  ],
  templateUrl: './historial-pagos.component.html',
  styleUrl: './historial-pagos.component.scss',
})
export class HistorialPagosComponent implements AfterViewInit, OnDestroy {
  private readonly salesApi      = inject(SalesApiService);
  private readonly httpError      = inject(HttpErrorService);
  private readonly historialStore = inject(HistorialStore);
  private readonly tzService      = inject(TimezoneService);

  /** Client ID — read from the store's active client. */
  readonly clientId = input.required<number>();

  /** Paginated sales list from the shared store. */
  readonly sales        = this.historialStore.paginatedSales;
  readonly loadingSalesPage = this.historialStore.loadingSalesPage;
  readonly salesPagination = this.historialStore.salesPagination;
  readonly salesShowingCount = this.historialStore.salesShowingCount;

  readonly selectedSaleId = signal<number | null>(null);

  /** Single sale detail when selected — fetched on demand, not cached. */
  private readonly saleDetail = toSignal(
    toObservable(this.selectedSaleId).pipe(
      switchMap(saleId => {
        if (!saleId) return of(null);
        return this.salesApi.getSale(saleId).pipe(
          map(res => res.data),
          catchError(err => {
            this.httpError.handle(err, 'cargar detalle de venta');
            this.selectedSaleId.set(null);
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: null as Sale | null },
  );

  readonly selectedSale = computed(() => this.saleDetail());

  readonly mode = computed<ViewMode>(() => {
    if (this.selectedSaleId() && !this.saleDetail()) return 'loading';
    if (this.selectedSaleId() && this.saleDetail())  return 'detail';
    return 'list';
  });

  // ── Scroll-to-top ─────────────────────────────────────────────────────────
  readonly showScrollTop = signal(false);
  private scrollContainer: HTMLElement | null = null;

  // ── IntersectionObserver for infinite scroll ───────────────────────────────
  private observer: IntersectionObserver | null = null;
  private sentinelEl: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.scrollContainer = document.querySelector('.p-dialog-content') as HTMLElement | null;

    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('scroll', this.onScroll);
    }

    this.setupObserver();
  }

  ngOnDestroy(): void {
    this.scrollContainer?.removeEventListener('scroll', this.onScroll);
    this.observer?.disconnect();
  }

  private setupObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !this.loadingSalesPage() && this.salesPagination().hasMore) {
          const id = this.clientId();
          if (id) {
            this.historialStore.loadNextSalesPage(id);
          }
        }
      },
      { threshold: 0.1 },
    );

    setTimeout(() => {
      this.sentinelEl = document.querySelector('.hpg-sentinel');
      if (this.sentinelEl) {
        this.observer?.observe(this.sentinelEl);
      }
    });
  }

  onScroll = (): void => {
    if (this.scrollContainer) {
      this.showScrollTop.set(this.scrollContainer.scrollTop > 300);
    }
  };

  scrollToTop(): void {
    this.scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
    this.showScrollTop.set(false);
  }

  onLoadMore(): void {
    const id = this.clientId();
    if (id) {
      this.historialStore.loadNextSalesPage(id);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  saleStatusLabel(status: string | undefined): string {
    switch (status) {
      case 'paid':    return 'Pago completo';
      case 'partial': return 'Abono';
      default:        return 'No pagado';
    }
  }

  saleStatusChipClass(status: string | undefined): string {
    return salePaymentChipClass(status);
  }

  /** Latest transaction paid_at for card date display */
  lastTransactionDate(sale: Sale): string | null {
    const txns = sale.transactions ?? [];
    if (txns.length > 0) {
      return txns.reduce((latest, t) =>
        new Date(t.paid_at) > new Date(latest.paid_at) ? t : latest,
      ).paid_at;
    }
    return sale.paid_at ?? sale.created_at ?? null;
  }

  /** Provider label: "Name - Sucursal" or fallback */
  providerLabel(sale: Sale): string {
    const b = sale.booking;
    if (!b) return '—';
    const name = `${b.provider.first_name} ${b.provider.last_name}`;
    const loc  = b.location?.name;
    return loc ? `${name} - ${loc}` : name;
  }

  items(sale: Sale | null): SaleItem[] {
    if (!sale) return [];
    const providerName = sale.booking?.provider
      ? `${sale.booking.provider.first_name} ${sale.booking.provider.last_name}`
      : '—';
    if (sale.booking) {
      return [{
        name:       sale.booking.service.name,
        provider:   providerName,
        quantity:   1,
        unit_price: Number(sale.booking.price),
        total:      Number(sale.booking.price),
      }];
    }
    if (sale.client_pack) {
      const svcName = sale.client_pack.service_pack.service?.name
        ?? sale.client_pack.service_pack.name;
      return sale.client_pack.sessions.map(s => ({
        name:        svcName,
        description: `Sesión ${s.session_number}`,
        provider:    providerName,
        quantity:    1,
        unit_price:  s.effective_price,
        total:       s.effective_price,
      }));
    }
    return [];
  }

  /** Format date in Spanish using Luxon */
  formatCardDate(iso: string | null): string {
    if (!iso) return '—';
    const tz = this.tzService.activeTimezone();
    return DateTime.fromISO(iso, { zone: tz }).setLocale('es').toFormat("EEEE, d 'de' MMMM yyyy - HH:mm");
  }

  /** Convierte Amount (string | number) a number para comparaciones en template */
  toNumber(v: string | number): number {
    return Number(v);
  }

  goBack(): void {
    this.selectedSaleId.set(null);
  }
}
