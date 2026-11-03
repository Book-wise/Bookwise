import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { LanguageService } from '@services/language.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { AuthService } from '@services/auth.service';
import { BwCurrencyPipe } from '@shared/pipes/bw-currency.pipe';
import type { Service, ServicePack } from '@models';
import {
  normalizeSearch,
  pricePerSession,
  serviceInitials,
  termsForService,
} from './services-terms.util';

export type StatusFilter = 'all' | 'active' | 'inactive';
export type ListView = 'cards' | 'list';

/** Un servicio del catálogo con sus términos (packs) ya resueltos. */
export interface ServiceRow {
  service: Service;
  terms: ServicePack[];
}

/**
 * Servicios y packs — pantalla de consulta de `/admin/packs`.
 *
 * Los «términos» de un servicio son sus `service_packs` (`service_id`), que hoy
 * son la única fuente de sesiones y precios por variación. La pantalla es de
 * SOLO LECTURA: el backend todavía no expone `POST/PATCH /services` ni `/packs`,
 * así que no hay alta ni edición y no se muestran acciones sin handler.
 *
 * Sin `compare_at_price` no hay badge de descuento: no se inventan porcentajes.
 */
@Component({
  selector: 'bw-packs-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SkeletonModule, BwCurrencyPipe],
  templateUrl: './packs-list.component.html',
  styleUrls: ['./packs-list.component.scss'],
})
export class PacksListComponent implements OnInit {
  private readonly refStore = inject(ReferenceStore);
  private readonly auth = inject(AuthService);
  private readonly lang = inject(LanguageService);

  private readonly VIEW_PREFIX = 'bw:services:vista';

  /** Catálogo compartido (una sola carga por sesión, ver ReferenceStore). */
  readonly services = computed<Service[]>(() => this.refStore.services());
  readonly packs = computed<ServicePack[]>(() => this.refStore.packs());
  readonly loading = computed(
    () => !this.refStore.loaded().services || !this.refStore.loaded().packs,
  );
  /** Error de carga reportado por el store (por entidad). */
  readonly loadError = computed<string | null>(
    () => this.refStore.error().services ?? this.refStore.error().packs,
  );

  readonly search = signal('');
  readonly status = signal<StatusFilter>('all');
  readonly view = signal<ListView>('cards');
  readonly expandedId = signal<number | null>(null);
  readonly suggestionDismissed = signal(false);
  readonly onlyMissing = signal(false);

  /** Servicios con sus términos, ordenados por sesiones. */
  readonly rows = computed<ServiceRow[]>(() =>
    this.services().map((service) => ({
      service,
      terms: termsForService(this.packs(), service.id),
    })),
  );

  /** Variaciones activas totales (lo que el negocio puede vender hoy). */
  readonly activeTermsCount = computed(() =>
    this.rows().reduce((total, row) => total + row.terms.filter((t) => t.active).length, 0),
  );

  /** Servicios que hoy no ofrecen ninguna variación activa. */
  readonly missingServices = computed<ServiceRow[]>(() =>
    this.rows().filter((row) => !row.terms.some((t) => t.active)),
  );

  readonly showSuggestion = computed(
    () => this.missingServices().length > 0 && !this.suggestionDismissed(),
  );

  readonly subtitle = computed(() =>
    this.lang.t('packs.subtitle', {
      services: String(this.services().length),
      variations: String(this.activeTermsCount()),
    }),
  );

  readonly visibleRows = computed<ServiceRow[]>(() => {
    const term = normalizeSearch(this.search());
    const status = this.status();
    const onlyMissing = this.onlyMissing();

    return this.rows().filter((row) => {
      if (onlyMissing && row.terms.some((t) => t.active)) return false;
      if (status === 'active' && !row.service.active) return false;
      if (status === 'inactive' && row.service.active) return false;
      if (term && !normalizeSearch(row.service.name).includes(term)) return false;
      return true;
    });
  });

  readonly isEmpty = computed(() => !this.loading() && this.services().length === 0);
  readonly isFilteredEmpty = computed(
    () => !this.loading() && this.services().length > 0 && this.visibleRows().length === 0,
  );

  ngOnInit(): void {
    this.view.set(this.readStoredView());
    this.ensureReferenceData();
  }

  /**
   * Servicios y packs viven en el `ReferenceStore`, que ya hidrata el catálogo
   * completo una sola vez por sesión. Solo pedimos una entidad si nadie la
   * cargó todavía, para no duplicar requests al entrar a la pantalla.
   */
  private ensureReferenceData(): void {
    const loaded = this.refStore.loaded();
    const loading = this.refStore.loading();

    if (!loaded.services && !loading.services) this.refStore.loadServices();
    if (!loaded.packs && !loading.packs) this.refStore.loadPacks();
  }

  t(key: string, params?: Record<string, string>): string {
    return this.lang.t(key, params);
  }

  sessionsLabel(totalSessions: number): string {
    return this.lang.t(
      totalSessions === 1 ? 'packs.term.sessions_one' : 'packs.term.sessions_other',
      { count: String(totalSessions) },
    );
  }

  /** Helper de plantilla: los parámetros de i18n son strings. */
  str(value: number): string {
    return String(value);
  }

  initials(name: string): string {
    return serviceInitials(name);
  }

  perSession(pack: ServicePack): number {
    return pricePerSession(pack.price, pack.total_sessions);
  }

  perSessionLabel(pack: ServicePack): string {
    return this.lang.t('packs.term.per_session', {
      price: this.formatClp(this.perSession(pack)),
    });
  }

  private formatClp(value: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    })
      .format(Math.round(value))
      .replace(/\s/g, '');
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  setStatus(value: string): void {
    this.status.set(value as StatusFilter);
  }

  setView(next: ListView): void {
    this.view.set(next);
    this.persistView(next);
  }

  toggleRow(serviceId: number): void {
    this.expandedId.set(this.expandedId() === serviceId ? null : serviceId);
  }

  dismissSuggestion(): void {
    this.suggestionDismissed.set(true);
  }

  reviewMissing(): void {
    this.onlyMissing.set(true);
  }

  clearMissingFilter(): void {
    this.onlyMissing.set(false);
  }

  trackRow(_index: number, row: ServiceRow): number {
    return row.service.id;
  }

  // ── Preferencia de vista (por usuario y tenant) ───────────────────────────
  private viewKey(): string {
    const user = this.auth.user();
    return `${this.VIEW_PREFIX}:${user?.id ?? 0}:${user?.tenant_id ?? 0}`;
  }

  private readStoredView(): ListView {
    try {
      const stored = localStorage.getItem(this.viewKey());
      return stored === 'list' ? 'list' : 'cards';
    } catch {
      return 'cards';
    }
  }

  private persistView(view: ListView): void {
    try {
      localStorage.setItem(this.viewKey(), view);
    } catch {
      /* storage no disponible: la preferencia vive solo en memoria */
    }
  }
}
