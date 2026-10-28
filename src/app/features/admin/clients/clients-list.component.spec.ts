import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of } from 'rxjs';
import { ClientsListComponent } from './clients-list.component';
import { ClientsApiService } from '@services/api/clients-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { ReferenceStore } from '@core/stores/reference.store';
import type { Client } from '@models';

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1,
    first_name: 'Ana',
    last_name: 'Pérez',
    email: 'ana@test.com',
    phone: '+56911111111',
    rut: '11111111-1',
    active: true,
    ...overrides,
  } as Client;
}

describe('ClientsListComponent', () => {
  let fixture: ComponentFixture<ClientsListComponent>;
  let component: ClientsListComponent;
  let mockClientsApi: { listClients: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockClientsApi = { listClients: vi.fn(() => of([])) };

    await TestBed.configureTestingModule({
      imports: [ClientsListComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClientsApiService, useValue: mockClientsApi },
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
        {
          provide: ReferenceStore,
          useValue: { locations: signal([]), providers: signal([]), services: signal([]) },
        },
        LanguageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsListComponent);
    component = fixture.componentInstance;
  });

  /** Setea el mock y dispara el primer load (ngOnInit corre en detectChanges). */
  function seed(clients: Client[]): void {
    mockClientsApi.listClients.mockReturnValue(of(clients));
    fixture.detectChanges();
  }

  it('carga la lista agregada vía listClients', () => {
    seed([makeClient({ id: 1 }), makeClient({ id: 2 })]);

    expect(mockClientsApi.listClients).toHaveBeenCalled();
    expect(component.clients()).toHaveLength(2);
  });

  it('pagina de a 10 y reporta el rango "Mostrando X-Y de N"', () => {
    seed(Array.from({ length: 12 }, (_, i) => makeClient({ id: i + 1 })));

    expect(component.totalRecords()).toBe(12);
    expect(component.pagedClients()).toHaveLength(10);
    expect(component.rangeFrom()).toBe(1);
    expect(component.rangeTo()).toBe(10);

    component.onPageChange({ page: 1 });

    expect(component.pagedClients()).toHaveLength(2);
    expect(component.rangeFrom()).toBe(11);
    expect(component.rangeTo()).toBe(12);
  });

  it('ordena client-side por la columna clickeada (y togglea la dirección)', () => {
    seed([
      makeClient({ id: 1, last_name: 'Zeta' }),
      makeClient({ id: 2, last_name: 'Alfa' }),
    ]);

    // Default: nombre asc → "Ana Alfa" antes que "Ana Zeta"
    expect(component.pagedClients().map((c) => c.id)).toEqual([2, 1]);

    component.toggleSort('name');
    expect(component.pagedClients().map((c) => c.id)).toEqual([1, 2]);
  });

  it('clampa la página si el total baja y deja de quedar vacía', () => {
    seed(Array.from({ length: 12 }, (_, i) => makeClient({ id: i + 1 })));
    component.onPageChange({ page: 1 });
    expect(component.page()).toBe(2);

    mockClientsApi.listClients.mockReturnValue(of(Array.from({ length: 3 }, (_, i) => makeClient({ id: i + 1 }))));
    component.loadClients();
    fixture.detectChanges();

    expect(component.page()).toBe(1);
    expect(component.pagedClients()).toHaveLength(3);
  });

  it('muestra la columna RUT', () => {
    seed([makeClient({ rut: '12345678-9' })]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('12345678-9');
  });

  // ── Filtros avanzados (T3) ────────────────────────────────────

  it('aplica los filtros del borrador al servicio (applyFilters)', () => {
    seed([makeClient()]);
    component.fLocationId.set(3);
    component.fHasBooked.set('upcoming');
    component.fGender.set('F');

    component.applyFilters();

    expect(component.activeFilterCount()).toBe(3);
    expect(mockClientsApi.listClients).toHaveBeenLastCalledWith(
      expect.objectContaining({ location_id: 3, has_booked: 'upcoming', gender: 'F' }),
    );
  });

  it('reestablece el borrador y los filtros aplicados (resetFilters)', () => {
    seed([makeClient()]);
    component.fLocationId.set(3);
    component.applyFilters();
    expect(component.activeFilterCount()).toBe(1);

    component.resetFilters();

    expect(component.appliedFilters()).toEqual({});
    expect(component.activeFilterCount()).toBe(0);
    expect(component.fLocationId()).toBeNull();
  });
});
