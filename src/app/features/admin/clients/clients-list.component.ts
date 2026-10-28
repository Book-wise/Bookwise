import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
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
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { Subject, debounceTime } from 'rxjs';
import { ClientListFilters } from '@services/api/clients-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { PatientTab } from '@core/stores/client-detail.store';
import { ClientsStore } from '@core/stores/clients.store';
import { ReferenceStore } from '@core/stores/reference.store';
import { BOOKING_STATUSES } from '../bookings/constants/booking-statuses';
import { ClientDetailDialogComponent } from './client-detail-dialog/client-detail-dialog.component';
import { ClientFormDialogComponent } from './client-form-dialog/client-form-dialog.component';
import { ABILITIES } from '@shared/config/abilities.config';
import { BwIfAbilityDirective } from '@shared/directives/bw-if-ability.directive';
import { Client } from '@models';

type SortField = 'name' | 'rut' | 'email' | 'phone';

/** Item de `affects.bookings[]` del 409 `deactivation_conflict` (contrato exacto). */
interface DeactivationBooking {
  id: number;
  /** Fecha `Y-m-d`. */
  date: string;
  /** Hora `H:i`. */
  time: string;
  provider_name: string;
  location_name: string;
  status: string;
}

/** Item de `affects.packs[]` del 409 (contrato exacto). */
interface DeactivationPack {
  id: number;
  /** Nombre del pack (string, NO objeto). */
  service_pack: string;
  total_sessions?: number;
  used_sessions?: number;
  /** Calculado por el backend: no recalcular. */
  remaining_sessions: number;
}

interface DeactivationAffects {
  bookings: DeactivationBooking[];
  packs: DeactivationPack[];
}

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
    InputTextModule, IconFieldModule, InputIconModule, SkeletonModule, TooltipModule, SelectModule, DialogModule,
    ClientDetailDialogComponent, ClientFormDialogComponent, BwIfAbilityDirective,
  ],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  private readonly clientsStore = inject(ClientsStore);
  private readonly httpError = inject(HttpErrorService);
  private readonly refStore = inject(ReferenceStore);
  private readonly messageService = inject(MessageService);
  protected readonly lang = inject(LanguageService);
  private readonly searchSubject = new Subject<void>();

  /** Catálogo de permission keys (nunca literales). */
  protected readonly ABILITIES = ABILITIES;

  readonly clients = computed(() => this.clientsStore.clients());
  readonly loading = computed(() => this.clientsStore.loading());
  readonly searchTerm = signal('');

  // ── Orden (server-side, allowlist del backend) ──────────────────────────
  readonly sortField = signal<SortField>('name');
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  /** Mapeo del campo de UI a la allowlist del backend (default `last_name asc`). */
  private readonly sortMap: Record<SortField, string> = {
    name: 'last_name',
    rut: 'rut',
    email: 'email',
    phone: 'phone',
  };

  // ── Paginación (server-side: una página por request) ──────────────────────────
  readonly pageSize = 10;
  /** Página visible, 1-based. */
  readonly page = signal(1);

  readonly totalRecords = computed(() => this.clientsStore.total());
  /** Rango "Mostrando X-Y de N" (lo informa `meta.from`/`meta.to`). */
  readonly rangeFrom = computed(() => this.clientsStore.from());
  readonly rangeTo = computed(() => this.clientsStore.to());

  constructor() {
    // Si el total baja y la página actual queda fuera de rango, se la clampa.
    effect(() => {
      const lastPage = Math.max(1, this.clientsStore.lastPage());
      if (this.page() > lastPage) {
        this.page.set(lastPage);
        untracked(() => this.loadClients());
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

  // ── Desactivación (soft, 409 + force) ───────────────────────────────────
  readonly deactivateDialogVisible = signal(false);
  readonly deactivatingId = signal<number | null>(null);
  readonly pendingDeactivateClient = signal<Client | null>(null);
  readonly deactivateAffects = signal<DeactivationAffects | null>(null);

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

  /** Carga una página del listado (server-side) con búsqueda + orden + filtros. */
  loadClients(): void {
    this.clientsStore
      .load({
        page: this.page(),
        perPage: this.pageSize,
        sort: this.sortMap[this.sortField()],
        direction: this.sortDir(),
        filters: { search: this.searchTerm() || undefined, ...this.appliedFilters() },
      })
      .subscribe({
        error: (err) => this.httpError.handle(err, 'cargar clientes'),
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
    // Volver al orden default del backend.
    this.sortField.set('name');
    this.sortDir.set('asc');
    this.page.set(1);
    this.loadClients();
  }

  /** `p-paginator` entrega la página 0-based. */
  onPageChange(event: { page?: number }): void {
    this.page.set((event.page ?? 0) + 1);
    this.loadClients();
  }

  /** Toggle de orden al clickear un encabezado (recarga server-side). */
  toggleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    this.page.set(1);
    this.loadClients();
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

  /** Tras crear o editar: cierra el form (el ClientsStore ya parcheó la lista). */
  onFormSaved(): void {
    this.formVisible.set(false);
  }

  // ── Desactivación ───────────────────────────────────────────────────────

  /** Desactivar (soft). Intenta sin `force`; si hay conflicto (409) abre el diálogo. */
  deactivateClient(client: Client): void {
    if (this.deactivatingId() === client.id) return;
    this.deactivatingId.set(client.id);
    this.clientsStore.deactivate(client.id).subscribe({
      next: (res) => {
        this.deactivatingId.set(null);
        this.onClientDeactivated(res);
      },
      error: (err) => {
        this.deactivatingId.set(null);
        if (err?.status === 409 && err.error?.requires_confirmation) {
          const affects = err.error.affects ?? {};
          this.pendingDeactivateClient.set(client);
          this.deactivateAffects.set({
            bookings: Array.isArray(affects.bookings) ? affects.bookings : [],
            packs: Array.isArray(affects.packs) ? affects.packs : [],
          });
          this.deactivateDialogVisible.set(true);
          return;
        }
        if (err?.status === 422 && err.error?.error === 'already_inactive') {
          this.messageService.add({
            severity: 'info',
            summary: this.lang.t('clients.deactivate.already_inactive'),
            key: 'global',
          });
          return;
        }
        this.httpError.handle(err, 'desactivar cliente');
      },
    });
  }

  /** Reintento con `force:true` desde el diálogo de confirmación. */
  confirmDeactivate(): void {
    const client = this.pendingDeactivateClient();
    if (!client) return;
    this.deactivatingId.set(client.id);
    this.deactivateDialogVisible.set(false);
    this.clientsStore.deactivate(client.id, true).subscribe({
      next: (res) => {
        this.deactivatingId.set(null);
        this.clearDeactivateDialog();
        this.onClientDeactivated(res);
      },
      error: (err) => {
        this.deactivatingId.set(null);
        this.clearDeactivateDialog();
        this.httpError.handle(err, 'desactivar cliente');
      },
    });
  }

  cancelDeactivate(): void {
    this.clearDeactivateDialog();
  }

  /** Etiqueta de una reserva afectada (`date`/`time`/nombres ya vienen resueltos). */
  bookingLabel(b: DeactivationBooking): string {
    const when = [b.date, b.time].filter(Boolean).join(' ');
    const who = [b.provider_name, b.location_name].filter(Boolean).join(' — ');
    return [when, who, b.status].filter(Boolean).join(' · ');
  }

  /** Etiqueta de un pack afectado: nombre + "N de M restantes" (`service_pack` es el nombre). */
  packLabel(p: DeactivationPack): string {
    const sessions =
      p.total_sessions != null
        ? this.lang.t('clients.deactivate.pack_sessions', {
            remaining: String(p.remaining_sessions),
            total: String(p.total_sessions),
          })
        : this.lang.t('clients.deactivate.remaining_sessions', {
            n: String(p.remaining_sessions),
          });
    return [p.service_pack, sessions].filter(Boolean).join(' · ');
  }

  private clearDeactivateDialog(): void {
    this.deactivateDialogVisible.set(false);
    this.pendingDeactivateClient.set(null);
    this.deactivateAffects.set(null);
  }

  private onClientDeactivated(client: Client): void {
    void client;
    // El ClientsStore ya parcheó la lista: no se re-consulta el backend.
    this.messageService.add({
      severity: 'success',
      summary: this.lang.t('clients.deactivate.success'),
      key: 'global',
    });
  }

}
