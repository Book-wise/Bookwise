import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { LanguageService } from '@services/language.service';
import { HttpErrorService } from '@services/http-error.service';
import { SubscriptionStore } from '@core/stores/subscription.store';
import { PlanCatalogEntry, PlanCatalogGroup } from '@models';
import { formatCLP } from '@shared/config/currency.config';
import { planLabel } from '@shared/utils/plan-label.util';

type BillingInterval = 'month' | 'year';

/**
 * Página "Planes y precios" (/admin/planes) — cambio de plan.
 *
 * Consume el catálogo REAL del backend (GET /v1/plans, público y cacheado) y la
 * suscripción de la cuenta (GET /v1/subscription, cacheada) para mostrar:
 *  - modalidad de pago (mensual / anual),
 *  - los planes disponibles en esa modalidad,
 *  - un panel con el plan actual y los add-ons ya contratados.
 *
 * El cobro todavía no está integrado (backend sin gateway): esta pantalla
 * presenta la información y la selección; el submit real se cablea cuando el
 * endpoint de cambio de plan esté habilitado para la UI.
 */
@Component({
  selector: 'bw-plans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardModule, ButtonModule, SkeletonModule],
  templateUrl: './plans.component.html',
  styleUrls: ['./plans.component.scss'],
})
export class PlansComponent implements OnInit {
  readonly lang = inject(LanguageService);
  private readonly store = inject(SubscriptionStore);
  private readonly httpError = inject(HttpErrorService);
  private readonly router = inject(Router);

  readonly catalog = this.store.plans;
  readonly loading = computed(() => this.store.loading().plans);

  /** Plan vigente de la cuenta (null si no hay suscripción viva). */
  readonly currentPlan = computed(() => this.store.subscription()?.plan ?? null);
  readonly currentSlug = computed(() => this.currentPlan()?.slug ?? null);
  /** Intervalo REAL que paga hoy la cuenta (month | year). */
  readonly currentInterval = computed(() => this.currentPlan()?.billing_interval ?? null);

  /**
   * Modalidad visible: arranca en la que paga la cuenta (llega del backend) y
   * queda editable. La cuenta tiene UNA sola modalidad — el toggle solo cambia
   * qué precios se muestran, no duplica el plan.
   */
  readonly interval = linkedSignal<BillingInterval>(() => this.currentInterval() ?? 'month');

  /** Plan seleccionado por el usuario (slug); null = todavía no eligió. */
  readonly selectedSlug = signal<string | null>(null);

  /**
   * Slug marcado en la lista. Sin elección explícita se marca el plan actual,
   * pero SOLO en su propia modalidad: como la cuenta tiene un único plan, en la
   * otra pestaña no hay nada seleccionado.
   */
  readonly effectiveSelectedSlug = computed(() => {
    const explicit = this.selectedSlug();
    if (explicit) return explicit;
    return this.currentInterval() === this.interval() ? this.currentSlug() : null;
  });

  /** Add-ons contratados por la cuenta (vienen en GET /v1/subscription). */
  readonly addons = computed(() => this.store.subscription()?.addons ?? []);
  readonly addonsTotal = computed(() => this.store.subscription()?.addons_total_clp ?? 0);
  readonly totalPrice = computed(() => this.store.subscription()?.total_price_clp ?? 0);

  /** Catálogo de packs disponibles (credits + precio por canal). */
  readonly addonCatalog = computed(() => this.store.subscription()?.addon_catalog ?? []);
  /** Tipo de add-on que se está persistiendo (para el spinner del stepper). */
  readonly savingAddon = signal<string | null>(null);

  ngOnInit(): void {
    this.store.loadPlans();
    this.store.loadSubscription();
  }

  setInterval(value: BillingInterval): void {
    this.interval.set(value);
  }

  /** Entrada del catálogo para el intervalo activo (fallback al primero). */
  entryFor(group: PlanCatalogGroup): PlanCatalogEntry | null {
    const interval = this.interval();
    return group.plans.find((p) => p.billing_interval === interval) ?? group.plans[0] ?? null;
  }

  /** Nombre legible del plan (i18n, fallback al slug). */
  label(group: PlanCatalogGroup): string {
    return planLabel(this.lang, group.slug);
  }

  /** Precio formateado para el intervalo activo. */
  priceLabel(group: PlanCatalogGroup): string {
    const entry = this.entryFor(group);
    if (!entry) return '';
    const suffix = entry.billing_interval === 'year' ? '/año' : '/mes';
    return `${formatCLP(entry.price_clp)} ${suffix}`;
  }

  /**
   * True solo si la opción representa EXACTAMENTE lo que la cuenta paga hoy:
   * mismo slug Y mismo intervalo. Un plan mensual vigente NO está "activo" en
   * la pestaña anual (ahí es una oferta con descuento, no su plan actual).
   */
  isCurrent(group: PlanCatalogGroup): boolean {
    return this.currentSlug() === group.slug && this.currentInterval() === this.interval();
  }

  isSelected(group: PlanCatalogGroup): boolean {
    return this.effectiveSelectedSlug() === group.slug;
  }

  selectPlan(group: PlanCatalogGroup): void {
    this.selectedSlug.set(group.slug);
  }

  /** Beneficios del plan en el intervalo activo (solo cupos definidos). */
  features(group: PlanCatalogGroup): string[] {
    const p = this.entryFor(group);
    if (!p) return [];
    const items: string[] = [];
    if (p.max_tenants != null) items.push(this.lang.t('plans.detail.tenants', { n: String(p.max_tenants) }));
    if (p.max_profesionales != null) items.push(this.lang.t('plans.detail.professionals', { n: String(p.max_profesionales) }));
    if (p.max_locations != null) items.push(this.lang.t('plans.detail.locations', { n: String(p.max_locations) }));
    if (p.max_users != null) items.push(this.lang.t('plans.detail.users', { n: String(p.max_users) }));
    if (p.email_monthly_limit != null) items.push(this.lang.t('plans.detail.email', { n: String(p.email_monthly_limit) }));
    if (p.whatsapp_monthly_limit != null) items.push(this.lang.t('plans.detail.whatsapp', { n: String(p.whatsapp_monthly_limit) }));
    return items;
  }

  /** Etiqueta legible de un add-on contratado (canal + packs). */
  addonLabel(addon: { type: string; quantity: number; credits_per_pack: number }): string {
    const channel = addon.type === 'whatsapp'
      ? this.lang.t('billing.usage.whatsapp')
      : this.lang.t('billing.usage.email');
    const credits = addon.quantity * addon.credits_per_pack;
    return `${channel} · ${this.lang.t('plans.addon_credits', { n: String(credits) })}`;
  }

  price(value: number): string {
    return formatCLP(value);
  }

  // ── Add-ons (packs de confirmaciones) ───────────────────────────────────────

  /** Cantidad de packs contratados de un canal. */
  quantityFor(type: string): number {
    return this.addons().find((a) => a.type === type)?.quantity ?? 0;
  }

  /** Créditos totales del canal hoy (límite del plan + packs contratados). */
  creditsFor(type: string): number {
    const plan = this.currentPlan();
    if (!plan) return 0;
    const base = type === 'whatsapp'
      ? (plan.whatsapp_monthly_limit ?? 0)
      : (plan.email_monthly_limit ?? 0);
    const extra = this.addons()
      .filter((a) => a.type === type)
      .reduce((sum, a) => sum + a.quantity * a.credits_per_pack, 0);
    return base + extra;
  }

  /** Suma/resta un pack de un canal (PUT /subscription/addons). */
  changeQuantity(type: 'email' | 'whatsapp', delta: number): void {
    if (this.savingAddon()) return;
    const next = Math.max(0, Math.min(100, this.quantityFor(type) + delta));
    if (next === this.quantityFor(type)) return;

    this.savingAddon.set(type);
    this.store.setAddon(type, next).subscribe({
      next: () => this.savingAddon.set(null),
      error: (err) => {
        this.savingAddon.set(null);
        this.httpError.handle(err, this.lang.t('plans.addons_title'));
      },
    });
  }

  /** CTA de un plan no actual: la pantalla de facturación concentra el cobro. */
  goToBilling(): void {
    this.router.navigate(['/admin/facturacion']);
  }
}
