import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { PaginatorModule } from 'primeng/paginator';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { RolesApiService } from '@services/api/roles-api.service';
import { HttpErrorService, isCapacityLimitError } from '@services/http-error.service';
import { CalendarNavigationService } from '@services/calendar-navigation.service';
import { LanguageService } from '@services/language.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Location, Provider, Role } from '@models';
import { roleMeta } from '../roles/role-meta';
import { locationColor } from '@shared/utils/location-palette.util';
import { BOOKING_STATUSES } from '../bookings/constants/booking-statuses';
import { ProviderDialogComponent, DialogMode } from './provider-dialog/provider-dialog.component';
import { ABILITIES } from '@shared/config/abilities.config';
import { BwIfAbilityDirective } from '@shared/directives/bw-if-ability.directive';
import { AuthService } from '@services/auth.service';

// ── Color palette for location grouping ────────────────────────────────
// Los colores de sucursal se resuelven en shared/utils/location-palette.util
// (deterministas por id), para que la lista de profesionales y el dashboard
// usen SIEMPRE el mismo color para la misma sucursal.

/** Shape de un booking afectado por la desactivación (contrato 409 obs #217). */
interface ConflictBooking {
  id: number;
  date: string;
  time: string;
  client_name: string;
  status: number | string;
}

/** Body del 409 `requires_confirmation` (contrato #217, shape local por ahora). */
interface ConflictData {
  message: string;
  affects: { bookings: ConflictBooking[] };
}

@Component({
  selector: 'bw-providers-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TableModule, PaginatorModule, ButtonModule, CardModule,
    SkeletonModule, InputTextModule, CheckboxModule, TooltipModule, MultiSelectModule,
    ToggleSwitchModule, DialogModule,
    ProviderDialogComponent, BwIfAbilityDirective,
  ],
  templateUrl: './providers-list.component.html',
  styleUrls: ['./providers-list.component.scss'],
})
export class ProvidersListComponent implements OnInit {
  private rolesApi = inject(RolesApiService);
  private httpError = inject(HttpErrorService);
  private router = inject(Router);
  private calNav = inject(CalendarNavigationService);
  private messageService = inject(MessageService);
  private auth = inject(AuthService);
  protected refStore = inject(ReferenceStore);
  protected readonly lang = inject(LanguageService);

  /** Resuelve color/icono de un rol (fallback gris + pi-user). */
  protected readonly roleMeta = roleMeta;

  /** Catálogo de permission keys (nunca literales, S5 de `fase-b-rbac-cierre`). */
  protected readonly ABILITIES = ABILITIES;

  /**
   * Editar se abre con `providers.manage` (datos) **o** `providers.roles`
   * (reasignar roles): `admin_location` tiene solo la segunda. Cada bloque del
   * diálogo se habilita por separado.
   */
  protected readonly canEditProvider = computed(() =>
    this.auth.hasAnyPermission(ABILITIES.providersManage, ABILITIES.providersRoles),
  );

  // ── Data ────────────────────────────────────────────────────────────────
  // Los providers se leen de ReferenceStore (fuente canónica; U3 cierra el
  // gap de PR2). El store carga en su onInit root y patcha tras cada mutación.
  readonly providers = computed(() => this.refStore.providers());
  roles = signal<Role[]>([]);
  /** Skeleton mientras el store no termina de cargar providers. */
  readonly loading = computed(() => this.refStore.loading().providers);

  // ── Filters ─────────────────────────────────────────────────────────────
  searchQuery = signal('');
  selectedLocationIds = signal<Set<number>>(new Set());
  selectedRoleSlugs = signal<string[]>([]);

  // ── Paginación ──────────────────────────────────────────────────────────
  // La paginación es de cliente: `ReferenceStore` publica la lista completa
  // (los services agregan todas las páginas del backend) y acá se muestra de a
  // `pageSize` para que la pantalla no trunque ni cargue cientos de filas.
  readonly pageSize = 10;
  /** Página visible, 1-based. */
  readonly page = signal(1);

  readonly totalRecords = computed(() => this.sortedProviders().length);

  readonly pagedProviders = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.sortedProviders().slice(start, start + this.pageSize);
  });

  /** `p-paginator` entrega la página 0-based. */
  onPageChange(event: { page?: number }): void {
    this.page.set((event.page ?? 0) + 1);
  }

  /** Cualquier cambio de filtro invalida la página actual. */
  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.page.set(1);
  }

  /** Roles del catálogo mapeados a opciones `{ label, value }` para el p-multiselect. */
  readonly roleOptions = computed(() =>
    this.roles().map((r) => ({ label: this.roleLabel(r), value: r.slug })),
  );

  /** Unique active locations from ReferenceStore + any from loaded providers */
  readonly filterLocations = computed<Location[]>(() => {
    const seen = new Set<number>();
    const result: Location[] = [];

    for (const loc of this.refStore
      .locations()
      .filter((l) => l.active)
      .sort((a, b) => a.name.localeCompare(b.name))) {
      seen.add(loc.id);
      result.push(loc);
    }

    // Include locations from provider data not yet in store
    for (const p of this.providers()) {
      if (p.location && !seen.has(p.location.id)) {
        seen.add(p.location.id);
        result.push(p.location);
      }
    }

    return result;
  });

  /** Whether any provider has no location assigned */
  readonly hasUnassigned = computed(() =>
    this.providers().some((p) => !p.location),
  );

  /** Location ID → color. Determinista por id (compartido con el dashboard). */
  readonly locationColorMap = computed(() => {
    const map = new Map<number | undefined, string>();
    const locs = this.filterLocations();
    locs.forEach((loc) => {
      map.set(loc.id, locationColor(loc.id));
    });
    return map;
  });

  // ── Filtered + sorted ───────────────────────────────────────────────────

  /** Applies search, location and role filters */
  readonly filteredProviders = computed(() => {
    let result = this.providers();
    const query = this.searchQuery().toLowerCase().trim();
    const locIds = this.selectedLocationIds();
    const roleSlugs = this.selectedRoleSlugs() ?? [];

    // Location filter
    if (locIds.size > 0) {
      result = result.filter((p) => {
        // -1 sentinel = unassigned
        if (locIds.has(-1) && !p.location) return true;
        return p.location != null && locIds.has(p.location.id);
      });
    }

    // Text search
    if (query) {
      result = result.filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(query) ||
          p.email.toLowerCase().includes(query) ||
          (p.phone ?? '').includes(query),
      );
    }

    // Role filter: keep providers that have at least one selected role.
    if (roleSlugs.length > 0) {
      result = result.filter((p) => p.roles?.some((r) => roleSlugs.includes(r.slug)));
    }
    return result;
  });

  /** Sorted by location name, then by last_name + first_name */
  readonly sortedProviders = computed(() =>
    this.filteredProviders()
      .slice()
      .sort((a, b) => {
        const locA = a.location?.name ?? '';
        const locB = b.location?.name ?? '';
        const cmp = locA.localeCompare(locB);
        if (cmp !== 0) return cmp;
        return `${a.last_name} ${a.first_name}`.localeCompare(
          `${b.last_name} ${b.first_name}`,
        );
      }),
  );

  // ── Toggle state (UI local, A1–A4) ───────────────────────────────────
  toggling = signal<Set<number>>(new Set());
  conflictDialogVisible = signal(false);
  conflictData = signal<ConflictData | null>(null);
  pendingToggleProvider = signal<Provider | null>(null);

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.rolesApi.getRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: (err) => this.httpError.handle(err, this.lang.t('roles.title')),
    });
  }

  /** Resolves the display label: i18n key by slug, falling back to the backend `name`. */
  roleLabel(role: Pick<Role, 'slug' | 'name'>): string {
    const key = `roles.role.${role.slug}`;
    return this.lang.has(key) ? this.lang.t(key) : role.name;
  }

  /** Tipado seguro: `provider.roles` puede ser undefined. */
  providerRoles(provider: Provider): Role[] {
    return provider.roles ?? [];
  }

  /** Etiqueta de estado de un booking del conflicto vía BOOKING_STATUSES labelKey. */
  bookingStatusLabel(status: number | string): string {
    const value = Number(status);
    const match = BOOKING_STATUSES.find((s) => s.value === value || s.label === status);
    return match ? this.lang.t(match.labelKey) : String(status);
  }

  // ── Toggle active (store-routed, A1–A4) ─────────────────────────────

  toggleActive(provider: Provider): void {
    const id = provider.id;
    const newActive = !provider.active;
    if (this.toggling().has(id)) return;

    this.toggling.update((set) => new Set(set).add(id));
    this.refStore.toggleProviderActive(id, newActive).subscribe({
      next: (res) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(id); return s; });
        // El CTA de cuota pertenece al intento anterior: una acción que sale
        // bien prueba que el cupo ya no está agotado.
        this.capacityError.set(false);
        this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
      },
      error: (err) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(id); return s; });
        if (isCapacityLimitError(err)) {
          this.capacityError.set(true);
          return;
        }
        // A2: gate 409 SOLO en desactivación; reactivación nunca gatea.
        if (!newActive && err.status === 409 && err.error?.requires_confirmation) {
          this.showConflictDialog(provider, err.error);
        } else {
          // A4 interino: 409 no live aún → error genérico (rollback ya lo hizo el store)
          this.httpError.handle(err, 'cambiar estado');
        }
      },
    });
  }

  /** Abre el diálogo bloqueante con el body del 409 (sin force; única salida: Cerrar). */
  showConflictDialog(provider: Provider, data: ConflictData): void {
    this.pendingToggleProvider.set(provider);
    this.conflictData.set(data);
    this.conflictDialogVisible.set(true);
  }

  /** Cierra el diálogo sin emitir ningún request; el provider quedó activo por el rollback. */
  closeConflictDialog(): void {
    this.conflictDialogVisible.set(false);
    this.pendingToggleProvider.set(null);
  }

  goToBilling(): void {
    this.router.navigate(['/admin/facturacion']);
  }

  // ── Dialog ────────────────────────────────────────────────────────────────
  readonly capacityError = signal(false);
  dialogVisible = signal(false);
  dialogMode = signal<DialogMode>('create');
  selectedProvider = signal<Provider | null>(null);

  /** Alta de profesional. Requiere `providers.manage` (gateado en el template). */
  openCreate(): void {
    this.dialogMode.set('create');
    this.selectedProvider.set(null);
    this.dialogVisible.set(true);
    // Abrir el alta es un intento nuevo: no arrastrar el CTA del rechazo previo.
    this.capacityError.set(false);
  }

  openEdit(provider: Provider): void {
    this.dialogMode.set('edit');
    this.selectedProvider.set(provider);
    this.dialogVisible.set(true);
  }

  openView(provider: Provider): void {
    this.dialogMode.set('view');
    this.selectedProvider.set(provider);
    this.dialogVisible.set(true);
  }

  onDialogClosed(): void {
    this.dialogVisible.set(false);
  }

  /**
   * Save is store-routed: ReferenceStore already patched providers with the
   * server response, so the dialog only closes — no list reload needed.
   */
  onDialogSaved(): void {
    this.dialogVisible.set(false);
  }

  onEditRequested(): void {
    const prov = this.selectedProvider();
    if (prov) this.openEdit(prov);
  }

  // ── Calendar navigation ──────────────────────────────────────────────────

  goToAgenda(provider: Provider): void {
    if (!provider.location) return;
    this.calNav.navigateToCalendar(provider.location.id, provider.id, [], this.router);
  }

  // ── Filter handlers ──────────────────────────────────────────────────────

  toggleLocation(id: number): void {
    this.selectedLocationIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    this.page.set(1);
  }

  /**
   * Handler del multiselect de roles. PrimeNG emite `null` al usar su botón de
   * limpiar (clear), lo que rompería el computed `filteredProviders` que lee
   * `roleSlugs.length` — coercer a array para que el filtro quede vacío.
   */
  onRoleFilterChange(value: string[] | null): void {
    this.selectedRoleSlugs.set(Array.isArray(value) ? value : []);
    this.page.set(1);
  }
}
