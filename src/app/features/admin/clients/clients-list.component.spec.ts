import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { ClientsListComponent } from './clients-list.component';
import { ClientsApiService, ClientPage } from '@services/api/clients-api.service';
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

function makePage(
  rows: Client[],
  total = rows.length,
  from = rows.length ? 1 : 0,
  to = rows.length,
  lastPage = Math.max(1, Math.ceil(total / 10)),
): ClientPage {
  return { rows, total, from, to, lastPage, currentPage: 1 };
}

describe('ClientsListComponent', () => {
  let fixture: ComponentFixture<ClientsListComponent>;
  let component: ClientsListComponent;
  let mockClientsApi: {
    listClientsPage: ReturnType<typeof vi.fn>;
    updateClient: ReturnType<typeof vi.fn>;
    createClient: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockClientsApi = {
      listClientsPage: vi.fn(() => of(makePage([]))),
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

  /** Setea el mock con una página y dispara el primer load (ngOnInit). */
  function seed(rows: Client[], total = rows.length, page = makePage(rows, total)): void {
    mockClientsApi.listClientsPage.mockReturnValue(of(page));
    fixture.detectChanges();
  }

  it('carga una página vía listClientsPage (server-side)', () => {
    seed([makeClient({ id: 1 }), makeClient({ id: 2 })]);

    expect(mockClientsApi.listClientsPage).toHaveBeenCalled();
    expect(component.clients()).toHaveLength(2);
  });

  it('usa meta.total/from/to de la página para el contador', () => {
    seed([makeClient()], 42, makePage([makeClient()], 42, 11, 20, 5));

    expect(component.totalRecords()).toBe(42);
    expect(component.rangeFrom()).toBe(11);
    expect(component.rangeTo()).toBe(20);
  });

  it('onPageChange recarga server-side con la página pedida', () => {
    seed([makeClient()], 25);
    mockClientsApi.listClientsPage.mockClear();

    component.onPageChange({ page: 1 }); // 0-based → página 2

    expect(component.page()).toBe(2);
    expect(mockClientsApi.listClientsPage).toHaveBeenCalledWith(expect.anything(), 2, 10);
  });

  it('toggleSort recarga server-side con sort/direction', () => {
    seed([makeClient()]);
    mockClientsApi.listClientsPage.mockClear();

    component.toggleSort('email');

    expect(component.sortField()).toBe('email');
    expect(mockClientsApi.listClientsPage).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'email', direction: 'asc' }),
      1,
      10,
    );
  });

  it('aplica los filtros del borrador al servicio (applyFilters)', () => {
    seed([makeClient()]);
    component.fLocationId.set(3);
    component.fHasBooked.set('upcoming');
    component.fGender.set('F');
    mockClientsApi.listClientsPage.mockClear();

    component.applyFilters();

    expect(component.activeFilterCount()).toBe(3);
    expect(mockClientsApi.listClientsPage).toHaveBeenCalledWith(
      expect.objectContaining({ location_id: 3, has_booked: 'upcoming', gender: 'F' }),
      1,
      10,
    );
  });

  it('reestablece borrador, filtros y orden (resetFilters)', () => {
    seed([makeClient()]);
    component.fLocationId.set(3);
    component.toggleSort('email');

    component.resetFilters();

    expect(component.appliedFilters()).toEqual({});
    expect(component.fLocationId()).toBeNull();
    expect(component.sortField()).toBe('name');
    expect(component.sortDir()).toBe('asc');
  });

  it('muestra la columna RUT', () => {
    seed([makeClient({ rut: '12345678-9' })]);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('12345678-9');
  });

  // ── Desactivación (409 + force) ───────────────────────────────

  it('desactiva sin re-consultar la lista: parchea el store', () => {
    seed([makeClient({ id: 1, active: true }), makeClient({ id: 2 })]);
    mockClientsApi.listClientsPage.mockClear();
    mockClientsApi.updateClient.mockReturnValue(of(makeClient({ id: 1, active: false })));

    component.deactivateClient(component.clients()[0]);

    expect(mockClientsApi.updateClient).toHaveBeenCalledWith(1, { active: false });
    expect(mockClientsApi.listClientsPage).not.toHaveBeenCalled();
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
                packs: [
                  {
                    id: 20,
                    service_pack: 'Pack 4 sesiones',
                    total_sessions: 4,
                    used_sessions: 3,
                    remaining_sessions: 1,
                  },
                ],
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
    expect(component.packLabel(pack)).toContain('1 de 4');
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
