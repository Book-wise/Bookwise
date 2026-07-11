import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of, map, catchError } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { Sale, SaleTransaction } from '@models';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { HistorialStore } from '@core/stores/historial.store';
import { BwCurrencyPipe } from '@shared/pipes/bw-currency.pipe';

interface SaleItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

type ViewMode = 'list' | 'detail' | 'loading';

@Component({
  selector: 'bw-historial-pagos',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, TableModule, SkeletonModule, BwCurrencyPipe],
  templateUrl: './historial-pagos.component.html',
  styleUrl: './historial-pagos.component.scss',
})
export class HistorialPagosComponent {
  private readonly api            = inject(ApiService);
  private readonly httpError      = inject(HttpErrorService);
  private readonly historialStore = inject(HistorialStore);

  /** Sales list comes from the shared store (cached per clientId). */
  readonly sales        = this.historialStore.sales;
  readonly salesLoading = this.historialStore.loading;

  readonly selectedSaleId = signal<number | null>(null);

  /** Single sale detail when selected — fetched on demand, not cached. */
  private readonly saleDetail = toSignal(
    toObservable(this.selectedSaleId).pipe(
      switchMap(saleId => {
        if (!saleId) return of(null);
        return this.api.getSale(saleId).pipe(
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

  // ── Helpers ──────────────────────────────────────────────────────────────────

  saleStatusLabel(status: string | undefined): string {
    switch (status) {
      case 'paid':    return 'Pago completo';
      case 'partial': return 'Abono';
      default:        return 'No pagado';
    }
  }

  saleStatusSeverity(status: string | undefined): 'success' | 'warn' | 'danger' {
    switch (status) {
      case 'paid':    return 'success';
      case 'partial': return 'warn';
      default:        return 'danger';
    }
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
    if (sale.booking) {
      return [{
        name:       sale.booking.service.name,
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
        quantity:    1,
        unit_price:  s.effective_price,
        total:       s.effective_price,
      }));
    }
    return [];
  }

  /** Convierte Amount (string | number) a number para comparaciones en template */
  toNumber(v: string | number): number {
    return Number(v);
  }

  goBack(): void {
    this.selectedSaleId.set(null);
  }
}
