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
import { Subject, debounceTime } from 'rxjs';
import { ClientsApiService } from '@services/api/clients-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { PatientTab } from '@core/stores/client-detail.store';
import { ClientDetailDialogComponent } from './client-detail-dialog/client-detail-dialog.component';
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
    InputTextModule, IconFieldModule, InputIconModule, SkeletonModule, TooltipModule,
    ClientDetailDialogComponent,
  ],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  private readonly clientsApi = inject(ClientsApiService);
  private readonly httpError = inject(HttpErrorService);
  protected readonly lang = inject(LanguageService);
  private readonly searchSubject = new Subject<void>();

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

  ngOnInit(): void {
    this.searchSubject.pipe(debounceTime(300)).subscribe(() => this.loadClients());
    this.loadClients();
  }

  /** Carga la lista completa agregada (todas las páginas). */
  loadClients(): void {
    this.loading.set(true);
    this.clientsApi.listClients({ search: this.searchTerm() || undefined }).subscribe({
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
