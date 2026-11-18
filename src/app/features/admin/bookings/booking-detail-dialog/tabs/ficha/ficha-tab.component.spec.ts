import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { FichaTabComponent } from './ficha-tab.component';
import { LanguageService } from '@services/language.service';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';
import { ClinicalRecordsStore } from '@core/stores/clinical-records.store';
import { BookingDialogStore } from '@core/stores/booking-dialog.store';
import { ClinicalRecordsApiService } from '@services/api/clinical-records-api.service';
import { ClinicalRecordTypesApiService } from '@services/api/clinical-record-types-api.service';
import { HttpErrorService } from '@services/http-error.service';
import type { ClinicalRecord, ClinicalRecordType } from '@models';

function makeType(overrides: Partial<ClinicalRecordType> = {}): ClinicalRecordType {
  return { id: 10, name: 'Ficha clínica', active: true, fields: [], ...overrides };
}

function makeRecord(overrides: Partial<ClinicalRecord> = {}): ClinicalRecord {
  return {
    id: 1,
    client_id: 7,
    record_type_id: 10,
    title: 'Ficha clínica · Evaluación kinesiológica lumbar',
    values: {},
    created_at: '2026-11-12T10:30:00-03:00',
    author_name: 'Camila Rojas',
    booking_id: 900,
    ...overrides,
  };
}

function makeSessionRecord(overrides: Partial<ClinicalRecord> = {}): ClinicalRecord {
  return makeRecord(overrides);
}

function makeHistoryRecord(overrides: Partial<ClinicalRecord> = {}): ClinicalRecord {
  return makeRecord({ booking_id: 901, ...overrides });
}

describe('FichaTabComponent', () => {
  let fixture: ComponentFixture<FichaTabComponent>;
  let component: FichaTabComponent;
  let typesStore: InstanceType<typeof ClinicalRecordTypesStore>;
  let recordsStore: InstanceType<typeof ClinicalRecordsStore>;
  const bookingSignal = signal<{ id: number; client?: { id: number } } | null>(null);

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [FichaTabComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MessageService, useValue: { add: vi.fn() } },
        LanguageService,
        { provide: BookingDialogStore, useValue: { booking: bookingSignal } },
        {
          provide: ClinicalRecordsApiService,
          useValue: {
            getRecords: vi.fn().mockReturnValue(of([])),
            createRecord: vi.fn(),
            updateRecord: vi.fn(),
            deleteRecord: vi.fn(),
          },
        },
        {
          provide: ClinicalRecordTypesApiService,
          useValue: {
            getTypes: vi.fn().mockReturnValue(of([])),
            createType: vi.fn(),
            updateType: vi.fn(),
          },
        },
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
      ],
    }).compileComponents();

    TestBed.inject(LanguageService).setLang('es');
    typesStore = TestBed.inject(ClinicalRecordTypesStore);
    recordsStore = TestBed.inject(ClinicalRecordsStore);
    patchState(unprotected(typesStore), { types: [], selectedId: null, search: '', draft: null });
    patchState(unprotected(recordsStore), {
      byClient: {},
      loadedClients: {},
      loadingClients: {},
      error: null,
    });
    bookingSignal.set(null);

    fixture = TestBed.createComponent(FichaTabComponent);
    component = fixture.componentInstance;
  }

  function render(): void {
    fixture.detectChanges();
  }

  it('muestra el servicio contratado cuando el padre lo informa', async () => {
    await setup();
    fixture.componentRef.setInput('serviceLabel', 'Kinesiología general · 3 sesiones');
    render();

    expect(fixture.nativeElement.textContent).toContain('Kinesiología general · 3 sesiones');
  });

  it('sin fichas asociadas muestra el estado vacío y ninguna tarjeta', async () => {
    await setup();
    render();

    expect(fixture.nativeElement.querySelector('[data-testid="associated-empty"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="associated-record"]').length).toBe(0);
  });

  it('renderiza una tarjeta por ficha asociada, con fecha y autor', async () => {
    await setup();
    bookingSignal.set({ id: 900, client: { id: 7 } });
    patchState(unprotected(recordsStore), {
      byClient: {
        7: [
          makeSessionRecord({ id: 1 }),
          makeSessionRecord({ id: 2, title: 'Ficha clínica · Evaluación inicial' }),
        ],
      },
      loadedClients: { 7: true },
    });
    render();

    const cards = fixture.nativeElement.querySelectorAll('[data-testid="associated-record"]');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Evaluación kinesiológica lumbar');
    expect(cards[0].textContent).toContain('12/11/2026');
    expect(cards[0].textContent).toContain('Camila Rojas');
  });

  it('«Ver más detalles» muestra el detalle inline en lugar de la lista', async () => {
    await setup();
    bookingSignal.set({ id: 900, client: { id: 7 } });
    patchState(unprotected(typesStore), { types: [makeType({ id: 10, name: 'Ficha clínica' })] });
    patchState(unprotected(recordsStore), { byClient: { 7: [makeSessionRecord({ id: 42 })] } });
    render();

    fixture.nativeElement
      .querySelector('[data-testid="associated-record"] .ficha__link')
      .dispatchEvent(new Event('click'));
    render();

    const detail = fixture.nativeElement.querySelector('bw-record-detail');
    expect(detail).toBeTruthy();
    expect(detail.textContent).toContain('Ficha clínica');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="associated-record"]').length).toBe(0);
    expect(fixture.nativeElement.querySelector('[data-testid="associated-empty"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="history-record"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="history-empty"]')).toBeNull();
  });

  it('«Volver a las fichas» vuelve a la lista inline', async () => {
    await setup();
    bookingSignal.set({ id: 900, client: { id: 7 } });
    patchState(unprotected(recordsStore), { byClient: { 7: [makeSessionRecord({ id: 42 })] } });
    render();

    fixture.nativeElement
      .querySelector('[data-testid="associated-record"] .ficha__link')
      .dispatchEvent(new Event('click'));
    render();

    const detailDebug = fixture.debugElement.queryAll(
      (de) => de.nativeElement?.tagName?.toLowerCase() === 'bw-record-detail',
    );
    detailDebug[0].triggerEventHandler('back', undefined);
    render();

    expect(fixture.nativeElement.querySelector('bw-record-detail')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="associated-record"]').length).toBe(1);
  });

  it('resuelve el tipo del registro desde el catálogo', async () => {
    await setup();
    patchState(unprotected(typesStore), {
      types: [makeType({ id: 10, name: 'Ficha clínica' }), makeType({ id: 11, name: 'Ficha láser' })],
    });

    expect(component.typeForRecord(makeRecord({ record_type_id: 11 }))?.name).toBe('Ficha láser');
    expect(component.typeForRecord(makeRecord({ record_type_id: 99 }))).toBeNull();
    expect(component.typeForRecord(null)).toBeNull();
  });

  it('sin tipos configurados deshabilita «Agregar», muestra el hint y sigue emitiendo configureTypes', async () => {
    await setup();
    render();

    const addButton = fixture.nativeElement.querySelector('[data-testid="add-record"]');
    expect(addButton).toBeTruthy();
    expect(addButton.disabled).toBe(true);

    const hint = fixture.nativeElement.querySelector('[data-testid="no-types-hint"]');
    expect(hint).toBeTruthy();
    expect(hint.textContent).toContain('Todavía no hay tipos de ficha configurados');

    const emitted: void[] = [];
    component.configureTypes.subscribe(() => emitted.push(undefined));

    const configureButton = fixture.nativeElement.querySelector('[data-testid="configure-types"]');
    expect(configureButton).toBeTruthy();
    configureButton.dispatchEvent(new Event('click'));

    expect(emitted.length).toBe(1);
  });

  it('lista solo tipos activos del catálogo y los ordena por sort_order (o creación)', async () => {
    await setup();
    bookingSignal.set({ id: 900, client: { id: 7 } });
    patchState(unprotected(typesStore), {
      types: [
        makeType({ id: 1, name: 'C · sin orden', active: true }),
        makeType({ id: 2, name: 'A · orden 10', active: true, sort_order: 10 }),
        makeType({ id: 3, name: 'B · orden 20', active: true, sort_order: 20 }),
        makeType({ id: 4, name: 'Tipo retirado', active: false }),
      ],
    });
    render();

    const addButton = fixture.nativeElement.querySelector('[data-testid="add-record"]');
    expect(addButton.disabled).toBe(false);
    expect(component.typeMenuItems().map((i) => i.label)).toEqual([
      'A · orden 10',
      'B · orden 20',
      'C · sin orden',
    ]);
    expect(component.typeMenuItems().map((i) => i.label)).not.toContain('Tipo retirado');
  });

  it('al elegir un tipo abre el diálogo de captura con ese tipo', async () => {
    await setup();
    bookingSignal.set({ id: 900, client: { id: 7 } });
    patchState(unprotected(typesStore), {
      types: [makeType({ id: 5, name: 'Láser', fields: [{ key: 'f1', label: 'Zona', type: 'text', required: false }] })],
    });
    render();

    component.typeMenuItems()[0].command!({});
    render();

    expect(component.formVisible()).toBe(true);
    expect(component.selectedType()?.id).toBe(5);
    expect(fixture.nativeElement.querySelector('bw-record-form-dialog')).toBeTruthy();
  });

  it('muestra el historial de consultas anteriores y su estado vacío', async () => {
    await setup();
    render();
    expect(fixture.nativeElement.querySelector('[data-testid="history-empty"]')).toBeTruthy();

    bookingSignal.set({ id: 900, client: { id: 7 } });
    patchState(unprotected(recordsStore), {
      byClient: { 7: [makeHistoryRecord({ id: 7, author_name: 'Kinesilk' })] },
    });
    render();

    const cards = fixture.nativeElement.querySelectorAll('[data-testid="history-record"]');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Kinesilk');
  });

  it('no muestra las fichas cacheadas de otro paciente', async () => {
    await setup();
    bookingSignal.set({ id: 900, client: { id: 7 } });
    // Las fichas existen, pero en el bucket del paciente 8.
    patchState(unprotected(recordsStore), {
      byClient: { 8: [makeSessionRecord({ id: 5, client_id: 8 })] },
    });
    render();

    expect(fixture.nativeElement.querySelector('[data-testid="associated-empty"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="associated-record"]').length).toBe(0);
    expect(fixture.nativeElement.querySelector('[data-testid="history-empty"]')).toBeTruthy();
  });

  it('formatea la fecha como dd/mm/aaaa - h:mm am/pm', async () => {
    await setup();
    render();

    expect(component.formatWhen('2026-11-12T10:30:00')).toBe('12/11/2026 - 10:30 am');
    expect(component.formatWhen('2026-11-12T19:05:00')).toBe('12/11/2026 - 7:05 pm');
    expect(component.formatWhen('no-es-fecha')).toBe('');
  });
});
