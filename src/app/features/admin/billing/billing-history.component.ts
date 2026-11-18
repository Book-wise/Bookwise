import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LanguageService } from '@services/language.service';
import { formatCLP } from '@shared/config/currency.config';

type InvoiceStatus = 'paid' | 'pending' | 'failed';

interface Invoice {
  id: string;
  date: string;
  plan: string;
  amount: number;
  status: InvoiceStatus;
}

/**
 * Historial de facturación (/admin/facturacion/historial).
 *
 * Lista de facturas MOCK hasta que exista `GET /v1/invoices` (ver
 * `billing-plans-addons.md`). La acción de descarga no está cableada.
 */
@Component({
  selector: 'bw-billing-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule],
  templateUrl: './billing-history.component.html',
  styleUrls: ['./billing-history.component.scss'],
})
export class BillingHistoryComponent {
  readonly lang = inject(LanguageService);
  private readonly router = inject(Router);

  readonly invoices: Invoice[] = [
    { id: 'INV-2024-011', date: '12 Nov 2024', plan: 'Professional', amount: 34990, status: 'paid' },
    { id: 'INV-2024-010', date: '12 Oct 2024', plan: 'Professional', amount: 34990, status: 'paid' },
    { id: 'INV-2024-009', date: '12 Sep 2024', plan: 'Professional', amount: 34990, status: 'pending' },
    { id: 'INV-2024-008', date: '12 Ago 2024', plan: 'Professional', amount: 34990, status: 'failed' },
    { id: 'INV-2024-007', date: '12 Jul 2024', plan: 'Professional', amount: 34990, status: 'paid' },
  ];

  statusKey(status: InvoiceStatus): string {
    switch (status) {
      case 'pending': return 'billing.pending';
      case 'failed':  return 'billing.failed';
      default:        return 'billing.paid';
    }
  }

  statusChipClass(status: InvoiceStatus): string {
    switch (status) {
      case 'pending': return 'bw-chip--warning';
      case 'failed':  return 'bw-chip--danger';
      default:        return 'bw-chip--success';
    }
  }

  /** Formatea montos CLP de las facturas (mismo formatter del repo). */
  price(value: number): string {
    return formatCLP(value);
  }

  goBack(): void {
    this.router.navigate(['/admin/facturacion']);
  }
}
