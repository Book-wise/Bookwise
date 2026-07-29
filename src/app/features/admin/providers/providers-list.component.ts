import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Location, Provider } from '@models';
import { ProviderDialogComponent, DialogMode } from './provider-dialog/provider-dialog.component';

// ── Color palette for location grouping ────────────────────────────────
const LOCATION_PALETTE = [
  '#3b82f6', // blue
  '#f97316', // orange
  '#22c55e', // green
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#84cc16', // lime
  '#ef4444', // red
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f43f5e', // rose
];

@Component({
  selector: 'bw-providers-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TableModule, ButtonModule, CardModule, TagModule,
    SkeletonModule, InputTextModule, CheckboxModule, TooltipModule, ProviderDialogComponent,
  ],
  templateUrl: './providers-list.component.html',
  styleUrls: ['./providers-list.component.scss'],
})
export class ProvidersListComponent implements OnInit {
  private providersApi = inject(ProvidersApiService);
  private httpError = inject(HttpErrorService);
  protected refStore = inject(ReferenceStore);

  // ── Data ────────────────────────────────────────────────────────────────
  providers = signal<Provider[]>([]);
  loading = signal(true);

  // ── Filters ─────────────────────────────────────────────────────────────
  searchQuery = signal('');
  selectedLocationIds = signal<Set<number>>(new Set());

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

  /** Location ID → color, sorted by name for stable assignment */
  readonly locationColorMap = computed(() => {
    const map = new Map<number | undefined, string>();
    const locs = this.filterLocations();
    locs.forEach((loc, i) => {
      map.set(loc.id, LOCATION_PALETTE[i % LOCATION_PALETTE.length]);
    });
    return map;
  });

  // ── Filtered + sorted ───────────────────────────────────────────────────

  /** Applies search and location filters */
  readonly filteredProviders = computed(() => {
    let result = this.providers();
    const query = this.searchQuery().toLowerCase().trim();
    const locIds = this.selectedLocationIds();

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

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadProviders();
  }

  loadProviders(): void {
    this.loading.set(true);
    this.providersApi.getProviders().subscribe({
      next: (data) => {
        this.providers.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.providers.set([]);
        this.loading.set(false);
        this.httpError.handle(err, 'cargar profesionales');
      },
    });
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

  onDialogSaved(): void {
    this.dialogVisible.set(false);
    this.loadProviders();
  }

  onEditRequested(): void {
    const prov = this.selectedProvider();
    if (prov) this.openEdit(prov);
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
}
