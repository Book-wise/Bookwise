import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { LanguageService } from '@services/language.service';
import { ServicesStore } from '@core/stores/services.store';
import { AuthService } from '@services/auth.service';
import { BwCurrencyPipe } from '@shared/pipes/bw-currency.pipe';
import type { Service, ServicePack } from '@models';
import {
  normalizeSearch,
  pricePerSession,
  serviceInitials,
  termsForService,
} from './services-terms.util';
import { buildWooCsv, buildWooRows, serviceFingerprint } from './services-export.util';
import { ServicesExportStore } from './services-export.store';
import type { WooSyncState } from './services-export.store';
import { ServiceFormDialogComponent } from './service-form-dialog/service-form-dialog.component';

export type StatusFilter = 'all' | 'active' | 'inactive';
export type ListView = 'cards' | 'list';
export type WooFilter = 'all' | 'changed' | 'never' | 'synced';
export type ExportScope = 'all' | 'changed' | 'selected';

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
 *
 * El exportador a WooCommerce (artboard 04) agrega: menú de alcance, barra de
 * sincronización, filtro `Woo:`, selección múltiple y estado por servicio. El
 * diálogo de validación previa del artboard 05 queda fuera de este alcance.
 */
@Component({
  selector: 'bw-packs-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SkeletonModule, BwCurrencyPipe, ServiceFormDialogComponent],
  templateUrl: './packs-list.component.html',
  styleUrls: [
    './packs-list.component.scss',
    './packs-list-table.scss',
    './packs-list-export.scss',
    './packs-list-mobile.scss',
  ],
})
export class PacksListComponent implements OnInit {
  private readonly servicesStore = inject(ServicesStore);
  private readonly auth = inject(AuthService);
  private readonly lang = inject(LanguageService);
  private readonly exportStore = inject(ServicesExportStore);

  private readonly VIEW_PREFIX = 'bw:services:vista';

  /** Catálogo compartido (una sola carga por sesión, ver ServicesStore). */
  readonly services = computed<Service[]>(() => this.servicesStore.services());
  readonly packs = computed<ServicePack[]>(() => this.servicesStore.packs());
  readonly loading = computed(
    () => !this.servicesStore.loaded().services || !this.servicesStore.loaded().packs,
  );
  /** Error de carga reportado por el store (por entidad). */
  readonly loadError = computed<string | null>(
    () => this.servicesStore.error().services ?? this.servicesStore.error().packs,
  );

  readonly search = signal('');
  readonly status = signal<StatusFilter>('all');
  readonly view = signal<ListView>('cards');
  readonly expandedId = signal<number | null>(null);
  readonly suggestionDismissed = signal(false);
  readonly onlyMissing = signal(false);

  // ── Diálogo de servicio (crear/editar) ────────────────────────────────────
  readonly dialogVisible = signal(false);
  readonly dialogMode = signal<'create' | 'edit'>('create');
  readonly dialogService = signal<Service | null>(null);

  // ── Exportador a WooCommerce ──────────────────────────────────────────────
  readonly wooFilter = signal<WooFilter>('all');
  readonly exportMenuOpen = signal(false);
  readonly selectedIds = signal<ReadonlySet<number>>(new Set<number>());

  @ViewChild('exportMenu') private readonly exportMenu?: ElementRef<HTMLElement>;

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

  /** Estado de sincronización por servicio (reactivo a las huellas persistidas). */
  readonly wooStates = computed<Map<number, WooSyncState>>(() => {
    const map = new Map<number, WooSyncState>();
    for (const row of this.rows()) {
      map.set(
        row.service.id,
        this.exportStore.stateFor(row.service.id, serviceFingerprint(row.service, row.terms)),
      );
    }
    return map;
  });

  readonly exportCounts = computed(() => this.exportStore.counts(this.rows()));
  readonly changesCount = computed(() => {
    const { changed, never } = this.exportCounts();
    return changed + never;
  });

  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly selectedVariationsCount = computed(() =>
    this.rows().reduce(
      (total, row) =>
        this.selectedIds().has(row.service.id)
          ? total + row.terms.filter((t) => t.active).length
          : total,
      0,
    ),
  );
  readonly hasSelection = computed(() => this.selectedCount() > 0);

  readonly syncLabel = computed(() => {
    const at = this.exportStore.lastExportAt();
    if (!at) return this.lang.t('packs.sync.never');
    return this.lang.t('packs.sync.last', { when: this.formatDateTime(at) });
  });

  readonly visibleRows = computed<ServiceRow[]>(() => {
    const term = normalizeSearch(this.search());
    const status = this.status();
    const onlyMissing = this.onlyMissing();
    const woo = this.wooFilter();

    return this.rows().filter((row) => {
      if (onlyMissing && row.terms.some((t) => t.active)) return false;
      if (status === 'active' && !row.service.active) return false;
      if (status === 'inactive' && row.service.active) return false;

      const wooState = this.stateFor(row);
      if (woo === 'changed' && wooState !== 'changed') return false;
      if (woo === 'never' && wooState !== 'new') return false;
      if (woo === 'synced' && wooState !== 'synced') return false;

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
   * Servicios y packs viven en el `ServicesStore`. Solo pedimos una entidad si
   * nadie la cargó todavía, para no duplicar requests al entrar a la pantalla.
   */
  private ensureReferenceData(): void {
    const loaded = this.servicesStore.loaded();
    const loading = this.servicesStore.loading();

    if (!loaded.services && !loading.services) this.servicesStore.loadServices();
    if (!loaded.packs && !loading.packs) this.servicesStore.loadPacks();
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

  // ── Filtros y vista ───────────────────────────────────────────────────────
  onSearch(value: string): void {
    this.search.set(value);
  }

  setStatus(value: string): void {
    this.status.set(value as StatusFilter);
  }

  setWooFilter(value: string): void {
    this.wooFilter.set(value as WooFilter);
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

  // ── Selección múltiple ────────────────────────────────────────────────────
  isSelected(serviceId: number): boolean {
    return this.selectedIds().has(serviceId);
  }

  // ── Diálogo de servicio (crear/editar) ────────────────────────────────────
  openCreate(): void {
    this.dialogMode.set('create');
    this.dialogService.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(service: Service): void {
    this.dialogMode.set('edit');
    this.dialogService.set(service);
    this.dialogVisible.set(true);
  }

  onDialogClosed(): void {
    this.dialogVisible.set(false);
  }

  onDialogSaved(): void {
    this.dialogVisible.set(false);
    // Refresca el catálogo: los servicios llevan las variaciones y los packs
    // son su materialización, así que ambos se invalidan para que las tarjetas
    // reflejen los términos recién guardados.
    this.servicesStore.invalidateServices();
    this.servicesStore.invalidatePacks();
  }

  toggleSelect(serviceId: number): void {
    const next = new Set(this.selectedIds());
    if (next.has(serviceId)) {
      next.delete(serviceId);
    } else {
      next.add(serviceId);
    }
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set<number>());
  }

  // ── Estado de sincronización Woo ──────────────────────────────────────────
  stateFor(row: ServiceRow): WooSyncState {
    return this.wooStates().get(row.service.id) ?? 'new';
  }

  wooStateLabel(row: ServiceRow): string {
    return this.lang.t(`packs.woo.state.${this.stateFor(row)}`);
  }

  wooStateClass(row: ServiceRow): string {
    return `sp-woo-state sp-woo-state--${this.stateFor(row)}`;
  }

  /** Aviso §7: tiene términos exportables pero ninguno de 1 sesión. */
  showNoSingleTerm(row: ServiceRow): boolean {
    const activeTerms = row.terms.filter((t) => t.active);
    return activeTerms.length > 0 && !activeTerms.some((t) => t.total_sessions === 1);
  }

  // ── Exportador ────────────────────────────────────────────────────────────
  toggleExportMenu(): void {
    this.exportMenuOpen.set(!this.exportMenuOpen());
  }

  closeExportMenu(): void {
    this.exportMenuOpen.set(false);
  }

  onExportScope(scope: ExportScope): void {
    this.closeExportMenu();
    // El ítem «Los seleccionados» cambia a la vista de lista antes de exportar.
    if (scope === 'selected') this.setView('list');
    this.exportRows(this.rowsForExport(scope));
  }

  exportSelection(): void {
    this.exportRows(this.rowsForExport('selected'));
  }

  private rowsForExport(scope: ExportScope): ServiceRow[] {
    if (scope === 'all') return this.rows();
    if (scope === 'selected') {
      return this.rows().filter((row) => this.selectedIds().has(row.service.id));
    }
    return this.rows().filter((row) => this.stateFor(row) !== 'synced');
  }

  private exportRows(rows: ServiceRow[]): void {
    if (rows.length === 0) return;

    const { csv } = buildWooCsv(buildWooRows(rows));
    this.downloadCsv(csv);
    this.exportStore.recordExport(rows);
  }

  private downloadCsv(csv: string): void {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.csvFilename();
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  private csvFilename(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `servicios-woo-${yyyy}-${mm}-${dd}.csv`;
  }

  private formatDateTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const locale = this.lang.lang() === 'en' ? 'en-GB' : 'es-CL';
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.exportMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.exportMenuOpen()) return;
    const target = event.target as Node;
    if (this.exportMenu && !this.exportMenu.nativeElement.contains(target)) {
      this.exportMenuOpen.set(false);
    }
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
