import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ClientDetailDialogComponent } from './client-detail-dialog.component';
import { ClientDetailStore, PatientTab, PatientView } from '@core/stores/client-detail.store';
import { LanguageService } from '@services/language.service';
import { AuthService } from '@services/auth.service';
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

function emptyDomain<T>() {
  return { data: [] as T[], loading: false, loaded: true, error: null };
}

describe('ClientDetailDialogComponent', () => {
  let fixture: ComponentFixture<ClientDetailDialogComponent>;
  let component: ClientDetailDialogComponent;
  let store: {
    client: ReturnType<typeof signal<Client | null>>;
    activeView: ReturnType<typeof signal<PatientView>>;
    notifications: ReturnType<typeof signal<Record<string, boolean>>>;
    packs: ReturnType<typeof signal<unknown>>;
    sales: ReturnType<typeof signal<unknown>>;
    recent: ReturnType<typeof signal<unknown>>;
    initialize: ReturnType<typeof vi.fn>;
    loadPacks: ReturnType<typeof vi.fn>;
    loadSales: ReturnType<typeof vi.fn>;
    loadRecent: ReturnType<typeof vi.fn>;
    selectTab: ReturnType<typeof vi.fn>;
    returnToReservation: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
    setNotification: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    store = {
      client: signal<Client | null>(null),
      activeView: signal<PatientView>('reserva'),
      notifications: signal({
        email_new_booking: false,
        email_booking_confirmation: false,
        email_booking_cancellation: false,
        whatsapp_reminder: false,
        whatsapp_cancellation_confirmation: false,
      }),
      packs: signal(emptyDomain()),
      sales: signal(emptyDomain()),
      recent: signal(emptyDomain()),
      initialize: vi.fn(),
      loadPacks: vi.fn(),
      loadSales: vi.fn(),
      loadRecent: vi.fn(),
      selectTab: vi.fn((tab: PatientTab) => store.activeView.set(tab)),
      returnToReservation: vi.fn(() => store.activeView.set('reserva')),
      reset: vi.fn(),
      setNotification: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ClientDetailDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClientDetailStore, useValue: store },
        { provide: AuthService, useValue: { hasPermission: vi.fn(() => true) } },
        LanguageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientDetailDialogComponent);
    component = fixture.componentInstance;
  });

  it('inicializa el store y carga packs/sales/recent al abrir con un cliente', () => {
    fixture.componentRef.setInput('client', makeClient({ id: 42 }));
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    expect(store.initialize).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
    expect(store.loadPacks).toHaveBeenCalledWith(42);
    expect(store.loadSales).toHaveBeenCalledWith(42);
    expect(store.loadRecent).toHaveBeenCalledWith(42);
  });

  it('abre en la tab indicada (Ver Packs → planes)', () => {
    fixture.componentRef.setInput('client', makeClient({ id: 7 }));
    fixture.componentRef.setInput('initialTab', 'planes');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    expect(store.selectTab).toHaveBeenCalledWith('planes');
  });

  it('emite closed al cerrar', () => {
    const spy = vi.spyOn(component.closed, 'emit');

    component.close();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('resetea el store al ocultarse el diálogo', () => {
    component.onDialogHide();

    expect(store.reset).toHaveBeenCalledTimes(1);
  });

  it('delega la selección de tab y el retorno al store', () => {
    component.onPatientTabSelected('sesiones');
    expect(store.selectTab).toHaveBeenCalledWith('sesiones');

    component.returnToReservation();
    expect(store.returnToReservation).toHaveBeenCalledTimes(1);
  });

  it('expone la tab narrow activa (planes por defecto fuera de reserva)', () => {
    store.activeView.set('reserva');
    expect(component.activeDetailTab()).toBe('planes');
    store.activeView.set('prepago');
    expect(component.activeDetailTab()).toBe('prepago');
  });
});
