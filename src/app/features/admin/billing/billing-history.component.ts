import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LanguageService } from '@services/language.service';
import { BillingPaymentsApiService } from '@services/api/billing-payments-api.service';
import { BillingPayment } from '@models';
import { formatCLP } from '@shared/config/currency.config';

/** Chip i18n key por estado del cargo (enum PaymentStatus del API). */
const KEY_BY_STATUS: Record<string, string> = {
  succeeded: 'billing.payment.succeeded',
  pending: 'billing.payment.pending',
  failed: 'billing.payment.failed',
  refunded: 'billing.payment.refunded',
  requires_action: 'billing.payment.requires_action',
};

/** Chip class por estado del cargo: el color no puede afirmar más que el dato. */
const CHIP_BY_STATUS: Record<string, string> = {
  succeeded: 'bw-chip--success',
  pending: 'bw-chip--warning',
  requires_action: 'bw-chip--warning',
  failed: 'bw-chip--danger',
  refunded: '',
};

/**
 * Historial de facturación (/admin/facturacion/historial).
 *
 * Lista los cargos reales de la cuenta (`GET /v1/payments`, owner|billing),
 * paginados server-side a 25 por página. Estados: cargando, vacío, error y
 * datos. `failure_code` se muestra tal cual cuando el cargo falló: es el
 * código del proveedor, nunca se traduce ni se inventa un motivo.
 */
@Component({
  selector: 'bw-billing-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule],
  templateUrl: './billing-history.component.html',
  styleUrls: ['./billing-history.component.scss'],
})
export class BillingHistoryComponent implements OnInit {
  readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly api = inject(BillingPaymentsApiService);

  readonly payments = signal<BillingPayment[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);

  /** Hay más de una página: se muestran los controles de navegación. */
  readonly paginated = computed(() => this.lastPage() > 1);

  ngOnInit(): void {
    this.load(1);
  }

  /** Carga una página; un error del BE deja la pantalla con su aviso, nunca vacía. */
  load(page: number): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.failed.set(false);
    this.api.getPayments({ page }).subscribe({
      next: (res) => {
        this.payments.set(res.data ?? []);
        this.page.set(res.meta?.current_page ?? page);
        this.lastPage.set(res.meta?.last_page ?? 1);
        this.total.set(res.meta?.total ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.payments.set([]);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Fecha de ocurrencia del cargo (created_at), formateada según idioma. */
  date(iso: string): string {
    const locale = this.lang.lang() === 'es' ? 'es-CL' : 'en-US';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  }

  statusKey(status: string): string {
    return KEY_BY_STATUS[status] ?? 'billing.payment.pending';
  }

  statusChipClass(status: string): string {
    return CHIP_BY_STATUS[status] ?? '';
  }

  /** Concepto del cargo (`recurring` | `manual` | `refund` | `adjustment`). */
  kindKey(kind: string): string {
    return `billing.payment.kind.${kind}`;
  }

  /** Formatea montos CLP de los cargos (mismo formatter del repo). */
  price(value: number): string {
    return formatCLP(value);
  }

  previousPage(): void {
    if (this.page() > 1) this.load(this.page() - 1);
  }

  nextPage(): void {
    if (this.page() < this.lastPage()) this.load(this.page() + 1);
  }

  goBack(): void {
    this.router.navigate(['/admin/facturacion']);
  }
}
