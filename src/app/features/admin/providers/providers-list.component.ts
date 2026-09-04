import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
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
import { HttpErrorService } from '@services/http-error.service';
import { CalendarNavigationService } from '@services/calendar-navigation.service';
import { LanguageService } from '@services/language.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Location, Provider, Role } from '@models';
import { roleMeta } from '../roles/role-meta';
import { locationColor } from '@shared/utils/location-palette.util';
import { BOOKING_STATUSES } from '../bookings/constants/booking-statuses';
import { ProviderDialogComponent, DialogMode } from './provider-dialog/provider-dialog.component';

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
    CommonModule, FormsModule, TableModule, ButtonModule, CardModule,
    SkeletonModule, InputTextModule, CheckboxModule, TooltipModule, MultiSelectModule,
    ToggleSwitchModule, DialogModule,
    ProviderDialogComponent,
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
  protected refStore = inject(ReferenceStore);
  protected readonly lang = inject(LanguageService);

  /** Resuelve color/icono de un rol (fallback gris + pi-user). */
  protected readonly roleMeta = roleMeta;

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
  selectedRoleNames = signal<string[]>([]);

  /** Roles del catálogo mapeados a opciones `{ label, value }` para el p-multiselect. */
  readonly roleOptions = computed(() =>
    this.roles().map((r) => ({ label: this.roleLabel(r.name), value: r.name })),
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
    const roleNames = this.selectedRoleNames() ?? [];

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
    if (roleNames.length > 0) {
      result = result.filter((p) => p.roles?.some((r) => roleNames.includes(r.name)));
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

  roleLabel(name: string): string {
    const key = `roles.role.${name}`;
    return this.lang.has(key) ? this.lang.t(key) : name;
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
        this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
      },
      error: (err) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(id); return s; });
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

  // ── Dialog ────────────────────────────────────────────────────────────────
  dialogVisible = signal(false);
  dialogMode = signal<DialogMode>('create');
  selectedProvider = signal<Provider | null>(null);

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
  }

  /**
   * Handler del multiselect de roles. PrimeNG emite `null` al usar su botón de
   * limpiar (clear), lo que rompería el computed `filteredProviders` que lee
   * `roleNames.length` — coercer a array para que el filtro quede vacío.
   */
  onRoleFilterChange(value: string[] | null): void {
    this.selectedRoleNames.set(Array.isArray(value) ? value : []);
  }
}
