import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
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
  let mockClientsApi: {
    listClients: ReturnType<typeof vi.fn>;
    updateClient: ReturnType<typeof vi.fn>;
    createClient: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockClientsApi = {
      listClients: vi.fn(() => of([])),
      updateClient: vi.fn((id: number, data: Partial<Client>) => of({ ...makeClient({ id }), ...data } as Client)),
      createClient: vi.fn((data: Partial<Client>) => of({ ...makeClient({ id: 99 }), ...data } as Client)),
    };

    await TestBed.configureTestingModule({
      imports: [ClientsListComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClientsApiService, useValue: mockClientsApi },
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
        { provide: MessageService, useValue: { add: vi.fn() } },
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

  // ── Desactivación (409 + force) ───────────────────────────────

  it('desactiva sin re-consultar la lista: parchea el store', () => {
    seed([makeClient({ id: 1, active: true }), makeClient({ id: 2 })]);
    mockClientsApi.listClients.mockClear();
    mockClientsApi.updateClient.mockReturnValue(of(makeClient({ id: 1, active: false })));

    component.deactivateClient(component.clients()[0]);

    expect(mockClientsApi.updateClient).toHaveBeenCalledWith(1, { active: false });
    expect(mockClientsApi.listClients).not.toHaveBeenCalled();
    expect(component.clients().find((c) => c.id === 1)?.active).toBe(false);
  });

  it('abre el diálogo con los afectados cuando el 409 pide confirmación', () => {
    seed([makeClient({ id: 1, active: true })]);
    mockClientsApi.updateClient.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              error: 'deactivation_conflict',
              message: 'x',
              requires_confirmation: true,
              affects: {
                bookings: [
                  {
                    id: 10,
                    date: '2026-11-02',
                    time: '10:00',
                    provider_name: 'Pro A',
                    location_name: 'Sucursal Uno',
                    status: 'Confirmado',
                  },
                ],
                packs: [{ id: 20, service_pack: 'Pack 4 sesiones', remaining_sessions: 3 }],
              },
            },
          }),
      ),
    );

    component.deactivateClient(component.clients()[0]);

    expect(component.deactivateDialogVisible()).toBe(true);
    expect(component.deactivateAffects()?.bookings.length).toBe(1);
    expect(component.deactivateAffects()?.packs.length).toBe(1);

    const booking = component.deactivateAffects()!.bookings[0];
    expect(component.bookingLabel(booking)).toContain('2026-11-02 10:00');
    expect(component.bookingLabel(booking)).toContain('Pro A');
    const pack = component.deactivateAffects()!.packs[0];
    expect(component.packLabel(pack)).toContain('Pack 4 sesiones');
    expect(component.packLabel(pack)).toContain('3');
  });

  it('reintenta con force al confirmar y parchea la lista', () => {
    seed([makeClient({ id: 1, active: true })]);
    mockClientsApi.updateClient.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { requires_confirmation: true, affects: { bookings: [], packs: [] } },
          }),
      ),
    );
    component.deactivateClient(component.clients()[0]);
    expect(component.deactivateDialogVisible()).toBe(true);

    mockClientsApi.updateClient.mockReturnValueOnce(of(makeClient({ id: 1, active: false })));
    component.confirmDeactivate();

    expect(mockClientsApi.updateClient).toHaveBeenLastCalledWith(1, { active: false, force: true });
    expect(component.clients().find((c) => c.id === 1)?.active).toBe(false);
    expect(component.deactivateDialogVisible()).toBe(false);
  });
});
