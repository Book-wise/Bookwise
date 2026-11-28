import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { PopoverModule } from 'primeng/popover';
import { LanguageService } from '@services/language.service';
import { SubscriptionStore } from '@core/stores/subscription.store';
import { SubscriptionAddon } from '@models';
import { formatCLP } from '@shared/config/currency.config';

/**
 * "Mi plan" (/admin/planes) — vista de SOLO LECTURA de la suscripción.
 *
 * Muestra el plan vigente, los add-ons contratados y el total, con:
 *  - una caja azul informativa (#19): total + próxima fecha de facturación
 *    (`next_billing_at`) + aviso de cobro;
 *  - un popover de desglose (#17): Plan / Add-ons / Impuestos / Total con
 *    "Ver más detalles" (los impuestos son un placeholder hasta que el backend
 *    exponga neto+IVA, ver `billing-plans-addons.md` #16).
 *
 * La edición (cambio de plan / add-ons) vive en `/admin/planes/administrar`.
 */
@Component({
  selector: 'bw-my-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardModule, ButtonModule, SkeletonModule, PopoverModule],
  templateUrl: './my-plan.component.html',
  styleUrls: ['./my-plan.component.scss'],
})
export class MyPlanComponent implements OnInit {
  readonly lang = inject(LanguageService);
  private readonly store = inject(SubscriptionStore);
  private readonly router = inject(Router);

  readonly loading = computed(() => this.store.loading().subscription);
  readonly currentPlan = computed(() => this.store.subscription()?.plan ?? null);
  readonly addons = computed(() => this.store.subscription()?.addons ?? []);
  readonly addonsTotal = computed(() => this.store.subscription()?.addons_total_clp ?? 0);
  readonly totalPrice = computed(() => this.store.subscription()?.total_price_clp ?? 0);
  readonly planPrice = computed(() => this.currentPlan()?.price_clp ?? 0);
  readonly nextBillingAt = computed(() => this.store.subscription()?.next_billing_at ?? null);

  /**
   * Primer cobro pendiente (S15): el BE deja la suscripción en `pending` cuando el
   * cobro de la primera mensualidad se rechaza, con la tarjeta ya inscripta.
   * Es el ÚNICO trigger del banner de reintento.
   */
  readonly isPending = computed(() => this.store.subscription()?.status === 'pending');

  private readonly charging = signal(false);
  /** true mientras el POST de checkout está en vuelo (evita doble cobro por click). */
  readonly checkingOut = this.charging.asReadonly();

  private readonly checkoutFailed = signal(false);
  /** true cuando el último intento de cobro fue rechazado (402) o falló. */
  readonly checkoutError = this.checkoutFailed.asReadonly();

  ngOnInit(): void {
    this.store.loadSubscription();
  }

  planName(): string {
    return this.currentPlan()?.name ?? '';
  }

  /** Sufijo de precio según el intervalo REAL que paga la cuenta. */
  intervalSuffix(): string {
    return this.currentPlan()?.billing_interval === 'year' ? '/año' : '/mes';
  }

  /** Próxima facturación formateada (ej. "12 Nov 2026") según idioma. */
  nextBillingDate(): string {
    const iso = this.nextBillingAt();
    if (!iso) return '—';
    const locale = this.lang.lang() === 'es' ? 'es-CL' : 'en-US';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  }

  /** Etiqueta legible de un add-on contratado (canal + packs). */
  addonLabel(addon: SubscriptionAddon): string {
    const channel = addon.type === 'whatsapp'
      ? this.lang.t('billing.usage.whatsapp')
      : this.lang.t('billing.usage.email');
    const credits = addon.quantity * addon.credits_per_pack;
    return `${channel} · ${this.lang.t('plans.addon_credits', { n: String(credits) })}`;
  }

  price(value: number | null | undefined): string {
    return formatCLP(value);
  }

  goToManage(): void {
    this.router.navigate(['/admin/planes/administrar']);
  }

  goToBilling(): void {
    this.router.navigate(['/admin/facturacion']);
  }

  /** Lleva al historial de cargos, donde el código del proveedor explica el rechazo. */
  goToHistory(): void {
    this.router.navigate(['/admin/facturacion/historial']);
  }

  /**
   * Reintenta el cobro de la primera mensualidad. El endpoint es idempotente por
   * inscripción (S15): reintentar no puede cobrar dos veces. En éxito el store
   * reemplaza la suscripción (→ active) y el banner desaparece solo.
   */
  retryCheckout(): void {
    if (this.charging()) return;
    this.charging.set(true);
    this.checkoutFailed.set(false);
    this.store.checkout().subscribe({
      next: () => this.charging.set(false),
      error: () => {
        this.charging.set(false);
        this.checkoutFailed.set(true);
      },
    });
  }
}
