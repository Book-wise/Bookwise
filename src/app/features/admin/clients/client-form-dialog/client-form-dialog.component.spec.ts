import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { ClientFormDialogComponent } from './client-form-dialog.component';
import { ClientsApiService } from '@services/api/clients-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
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

describe('ClientFormDialogComponent', () => {
  let fixture: ComponentFixture<ClientFormDialogComponent>;
  let component: ClientFormDialogComponent;
  let mockClientsApi: {
    createClient: ReturnType<typeof vi.fn>;
    updateClient: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockClientsApi = {
      createClient: vi.fn((payload: Partial<Client>) => of({ id: 99, ...payload, active: true } as Client)),
      updateClient: vi.fn((id: number, payload: Partial<Client>) => of({ id, ...payload, active: true } as Client)),
    };

    await TestBed.configureTestingModule({
      imports: [ClientFormDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClientsApiService, useValue: mockClientsApi },
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
        LanguageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientFormDialogComponent);
    component = fixture.componentInstance;
  });

  function open(): void {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  it('arranca en modo alta y no permite guardar vacío', () => {
    open();

    expect(component.mode()).toBe('create');
    expect(component.canSave()).toBe(false);
  });

  it('precarga los datos en modo edición', () => {
    fixture.componentRef.setInput('client', makeClient({ id: 5, first_name: 'Ana', rut: '11111111-1' }));
    open();

    expect(component.mode()).toBe('edit');
    expect(component.firstName()).toBe('Ana');
    expect(component.rut()).toBe('11111111-1');
  });

  it('bloquea guardar cuando el RUT es inválido', () => {
    open();
    component.firstName.set('Ana');
    component.lastName.set('Pérez');
    component.email.set('ana@test.com');
    component.rut.set('12345678-9'); // DV inválido (el correcto es 5)

    expect(component.rutInvalid()).toBe(true);
    expect(component.canSave()).toBe(false);
  });

  it('crea un cliente con createClient()', () => {
    open();
    component.firstName.set('Ana');
    component.lastName.set('Pérez');
    component.email.set('ana@test.com');
    component.rut.set('11111111-1');
    const spy = vi.spyOn(component.saved, 'emit');

    component.save();

    expect(mockClientsApi.createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Ana',
        last_name: 'Pérez',
        email: 'ana@test.com',
        rut: '11111111-1',
      }),
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('edita un cliente existente con updateClient(id, payload)', () => {
    fixture.componentRef.setInput('client', makeClient({ id: 5 }));
    open();
    component.email.set('nuevo@test.com');
    const spy = vi.spyOn(component.saved, 'emit');

    component.save();

    expect(mockClientsApi.updateClient).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ email: 'nuevo@test.com' }),
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('precarga birth_date en modo edición y la envía en el payload', () => {
    fixture.componentRef.setInput('client', makeClient({ id: 5, birth_date: '1990-05-10' }));
    open();

    expect(component.birthDate()).toBe('1990-05-10');

    component.save();

    expect(mockClientsApi.updateClient).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ birth_date: '1990-05-10' }),
    );
  });

  it('emite closed al cancelar', () => {
    const spy = vi.spyOn(component.closed, 'emit');

    component.close();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
