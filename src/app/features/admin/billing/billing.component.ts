import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@services/auth.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { SubscriptionStore } from '@core/stores/subscription.store';
import { ConfirmationUsage, Quota } from '@models';
import { formatCLP } from '@shared/config/currency.config';

// ── Interfaces locales del chart (misma forma que en el dashboard) ─────────────
interface ChartDataset {
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
  fill?: boolean;
  tension?: number;
  label?: string;
}
interface BillingChartData {
  labels: string[];
  datasets: ChartDataset[];
}
interface BillingChartOptions {
  responsive?: boolean;
  resizeDelay?: number;
  plugins?: Record<string, unknown>;
  maintainAspectRatio?: boolean;
  scales?: Record<string, unknown>;
  interaction?: Record<string, unknown>;
}

type UsageStatus = 'success' | 'warning' | 'danger';

type UsageMetricKey = 'tenants' | 'users' | 'professionals' | 'locations' | 'email' | 'whatsapp';

interface UsageMetric {
  key: UsageMetricKey;
  icon: string;
  used: number;
  limit: number;
  // Etiquetas pre-formateadas para mostrar con la separación de miles adecuada
  usedLabel: string;
  limitLabel: string;
  remaining: number;
  hintKey: string;
  hintParams?: Record<string, string>;
  byTenantLabel?: string;
}

const PRIMARY_COLOR = '#046af4';          // azul marca (--bw-300)
const VIOLET_COLOR  = '#7c3aed';          // serie Profesionales
const GREEN_COLOR   = '#22c55e';          // --bw-success (serie Clientes)

const STATUS_COLOR: Record<UsageStatus, string> = {
  success: '#22c55e',
  warning: '#f59e0b',
  danger:  '#ef4444',
};

/** Convierte un color hex (#rrggbb) a rgba con la opacidad dada. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

@Component({
  selector: 'bw-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardModule, ButtonModule, ChartModule, ProgressBarModule, SkeletonModule, RouterModule],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.scss'],
})
export class BillingComponent implements OnInit {
  readonly lang = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(SubscriptionStore);
  private readonly httpError = inject(HttpErrorService);
  private readonly router = inject(Router);

  // ════════════════════════════════════════════════════════════════════════════
  // SECCIONES MOCK — solo lo que AÚN no tiene endpoint.
  //
  // TODO FASE 6: GET /v1/payment-methods → última tarjeta para el resumen.
  // TODO FASE 6: GET /v1/invoices      → historial de facturación (vive en billing-history.component).
  //
  // Real (ya cableado, vía SubscriptionStore):
  // - GET /v1/subscription       → plan activo, precio, período y estado.
  // - GET /v1/subscription/usage → uso vs límite + add-ons (pack_credit).
  //
  // "Consumo mensual" (serie histórica) sigue mock hasta que exista su endpoint.
  // ════════════════════════════════════════════════════════════════════════════

  constructor() {
    // El error de uso se traduce a un toast (una única vez por fallo).
    effect(() => {
      const err = this.store.error().usage;
      if (err) this.httpError.handle(err, this.lang.t('billing.usage_title'));
    });
  }

  /** Suscripción de la cuenta (cacheada por el store). */
  readonly subscription = this.store.subscription;
  /** Uso vs límite (cacheado por el store). */
  readonly usage = this.store.usage;
  readonly loading = computed(() => this.store.loading().usage);

  /** Plan vigente de la suscripción (null mientras no haya suscripción viva). */
  readonly plan = computed(() => this.subscription()?.plan ?? null);

  readonly planName = computed(() => this.plan()?.name ?? '');
  readonly planPriceLabel = computed(() => {
    const p = this.plan();
    if (!p) return '';
    const suffix = p.billing_interval === 'year' ? '/año' : '/mes';
    return `${formatCLP(p.price_clp)} ${suffix}`;
  });
  /** Etiqueta del intervalo de facturación (mensual/anual). */
  readonly billingIntervalLabel = computed(() => {
    const p = this.plan();
    if (!p) return '';
    return p.billing_interval === 'year'
      ? this.lang.t('billing.yearly_billing')
      : this.lang.t('billing.monthly_billing');
  });
  /** Número de cuenta real (desde GET /usage → account_id). */
  readonly accountId = computed(() => {
    const id = this.usage()?.account_id;
    return id != null ? String(id) : '—';
  });
  /** Referencia pública corta de la cuenta (BW-XXXXXX), sin exponer el PK. */
  readonly accountRef = computed(() => this.usage()?.account_reference ?? '');
  /** Próxima renovación real (desde GET /subscription → next_billing_at). */
  readonly renewalDate = computed(() => this.fmtDate(this.subscription()?.next_billing_at));
  readonly periodStart = computed(() => this.fmtPeriod(this.subscription()?.current_period_start));
  readonly periodEnd = computed(() => this.fmtPeriod(this.subscription()?.current_period_end));
  readonly daysLeft = computed(() => this.fmtDaysLeft(this.subscription()?.current_period_end));
  /** % del período ya transcurrido (0-100) — solo visual. */
  readonly periodProgress = computed(() => {
    const s = this.subscription();
    if (!s?.current_period_start || !s?.current_period_end) return 0;
    const start = new Date(s.current_period_start).getTime();
    const end = new Date(s.current_period_end).getTime();
    const now = Date.now();
    if (end <= start) return 0;
    const pct = Math.round(((now - start) / (end - start)) * 100);
    return Math.min(100, Math.max(0, pct));
  });

  /** Ventana del período de consumo real (desde GET /usage → confirmations). */
  readonly usagePeriodLabel = computed(() => {
    const c = this.usage()?.confirmations?.email;
    if (!c?.period_start || !c?.period_end) return '';
    return this.lang.t('billing.usage_period', {
      start: this.fmtPeriod(c.period_start),
      end: this.fmtPeriod(c.period_end),
    });
  });

  // Datos de pago e historial: aún sin endpoint → mock.
  // (tarjeta no se muestra: no mantenemos info de pago todavía)

  private readonly businessNames = computed<Map<number, string>>(() => {
    const map = new Map<number, string>();
    for (const b of this.auth.me()?.businesses ?? []) {
      map.set(b.id, b.name);
    }
    return map;
  });

  /** Métricas del "Uso del plan": tenants/users (cuota de cuenta), profesionales
   *  y sucursales (suma de `businesses[]`), y consumo de confirmaciones por canal. */
  readonly usageMetrics = computed<UsageMetric[]>(() => {
    const u = this.usage();
    if (!u) return [];

    const professionalsCurrent = u.businesses.reduce((sum, b) => sum + b.professionals.current, 0);
    const professionalsLimit   = u.businesses.reduce((sum, b) => sum + b.professionals.limit, 0);
    const locationsCurrent     = u.businesses.reduce((sum, b) => sum + b.locations.current, 0);
    const locationsLimit       = u.businesses.reduce((sum, b) => sum + b.locations.limit, 0);

    const quotaMetric = (key: UsageMetricKey, icon: string, q: Quota): UsageMetric => ({
      key,
      icon,
      used: q.current,
      limit: q.limit,
      usedLabel: this.fmtCount(q.current),
      limitLabel: this.fmtCount(q.limit),
      remaining: q.limit - q.current,
      hintKey: 'billing.usage.remaining_hint',
      hintParams: { n: this.fmtCount(q.limit - q.current) },
    });

    const confirmationMetric = (
      key: 'email' | 'whatsapp',
      icon: string,
      c: ConfirmationUsage,
    ): UsageMetric => {
      const byTenantLabel = c.by_tenant
        .map((t) => `${this.businessName(t.tenant_id)}: ${this.fmtCount(t.consumed)}`)
        .join(', ');
      return {
        key,
        icon,
        used: c.consumed,
        limit: c.limit,
        usedLabel: this.fmtCount(c.consumed),
        limitLabel: this.fmtCount(c.limit),
        remaining: c.remaining,
        hintKey: 'billing.usage.confirmations_hint',
        hintParams: { remaining: this.fmtCount(c.remaining), byTenant: byTenantLabel || '—' },
        byTenantLabel,
      };
    };

    return [
      quotaMetric('tenants', 'pi pi-building', u.tenants),
      quotaMetric('users', 'pi pi-users', u.users),
      quotaMetric('professionals', 'pi pi-id-card', { limit: professionalsLimit, current: professionalsCurrent }),
      quotaMetric('locations', 'pi pi-map-marker', { limit: locationsLimit, current: locationsCurrent }),
      confirmationMetric('email', 'pi pi-envelope', u.confirmations.email),
      confirmationMetric('whatsapp', 'pi pi-whatsapp', u.confirmations.whatsapp),
    ];
  });

  ngOnInit(): void {
    this.store.loadUsage();
    this.store.loadSubscription();
  }

  private businessName(tenantId: number): string {
    return this.businessNames().get(tenantId) ?? `#${tenantId}`;
  }

  private fmtCount(n: number): string {
    const locale = this.lang.lang() === 'es' ? 'es-CL' : 'en-US';
    return n.toLocaleString(locale);
  }

  /** Fecha corta del período (ej. "12 Nov") según el idioma. */
  private fmtPeriod(iso: string | null | undefined): string {
    if (!iso) return '—';
    const locale = this.lang.lang() === 'es' ? 'es-CL' : 'en-US';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(iso));
  }

  /** Fecha con año (ej. "12 Nov 2026") para la próxima renovación. */
  private fmtDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const locale = this.lang.lang() === 'es' ? 'es-CL' : 'en-US';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  }

  /** Días restantes del período (número como string). */
  private fmtDaysLeft(iso: string | null | undefined): string {
    if (!iso) return '0';
    const end = new Date(iso).getTime();
    const days = Math.ceil((end - Date.now()) / 86_400_000);
    return String(Math.max(0, days));
  }

  /** Límites del plan actual + add-ons activos (pack_credit), como features. */
  readonly planFeatures = computed<string[]>(() => {
    const plan = this.plan();
    if (!plan) return [];

    const items: string[] = [];
    if (plan.max_tenants != null) items.push(this.lang.t('plans.detail.tenants', { n: String(plan.max_tenants) }));
    if (plan.max_profesionales != null) items.push(this.lang.t('plans.detail.professionals', { n: String(plan.max_profesionales) }));
    if (plan.max_locations != null) items.push(this.lang.t('plans.detail.locations', { n: String(plan.max_locations) }));
    if (plan.max_users != null) items.push(this.lang.t('plans.detail.users', { n: String(plan.max_users) }));
    if (plan.email_monthly_limit != null) items.push(this.lang.t('plans.detail.email', { n: String(plan.email_monthly_limit) }));
    if (plan.whatsapp_monthly_limit != null) items.push(this.lang.t('plans.detail.whatsapp', { n: String(plan.whatsapp_monthly_limit) }));

    // Add-ons: créditos extra por packs de confirmación ya contratados.
    const u = this.usage();
    if (u) {
      const emailPack = u.confirmations.email.pack_credit;
      const waPack = u.confirmations.whatsapp.pack_credit;
      if (emailPack > 0) items.push(this.lang.t('billing.addon.email', { n: String(emailPack) }));
      if (waPack > 0) items.push(this.lang.t('billing.addon.whatsapp', { n: String(waPack) }));
    }

    return items;
  });

  // ── Consumo mensual (chart) ────────────────────────────────────────────────
  /** Etiquetas de mes (últimos 6 meses) sensibles al idioma. */
  readonly consumptionLabels = computed<string[]>(() => {
    const locale = this.lang.lang() === 'es' ? 'es-CL' : 'en-US';
    return [5, 4, 3, 2, 1, 0].map((offset) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - offset);
      return new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
    });
  });

  readonly consumptionData = computed<BillingChartData>(() => ({
    labels: this.consumptionLabels(),
    datasets: [
      {
        label: this.lang.t('billing.usage.locations'),
        data: [2, 2, 3, 3, 3, 3],
        fill: false,
        borderColor: PRIMARY_COLOR,
        backgroundColor: hexToRgba(PRIMARY_COLOR, 0.1),
        tension: 0.4,
      },
      {
        label: this.lang.t('billing.usage.providers'),
        data: [4, 5, 5, 6, 6, 7],
        fill: false,
        borderColor: VIOLET_COLOR,
        backgroundColor: hexToRgba(VIOLET_COLOR, 0.1),
        tension: 0.4,
      },
      {
        label: this.lang.t('billing.usage.clients'),
        data: [12500, 18200, 24600, 30400, 36100, 41200],
        fill: false,
        borderColor: GREEN_COLOR,
        backgroundColor: hexToRgba(GREEN_COLOR, 0.1),
        tension: 0.4,
      },
    ],
  }));

  readonly lineOptions: BillingChartOptions = {
    responsive: true,
    resizeDelay: 0,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, boxHeight: 12, padding: 14, font: { size: 11 } },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
      },
      y: {
        beginAtZero: true,
        ticks: { maxTicksLimit: 6, precision: 0 },
      },
    },
  };

  // ── Helpers de uso (pct / estado / hint) ───────────────────────────────────
  pctOf(metric: UsageMetric): number {
    if (!metric.limit) return 0;
    return Math.round((metric.used / metric.limit) * 100);
  }

  /** True cuando la métrica ya consumió el total permitido (sin cupo restante). */
  isAtLimit(metric: UsageMetric): boolean {
    return metric.limit > 0 && metric.used >= metric.limit;
  }

  usageStatus(metric: UsageMetric): UsageStatus {
    const pct = this.pctOf(metric);
    if (pct > 90) return 'danger';
    if (pct >= 70) return 'warning';
    return 'success';
  }

  usageChipClass(metric: UsageMetric): string {
    return `bw-chip--${this.usageStatus(metric)}`;
  }

  /** Texto de ayuda de cada métrica; los parámetros se interpolan en el i18n. */
  usageHint(metric: UsageMetric): string {
    return this.lang.t(metric.hintKey, metric.hintParams);
  }

  statusColor(metric: UsageMetric): string {
    return STATUS_COLOR[this.usageStatus(metric)];
  }

  /** Botón "Facturas": navega al historial de facturación. */
  goToHistory(): void {
    this.router.navigate(['/admin/facturacion/historial']);
  }

  /** CTA "Mejora tu plan" → administrar plan. */
  goToPlans(): void {
    this.router.navigate(['/admin/planes/administrar']);
  }
}
