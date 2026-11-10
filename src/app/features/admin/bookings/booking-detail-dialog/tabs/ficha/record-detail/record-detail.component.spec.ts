import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { of } from 'rxjs';
import { RecordDetailComponent } from './record-detail.component';
import { ClinicalRecordsStore } from '@core/stores/clinical-records.store';
import { ClinicalRecordsApiService } from '@services/api/clinical-records-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import type { ClinicalRecord, ClinicalRecordField, ClinicalRecordType } from '@models';

function makeField(overrides: Partial<ClinicalRecordField> = {}): ClinicalRecordField {
  return { key: 'f1', label: 'Campo', type: 'text', required: false, ...overrides };
}

function makeType(fields: ClinicalRecordField[], overrides: Partial<ClinicalRecordType> = {}): ClinicalRecordType {
  return { id: 10, name: 'Evaluación kinésica', active: true, fields, ...overrides };
}

function makeRecord(overrides: Partial<ClinicalRecord> = {}): ClinicalRecord {
  return {
    id: 123,
    client_id: 7,
    booking_id: 900,
    record_type_id: 10,
    title: 'Evaluación kinésica',
    values: { diagnostico: 'Lumbalgia mecánica', dolor: '6' },
    created_at: '2026-11-12T10:30:00',
    author_name: 'Karla Muñoz',
    created_by: null,
    ...overrides,
  };
}

const FIELDS: ClinicalRecordField[] = [
  makeField({ key: 'diagnostico', label: 'Diagnóstico' }),
  makeField({ key: 'objetivo', label: 'Objetivo', type: 'longtext' }),
  makeField({ key: 'dolor', label: 'Dolor (EVA 0-10)', type: 'number' }),
  makeField({ key: 'observaciones', label: 'Observaciones', type: 'longtext' }),
];

describe('RecordDetailComponent', () => {
  let fixture: ComponentFixture<RecordDetailComponent>;
  let component: RecordDetailComponent;
  let recordsStore: InstanceType<typeof ClinicalRecordsStore>;
  let recordsApi: { updateRecord: ReturnType<typeof vi.fn> };
  let httpError: { handle: ReturnType<typeof vi.fn> };

  async function setup(record: ClinicalRecord, type: ClinicalRecordType | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [RecordDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClinicalRecordsApiService, useValue: recordsApi },
        { provide: HttpErrorService, useValue: httpError },
        LanguageService,
      ],
    }).compileComponents();

    TestBed.inject(LanguageService).setLang('es');
    recordsStore = TestBed.inject(ClinicalRecordsStore);
    patchState(unprotected(recordsStore), { records: [record] });

    fixture = TestBed.createComponent(RecordDetailComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('record', record);
    fixture.componentRef.setInput('type', type);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function render(): void {
    fixture.detectChanges();
  }

  function buttonByText(text: string): HTMLButtonElement | null {
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    );
    return buttons.find((b) => (b.textContent ?? '').includes(text)) ?? null;
  }

  beforeEach(() => {
    recordsApi = { updateRecord: vi.fn() };
    httpError = { handle: vi.fn() };
  });

  it('en modo lectura muestra el título, la fecha/autor y solo los campos con valor', async () => {
    await setup(makeRecord(), makeType(FIELDS));

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.detail__title')?.textContent).toContain('Evaluación kinésica');
    expect(el.querySelector('.detail__meta')?.textContent).toContain('12/11/2026 - 10:30 am');
    expect(el.querySelector('.detail__meta')?.textContent).toContain('Karla Muñoz');

    const labels = Array.from(el.querySelectorAll('.detail__field dt')).map((dt) => dt.textContent?.trim());
    expect(labels).toEqual(['Diagnóstico', 'Dolor (EVA 0-10)']);

    const values = Array.from(el.querySelectorAll('.detail__field dd')).map((dd) => dd.textContent?.trim());
    expect(values).toEqual(['Lumbalgia mecánica', '6']);
  });

  it('sin campos con valor muestra el estado vacío en vez de una lista en blanco', async () => {
    await setup(makeRecord({ values: {} }), makeType(FIELDS));

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.detail__field').length).toBe(0);
    expect(el.querySelector('[data-testid="detail-no-values"]')?.textContent).toContain(
      'todavía no tiene valores',
    );
  });

  it('formatea los campos de tipo fecha como dd/mm/aaaa', async () => {
    await setup(
      makeRecord({ values: { fecha: '2026-11-12' } }),
      makeType([makeField({ key: 'fecha', label: 'Fecha', type: 'date' })]),
    );

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.detail__field dd')?.textContent?.trim()).toBe('12/11/2026');
    expect(component.formatValue({ key: 'fecha', label: 'Fecha', type: 'date', value: '2026-11-12' })).toBe(
      '12/11/2026',
    );
    expect(component.formatValue({ key: 'x', label: 'X', type: 'text', value: '12/11/2026' })).toBe(
      '12/11/2026',
    );
  });

  it('«Editar ficha» muestra el formulario prellenado con los valores guardados', async () => {
    await setup(makeRecord(), makeType(FIELDS));

    buttonByText('Editar ficha')!.click();
    render();

    expect(component.mode()).toBe('edit');
    expect(component.form().getRawValue()).toEqual({
      diagnostico: 'Lumbalgia mecánica',
      objetivo: '',
      dolor: '6',
      observaciones: '',
    });

    const el = fixture.nativeElement as HTMLElement;
    expect(buttonByText('Editar ficha')).toBeNull();
    expect(buttonByText('Imprimir ficha')).toBeNull();
    expect(buttonByText('Guardar cambios')).toBeTruthy();
    expect(buttonByText('Cancelar')).toBeTruthy();
    expect((el.querySelector('#rd-diagnostico') as HTMLInputElement)?.value).toBe('Lumbalgia mecánica');
  });

  it('«Guardar cambios» llama a store.update y vuelve a la lectura', async () => {
    recordsApi.updateRecord.mockReturnValue(
      of(makeRecord({ values: { diagnostico: 'Lumbalgia crónica', dolor: '4' } })),
    );
    await setup(makeRecord(), makeType(FIELDS));

    buttonByText('Editar ficha')!.click();
    render();

    component.form().controls['diagnostico'].setValue('Lumbalgia crónica');
    component.form().controls['dolor'].setValue('4');
    render();

    buttonByText('Guardar cambios')!.click();
    render();

    expect(recordsApi.updateRecord).toHaveBeenCalledTimes(1);
    expect(recordsApi.updateRecord).toHaveBeenCalledWith(123, {
      values: { diagnostico: 'Lumbalgia crónica', objetivo: '', dolor: '4', observaciones: '' },
    });
    expect(component.mode()).toBe('read');
    expect(component.saving()).toBe(false);
  });

  it('«Cancelar» vuelve a la lectura sin guardar y descarta lo escrito', async () => {
    await setup(makeRecord(), makeType(FIELDS));

    buttonByText('Editar ficha')!.click();
    render();
    component.form().controls['diagnostico'].setValue('Borrador');
    render();

    buttonByText('Cancelar')!.click();
    render();

    expect(recordsApi.updateRecord).not.toHaveBeenCalled();
    expect(component.mode()).toBe('read');

    buttonByText('Editar ficha')!.click();
    render();
    expect(component.form().controls['diagnostico'].value).toBe('Lumbalgia mecánica');
  });

  it('un campo obligatorio vacío bloquea el guardado y muestra el mensaje', async () => {
    await setup(
      makeRecord({ values: {} }),
      makeType([makeField({ key: 'motivo', label: 'Motivo', type: 'text', required: true })]),
    );

    buttonByText('Editar ficha')!.click();
    render();

    buttonByText('Guardar cambios')!.click();
    render();

    expect(recordsApi.updateRecord).not.toHaveBeenCalled();
    expect(component.mode()).toBe('edit');
    expect((fixture.nativeElement as HTMLElement).querySelector('.detail__error')?.textContent).toContain(
      'Este campo es obligatorio',
    );
  });

  it('un select solo acepta valores de sus options', async () => {
    await setup(
      makeRecord({ values: { color: 'Rojo' } }),
      makeType([makeField({ key: 'color', label: 'Color', type: 'select', options: ['Rojo', 'Azul'] })]),
    );

    buttonByText('Editar ficha')!.click();
    render();
    component.form().controls['color'].setValue('Verde');
    render();

    buttonByText('Guardar cambios')!.click();
    render();

    expect(recordsApi.updateRecord).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('.detail__error')?.textContent).toContain(
      'Selecciona una opción válida',
    );
  });

  it('«Volver a las fichas» emite `back` también desde la edición', async () => {
    await setup(makeRecord(), makeType(FIELDS));

    const emitted: void[] = [];
    component.back.subscribe(() => emitted.push(undefined));

    buttonByText('Volver a las fichas')!.click();
    expect(emitted.length).toBe(1);

    buttonByText('Editar ficha')!.click();
    render();
    buttonByText('Volver a las fichas')!.click();
    expect(emitted.length).toBe(2);
  });

  it('«Imprimir ficha» usa window.print mientras no exista el PDF', async () => {
    await setup(makeRecord(), makeType(FIELDS));

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    buttonByText('Imprimir ficha')!.click();

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });
});
