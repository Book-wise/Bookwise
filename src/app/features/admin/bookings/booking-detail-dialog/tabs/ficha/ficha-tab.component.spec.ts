import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { MessageService } from 'primeng/api';
import { FichaTabComponent } from './ficha-tab.component';
import { LanguageService } from '@services/language.service';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';
import { ClinicalRecordsStore, type SessionClinicalRecord } from '@core/stores/clinical-records.store';
import { BookingDialogStore } from '@core/stores/booking-dialog.store';
import type { ClinicalRecord, ClinicalRecordType } from '@models';

function makeType(overrides: Partial<ClinicalRecordType> = {}): ClinicalRecordType {
  return { id: 10, name: 'Ficha clínica', active: true, fields: [], ...overrides };
}

function makeHistoryRecord(overrides: Partial<ClinicalRecord> = {}): ClinicalRecord {
  return {
    id: 1,
    record_type_id: 10,
    title: 'Ficha clínica · Evaluación kinesiológica lumbar',
    created_at: '2026-11-12T10:30:00-03:00',
    author_name: 'Camila Rojas',
    booking_id: 900,
    ...overrides,
  };
}

function makeSessionRecord(overrides: Partial<SessionClinicalRecord> = {}): SessionClinicalRecord {
  return {
    id: 1,
    record_type_id: 10,
    title: 'Ficha clínica · Evaluación kinesiológica lumbar',
    created_at: '2026-11-12T10:30:00-03:00',
    author_name: 'Camila Rojas',
    booking_id: 900,
    client_id: 7,
    values: {},
    pendingSync: true,
    ...overrides,
  };
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
      ],
    }).compileComponents();

    TestBed.inject(LanguageService).setLang('es');
    typesStore = TestBed.inject(ClinicalRecordTypesStore);
    recordsStore = TestBed.inject(ClinicalRecordsStore);
    patchState(unprotected(typesStore), { types: [], selectedId: null, search: '', draft: null });
    patchState(unprotected(recordsStore), { records: [] });
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
    bookingSignal.set({ id: 900 });
    patchState(unprotected(recordsStore), {
      records: [makeSessionRecord({ id: 1 }), makeSessionRecord({ id: 2, title: 'Ficha clínica · Evaluación inicial' })],
    });
    render();

    const cards = fixture.nativeElement.querySelectorAll('[data-testid="associated-record"]');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Evaluación kinesiológica lumbar');
    expect(cards[0].textContent).toContain('12/11/2026');
    expect(cards[0].textContent).toContain('Camila Rojas');
  });

  it('emite el id del registro al pedir «Ver más detalles»', async () => {
    await setup();
    bookingSignal.set({ id: 900 });
    patchState(unprotected(recordsStore), { records: [makeSessionRecord({ id: 42 })] });
    render();

    const emitted: number[] = [];
    component.openRecord.subscribe((id) => emitted.push(id));

    fixture.nativeElement
      .querySelector('[data-testid="associated-record"] .ficha__link')
      .dispatchEvent(new Event('click'));

    expect(emitted).toEqual([42]);
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

  it('muestra el chip «Sin guardar» en los registros de la sesión', async () => {
    await setup();
    bookingSignal.set({ id: 900 });
    patchState(unprotected(recordsStore), { records: [makeSessionRecord({ id: 1 })] });
    render();

    const chip = fixture.nativeElement.querySelector('[data-testid="pending-sync"]');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('Sin guardar');
  });

  it('muestra el historial de consultas anteriores y su estado vacío', async () => {
    await setup();
    render();
    expect(fixture.nativeElement.querySelector('[data-testid="history-empty"]')).toBeTruthy();

    fixture.componentRef.setInput('history', [makeHistoryRecord({ id: 7, author_name: 'Kinesilk' })]);
    render();

    const cards = fixture.nativeElement.querySelectorAll('[data-testid="history-record"]');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Kinesilk');
  });

  it('formatea la fecha como dd/mm/aaaa - h:mm am/pm', async () => {
    await setup();
    render();

    expect(component.formatWhen('2026-11-12T10:30:00')).toBe('12/11/2026 - 10:30 am');
    expect(component.formatWhen('2026-11-12T19:05:00')).toBe('12/11/2026 - 7:05 pm');
    expect(component.formatWhen('no-es-fecha')).toBe('');
  });
});
