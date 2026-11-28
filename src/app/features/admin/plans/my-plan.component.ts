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
 * i18n key por `failure_code` conocido del proveedor. Solo se mapea lo que el API
 * documentó: el resto cae al copy genérico, nunca a un motivo inventado.
 */
const KEY_BY_FAILURE_CODE: Record<string, string> = {
  rejection: 'plans.pending_reason.rejection',
};

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
   * Primer cobro pendiente (S15): el BE deja la suscripción en `pending` mientras
   * el cobro de la primera mensualidad no se acredita, con la tarjeta ya inscripta.
   */
  readonly isPending = computed(() => this.store.subscription()?.status === 'pending');

  /** Último intento de cobro (`last_payment` del mismo GET /subscription). */
  private readonly lastPayment = computed(() => this.store.lastPayment());

  /**
   * El cobro se intentó y el proveedor lo rechazó: acá sí hay algo que reintentar.
   * Con `last_payment === null` la sub está pending pero el cobro aún no se intentó.
   */
  readonly chargeFailed = computed(() => this.lastPayment()?.status === 'failed');

  /** Código del proveedor cuando el cobro falló (nunca se inventa un motivo). */
  readonly failureCode = computed(() => (this.chargeFailed() ? this.lastPayment()?.failure_code ?? null : null));

  private readonly charging = signal(false);
  /** true mientras el POST de checkout está en vuelo (evita doble cobro por click). */
  readonly checkingOut = this.charging.asReadonly();

  private readonly checkoutFailure = signal<number | null>(null);
  /** true cuando el último intento de cobro lanzado desde acá terminó en error. */
  readonly checkoutError = computed(() => this.checkoutFailure() !== null);

  /** Copy del error según la respuesta del BE (404/403/503/otro), no un texto único. */
  readonly checkoutErrorKey = computed(() => {
    switch (this.checkoutFailure()) {
      case 404: return 'plans.checkout.no_subscription';
      case 403: return 'plans.checkout.no_role';
      case 503: return 'plans.checkout.provider_down';
      case 402: return 'plans.checkout.rejected';
      default: return 'plans.checkout.failed';
    }
  });

  /** Motivo de rechazo del proveedor cuando lo conocemos; copy genérico si no. */
  readonly failureMessageKey = computed(() => {
    const code = this.failureCode();
    return code && KEY_BY_FAILURE_CODE[code] ? KEY_BY_FAILURE_CODE[code] : 'plans.pending_reason.generic';
  });

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
   * inscripción (S15): reintentar no puede cobrar dos veces. El store relee la
   * suscripción, así que en éxito el banner desaparece solo y en rechazo trae el
   * `failure_code` real del último intento.
   */
  retryCheckout(): void {
    if (this.charging()) return;
    this.charging.set(true);
    this.checkoutFailure.set(null);
    this.store.checkout().subscribe({
      next: () => this.charging.set(false),
      error: (err: { status?: number }) => {
        this.charging.set(false);
        this.checkoutFailure.set(err?.status ?? 0);
      },
    });
  }
}
