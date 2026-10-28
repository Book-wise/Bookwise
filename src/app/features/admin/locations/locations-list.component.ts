import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { PaginatorModule } from 'primeng/paginator';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { AuthService } from '@services/auth.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { SubscriptionStore } from '@core/stores/subscription.store';
import { ABILITIES } from '@shared/config/abilities.config';
import { BwIfAbilityDirective } from '@shared/directives/bw-if-ability.directive';
import { CapacityLimitDialogComponent } from '@shared/components/capacity-limit-dialog/capacity-limit-dialog.component';
import { Location, Quota } from '@models';
import { LocationDialogComponent, DialogMode } from './location-dialog/location-dialog.component';

interface ConflictBooking {
  id: number;
  date: string;
  time: string;
  provider_name: string;
}

interface ConflictData {
  message: string;
  affects: { bookings: ConflictBooking[] };
}

@Component({
  selector: 'bw-locations-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TableModule, PaginatorModule, ButtonModule, CardModule,
    SkeletonModule, ToggleSwitchModule, DialogModule, LocationDialogComponent,
    BwIfAbilityDirective, CapacityLimitDialogComponent,
  ],
  templateUrl: './locations-list.component.html',
  styleUrls: ['./locations-list.component.scss'],
})
export class LocationsListComponent implements OnInit {
  /** Permission keys del catálogo (S5): el template nunca usa literales. */
  protected readonly ABILITIES = ABILITIES;

  private httpError = inject(HttpErrorService);
  protected refStore = inject(ReferenceStore);
  private messageService = inject(MessageService);
  protected readonly lang = inject(LanguageService);
  private subscriptionStore = inject(SubscriptionStore);
  private auth = inject(AuthService);

  /**
   * Sucursales leídas de ReferenceStore (fuente canónica, U6): el store carga en
   * su onInit y patcha con la respuesta del server tras cada mutación, por lo
   * que esta pantalla no mantiene lista local ni invalida post-mutación.
   */
  readonly locations = computed(() => this.refStore.locations());
  /** Skeleton mientras el store no termina de cargar locations. */
  readonly loading = computed(() => this.refStore.loading().locations);
  toggling = signal<Set<number>>(new Set());

  // ── Paginación ──────────────────────────────────────────────────────────
  // De cliente: `ReferenceStore` publica la lista completa (los services
  // agregan todas las páginas del backend) y acá se muestra de a `pageSize`.
  readonly pageSize = 10;
  /** Página visible, 1-based. */
  readonly page = signal(1);

  readonly totalRecords = computed(() => this.locations().length);

  /** Última página válida para el total actual (mínimo 1). */
  private readonly maxPage = computed(() =>
    Math.max(1, Math.ceil(this.totalRecords() / this.pageSize)),
  );

  readonly pagedLocations = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.locations().slice(start, start + this.pageSize);
  });

  constructor() {
    // Si el total baja (p. ej. una recarga trae menos filas), la página actual
    // puede quedar fuera de rango y mostrar una página vacía: se la clampa.
    effect(() => {
      const max = this.maxPage();
      if (this.page() > max) {
        this.page.set(max);
      }
    });
  }

  ngOnInit(): void {
    this.subscriptionStore.loadUsage();
  }

  /** `p-paginator` entrega la página 0-based. */
  onPageChange(event: { page?: number }): void {
    this.page.set((event.page ?? 0) + 1);
  }

  /** `HH:MM:SS` (o null) → `HH:MM` para mostrar; `—` si no está configurado. */
  timeLabel(value?: string | null): string {
    return value ? value.slice(0, 5) : '—';
  }

  dialogVisible = signal(false);
  dialogMode = signal<DialogMode>('create');
  selectedLocation = signal<Location | null>(null);
  /** Bloqueo proactivo de creación (#12): diálogo de cuota llena. */
  readonly capacityDialogVisible = signal(false);
  /** Cuota de sucursales del negocio activo; null si no hay uso ni tenant. */
  readonly activeBusinessLocationsQuota = computed<Quota | null>(() => {
    const usage = this.subscriptionStore.usage();
    const tenantId = this.auth.me()?.tenant_id;
    if (!usage || tenantId == null) return null;
    return usage.businesses.find((b) => b.tenant_id === tenantId)?.locations ?? null;
  });

  conflictDialogVisible = signal(false);
  conflictData = signal<ConflictData | null>(null);
  pendingToggleLocation = signal<Location | null>(null);

  openCreate(): void {
    const quota = this.activeBusinessLocationsQuota();
    if (quota && quota.current >= quota.limit) {
      this.capacityDialogVisible.set(true);
      return;
    }
    this.dialogMode.set('create');
    this.selectedLocation.set(null);
    this.dialogVisible.set(true);
  }
  openView(location: Location): void { this.dialogMode.set('view'); this.selectedLocation.set(location); this.dialogVisible.set(true); }
  openEdit(location: Location): void { this.dialogMode.set('edit'); this.selectedLocation.set(location); this.dialogVisible.set(true); }
  onDialogClosed(): void { this.dialogVisible.set(false); }
  /** Save es store-routed: ReferenceStore ya patchó locations; solo cierra el dialog. */
  onDialogSaved(): void { this.dialogVisible.set(false); }

  onEditRequested(): void {
    const loc = this.selectedLocation();
    if (loc) this.openEdit(loc);
  }

  /**
   * Toggle store-routed: el flip optimista, el merge canónico y el rollback
   * viven en refStore.toggleLocationActive; acá solo se orquesta UI (toggling,
   * toast, diálogo force 409) sobre el observable que el método devuelve.
   */
  toggleActive(location: Location): void {
    const id = location.id;
    const newActive = !location.active;
    this.toggling.update((set) => new Set(set).add(id));

    this.refStore.toggleLocationActive(id, newActive).subscribe({
      next: (res) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(id); return s; });
        this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
      },
      error: (err) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(id); return s; });
        // Gate 409 SOLO en desactivación; el rollback ya lo hizo el store.
        if (!newActive && err.status === 409 && err.error?.requires_confirmation) {
          this.showConflictDialog(location, err.error);
        } else {
          this.httpError.handle(err, 'cambiar estado');
        }
      },
    });
  }

  showConflictDialog(location: Location, data: any): void {
    this.pendingToggleLocation.set(location);
    this.conflictData.set(data);
    this.conflictDialogVisible.set(true);
  }

  confirmDeactivate(): void {
    const location = this.pendingToggleLocation();
    if (!location) return;
    this.conflictDialogVisible.set(false);
    this.toggling.update((set) => new Set(set).add(location.id));

    // Force vía store: updateLocation(id, {active:false, force:true}) mergea la
    // respuesta del server en refStore.locations (la sucursal queda inactiva).
    this.refStore.updateLocation(location.id, { active: false, force: true }).subscribe({
      next: (res) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(location.id); return s; });
        this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
        this.pendingToggleLocation.set(null);
      },
      error: (err) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(location.id); return s; });
        this.httpError.handle(err, 'desactivar sucursal');
        this.pendingToggleLocation.set(null);
      },
    });
  }

  cancelDeactivate(): void {
    this.conflictDialogVisible.set(false);
    this.pendingToggleLocation.set(null);
  }
}
