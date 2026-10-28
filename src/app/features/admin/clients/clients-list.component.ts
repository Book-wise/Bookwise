import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { PaginatorModule } from 'primeng/paginator';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { Subject, debounceTime } from 'rxjs';
import { ClientsApiService, ClientListFilters } from '@services/api/clients-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { PatientTab } from '@core/stores/client-detail.store';
import { ReferenceStore } from '@core/stores/reference.store';
import { BOOKING_STATUSES } from '../bookings/constants/booking-statuses';
import { ClientDetailDialogComponent } from './client-detail-dialog/client-detail-dialog.component';
import { ClientFormDialogComponent } from './client-form-dialog/client-form-dialog.component';
import { ABILITIES } from '@shared/config/abilities.config';
import { BwIfAbilityDirective } from '@shared/directives/bw-if-ability.directive';
import { Client } from '@models';

type SortField = 'name' | 'rut' | 'email' | 'phone';

/**
 * "Base de Pacientes": listado de clientes con buscador global, contador
 * "Mostrando X-Y de N", columnas ordenables y paginación de cliente sobre la
 * lista agregada (`listClients`). El orden y la paginación son client-side, así
 * que funcionan con el array plano actual y con el envelope futuro del backend.
 */
@Component({
  selector: 'bw-clients-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TableModule, PaginatorModule, ButtonModule, CardModule,
    InputTextModule, IconFieldModule, InputIconModule, SkeletonModule, TooltipModule, SelectModule,
    ClientDetailDialogComponent, ClientFormDialogComponent, BwIfAbilityDirective,
  ],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  private readonly clientsApi = inject(ClientsApiService);
  private readonly httpError = inject(HttpErrorService);
  private readonly refStore = inject(ReferenceStore);
  protected readonly lang = inject(LanguageService);
  private readonly searchSubject = new Subject<void>();

  /** Catálogo de permission keys (nunca literales). */
  protected readonly ABILITIES = ABILITIES;

  readonly clients = signal<Client[]>([]);
  readonly loading = signal(false);
  readonly searchTerm = signal('');

  // ── Orden (client-side sobre la lista agregada) ──────────────────────────
  readonly sortField = signal<SortField>('name');
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  // ── Paginación (S6: la lista no se trunca a 15) ──────────────────────────
  readonly pageSize = 10;
  /** Página visible, 1-based. */
  readonly page = signal(1);

  readonly totalRecords = computed(() => this.sortedClients().length);

  /** Última página válida para el total actual (mínimo 1). */
  private readonly maxPage = computed(() =>
    Math.max(1, Math.ceil(this.totalRecords() / this.pageSize)),
  );

  readonly pagedClients = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.sortedClients().slice(start, start + this.pageSize);
  });

  /** Rango "Mostrando X-Y de N". */
  readonly rangeFrom = computed(() =>
    this.totalRecords() === 0 ? 0 : (this.page() - 1) * this.pageSize + 1,
  );
  readonly rangeTo = computed(() => Math.min(this.page() * this.pageSize, this.totalRecords()));

  readonly sortedClients = computed(() => {
    const field = this.sortField();
    const dir = this.sortDir();
    const rows = this.clients().slice();
    rows.sort((a, b) => {
      const cmp = this.sortValue(a, field).localeCompare(this.sortValue(b, field), 'es', {
        sensitivity: 'base',
      });
      return dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  });

  constructor() {
    // Si el total baja (búsqueda más restrictiva), la página actual puede quedar
    // fuera de rango y mostrar una lista vacía: se la clampa.
    effect(() => {
      const max = this.maxPage();
      if (this.page() > max) {
        this.page.set(max);
      }
    });
  }

  // ── Detalle ─────────────────────────────────────────────────────────────
  readonly detailVisible = signal(false);
  readonly selectedClient = signal<Client | null>(null);
  readonly detailInitialTab = signal<PatientTab | null>(null);

  // ── Alta / edición ──────────────────────────────────────────────────────
  readonly formVisible = signal(false);
  readonly formClient = signal<Client | null>(null);

  // ── Filtros avanzados (T3) ──────────────────────────────────────────────
  readonly filtersOpen = signal(false);
  readonly fLocationId = signal<number | null>(null);
  readonly fProviderId = signal<number | null>(null);
  readonly fServiceId = signal<number | null>(null);
  readonly fBookingStatusId = signal<number | null>(null);
  readonly fHasBooked = signal<'ever' | 'upcoming' | null>(null);
  readonly fGender = signal('');
  readonly fCreatedFrom = signal('');
  readonly fCreatedTo = signal('');
  /** Filtros aplicados (los que se envían al servicio, no los del borrador). */
  readonly appliedFilters = signal<ClientListFilters>({});

  readonly activeFilterCount = computed(() => Object.keys(this.appliedFilters()).length);

  readonly locationOptions = computed(() =>
    this.refStore
      .locations()
      .filter((l) => l.active)
      .map((l) => ({ label: l.name, value: l.id })),
  );
  readonly providerOptions = computed(() =>
    this.refStore
      .providers()
      .filter((p) => p.active)
      .map((p) => ({ label: `${p.first_name} ${p.last_name}`, value: p.id })),
  );
  readonly serviceOptions = computed(() =>
    this.refStore
      .services()
      .filter((s) => s.active)
      .map((s) => ({ label: s.name, value: s.id })),
  );
  readonly statusOptions = computed(() =>
    BOOKING_STATUSES.map((s) => ({ label: this.lang.t(s.labelKey), value: Number(s.value) })),
  );
  readonly hasBookedOptions = computed(() => [
    { label: this.lang.t('clients.filter.has_booked.ever'), value: 'ever' },
    { label: this.lang.t('clients.filter.has_booked.upcoming'), value: 'upcoming' },
  ]);

  ngOnInit(): void {
    this.searchSubject.pipe(debounceTime(300)).subscribe(() => this.loadClients());
    this.loadClients();
  }

  /** Carga la lista completa agregada (todas las páginas) con búsqueda + filtros. */
  loadClients(): void {
    this.loading.set(true);
    this.clientsApi
      .listClients({ search: this.searchTerm() || undefined, ...this.appliedFilters() })
      .subscribe({
        next: (clients) => {
          this.clients.set(clients);
          this.loading.set(false);
        },
        error: (err) => {
          this.clients.set([]);
          this.loading.set(false);
          this.httpError.handle(err, 'cargar clientes');
        },
      });
  }

  onSearch(): void {
    this.page.set(1);
    this.searchSubject.next();
  }

  // ── Filtros avanzados ───────────────────────────────────────────────────
  toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }

  /** Aplica el borrador de filtros y recarga desde la página 1. */
  applyFilters(): void {
    const filters: ClientListFilters = {};
    const locationId = this.fLocationId();
    const providerId = this.fProviderId();
    const serviceId = this.fServiceId();
    const statusId = this.fBookingStatusId();
    const hasBooked = this.fHasBooked();

    if (locationId != null) filters.location_id = locationId;
    if (providerId != null) filters.provider_id = providerId;
    if (serviceId != null) filters.service_id = serviceId;
    if (statusId != null) filters.booking_status_id = statusId;
    if (hasBooked) filters.has_booked = hasBooked;
    if (this.fGender().trim()) filters.gender = this.fGender().trim();
    if (this.fCreatedFrom()) filters.created_from = this.fCreatedFrom();
    if (this.fCreatedTo()) filters.created_to = this.fCreatedTo();

    this.appliedFilters.set(filters);
    this.page.set(1);
    this.loadClients();
  }

  /** Limpia el borrador y los filtros aplicados, y recarga. */
  resetFilters(): void {
    this.fLocationId.set(null);
    this.fProviderId.set(null);
    this.fServiceId.set(null);
    this.fBookingStatusId.set(null);
    this.fHasBooked.set(null);
    this.fGender.set('');
    this.fCreatedFrom.set('');
    this.fCreatedTo.set('');
    this.appliedFilters.set({});
    this.page.set(1);
    this.loadClients();
  }

  /** `p-paginator` entrega la página 0-based. */
  onPageChange(event: { page?: number }): void {
    this.page.set((event.page ?? 0) + 1);
  }

  /** Toggle de orden al clickear un encabezado. */
  toggleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    this.page.set(1);
  }

  isSorted(field: SortField): boolean {
    return this.sortField() === field;
  }

  isSortedAsc(field: SortField): boolean {
    return this.sortField() === field && this.sortDir() === 'asc';
  }

  /** "Ver": abre el detalle del cliente. */
  openView(client: Client): void {
    this.selectedClient.set(client);
    this.detailInitialTab.set(null);
    this.detailVisible.set(true);
  }

  /** "Ver Packs": abre el detalle en la tab de planes. */
  openPacks(client: Client): void {
    this.selectedClient.set(client);
    this.detailInitialTab.set('planes');
    this.detailVisible.set(true);
  }

  /** "Nuevo cliente": abre el form en modo alta. */
  openCreateClient(): void {
    this.formClient.set(null);
    this.formVisible.set(true);
  }

  /** Edición desde el detalle: cierra el detalle y abre el form precargado. */
  onEditClient(client: Client): void {
    this.detailVisible.set(false);
    this.formClient.set(client);
    this.formVisible.set(true);
  }

  /** Tras crear o editar: refresca la lista agregada. */
  onFormSaved(): void {
    this.formVisible.set(false);
    this.loadClients();
  }

  private sortValue(c: Client, field: SortField): string {
    switch (field) {
      case 'rut':
        return c.rut ?? '';
      case 'email':
        return c.email ?? '';
      case 'phone':
        return c.phone ?? '';
      default:
        return `${c.first_name} ${c.last_name}`;
    }
  }
}
