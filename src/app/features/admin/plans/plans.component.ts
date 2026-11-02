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
 * Página "Administrar plan" (/admin/planes/administrar) — cambio de plan.
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
 *
 * La vista de SOLO LECTURA vive en `/admin/planes` (my-plan.component).
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

  /** Catálogo de packs disponibles (credits + precio por canal). */
  readonly addonCatalog = computed(() => this.store.subscription()?.addon_catalog ?? []);
  /**
   * Borrador de add-ons: cantidad objetivo por canal, solo para los canales que
   * el usuario cambió y todavía NO se persistieron. El stepper escribe acá y
   * nada llega al backend hasta que se confirma (barra flotante).
   */
  readonly draftAddons = signal<Partial<Record<'email' | 'whatsapp', number>>>({});
  /** True mientras se aplican los PUT del borrador (barra flotante en curso). */
  readonly confirming = signal(false);

  /** Canales con los que trabaja la pantalla (catálogo primero, luego persistidos). */
  private readonly channelTypes = computed<string[]>(() => {
    const types = new Set<string>();
    for (const item of this.addonCatalog()) types.add(item.type);
    for (const addon of this.addons()) types.add(addon.type);
    return [...types];
  });

  /** Cambios del borrador respecto de lo persistido (canal por canal). */
  readonly pendingAddons = computed(() => {
    const draft = this.draftAddons();
    const pending: { type: string; from: number; to: number }[] = [];
    for (const type of this.channelTypes()) {
      const target = draft[type as 'email' | 'whatsapp'];
      if (target == null) continue;
      const from = this.serverQuantity(type);
      if (target !== from) pending.push({ type, from, to: target });
    }
    return pending;
  });

  readonly hasDraftChanges = computed(() => this.pendingAddons().length > 0);

  /** Add-ons que muestra el resumen: canal con packs, ya en el borrador. */
  readonly summaryAddons = computed(() =>
    this.channelTypes()
      .map((type) => {
        const quantity = this.quantityFor(type);
        return {
          type,
          quantity,
          credits: quantity * this.creditsPerPack(type),
          price: quantity * this.unitPrice(type),
        };
      })
      .filter((line) => line.quantity > 0),
  );

  /** Subtotal de add-ons con el borrador aplicado. */
  readonly addonsSubtotal = computed(() =>
    this.summaryAddons().reduce((sum, line) => sum + line.price, 0),
  );

  /** Total del período (plan + add-ons) con el borrador aplicado. */
  readonly draftTotal = computed(() => (this.currentPlan()?.price_clp ?? 0) + this.addonsSubtotal());

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

  /** Etiqueta legible de una línea del resumen (canal + créditos del borrador). */
  addonLabel(line: { type: string; credits: number }): string {
    const channel = this.lang.t(`billing.usage.${line.type}`);
    return `${channel} · ${this.lang.t('plans.addon_credits', { n: String(line.credits) })}`;
  }

  price(value: number): string {
    return formatCLP(value);
  }

  // ── Add-ons (packs de confirmaciones) ───────────────────────────────────────

  /** Cantidad de packs persistida en el servidor para un canal. */
  serverQuantity(type: string): number {
    return this.addons().find((a) => a.type === type)?.quantity ?? 0;
  }

  /** Cantidad visible: la del borrador si el canal tiene cambios pendientes. */
  quantityFor(type: string): number {
    return this.draftAddons()[type as 'email' | 'whatsapp'] ?? this.serverQuantity(type);
  }

  /** Créditos por pack del canal (catálogo; fallback al add-on persistido). */
  creditsPerPack(type: string): number {
    const fromCatalog = this.addonCatalog().find((i) => i.type === type)?.credits_per_pack;
    if (fromCatalog != null) return fromCatalog;
    return this.addons().find((a) => a.type === type)?.credits_per_pack ?? 0;
  }

  /** Precio de un pack del canal (catálogo; fallback al precio persistido). */
  unitPrice(type: string): number {
    const fromCatalog = this.addonCatalog().find((i) => i.type === type)?.price_clp;
    if (fromCatalog != null) return fromCatalog;
    const addon = this.addons().find((a) => a.type === type);
    if (!addon || addon.quantity === 0) return 0;
    return Math.round(addon.price_clp / addon.quantity);
  }

  /** Créditos totales del canal (límite del plan + packs del borrador). */
  creditsFor(type: string): number {
    const plan = this.currentPlan();
    if (!plan) return 0;
    const base = type === 'whatsapp'
      ? (plan.whatsapp_monthly_limit ?? 0)
      : (plan.email_monthly_limit ?? 0);
    return base + this.quantityFor(type) * this.creditsPerPack(type);
  }

  /**
   * Suma/resta un pack de un canal en el BORRADOR (sin tocar el backend).
   * Volver a la cantidad persistida borra el cambio pendiente del canal.
   */
  changeQuantity(type: 'email' | 'whatsapp', delta: number): void {
    if (this.confirming()) return;
    const current = this.quantityFor(type);
    const next = Math.max(0, Math.min(100, current + delta));
    if (next === current) return;

    const draft = { ...this.draftAddons() };
    if (next === this.serverQuantity(type)) delete draft[type];
    else draft[type] = next;
    this.draftAddons.set(draft);
  }

  /** Descarta el borrador y vuelve a lo persistido. */
  cancelChanges(): void {
    if (this.confirming()) return;
    this.draftAddons.set({});
  }

  /**
   * Aplica el borrador: un PUT por canal cambiado, en serie. Si uno falla, corta
   * y deja los cambios pendientes (incluido el fallido) para reintentar.
   */
  confirmChanges(): void {
    if (this.confirming()) return;
    const pending = this.pendingAddons();
    if (pending.length === 0) return;

    this.confirming.set(true);
    this.applyPending([...pending]);
  }

  private applyPending(queue: { type: string; from: number; to: number }[]): void {
    const [item, ...rest] = queue;
    if (!item) {
      this.confirming.set(false);
      return;
    }

    this.store.setAddon(item.type as 'email' | 'whatsapp', item.to).subscribe({
      next: () => {
        this.dropDraft(item.type);
        this.applyPending(rest);
      },
      error: (err) => {
        this.confirming.set(false);
        this.httpError.handle(err, this.lang.t('plans.addons_title'));
      },
    });
  }

  private dropDraft(type: string): void {
    const draft = { ...this.draftAddons() };
    delete draft[type as 'email' | 'whatsapp'];
    this.draftAddons.set(draft);
  }

  /** CTA de un plan no actual: la pantalla de facturación concentra el cobro. */
  goToBilling(): void {
    this.router.navigate(['/admin/facturacion']);
  }
}
