import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { of, throwError } from 'rxjs';
import { RecordFormDialogComponent } from './record-form-dialog.component';
import { ClinicalRecordsStore } from '@core/stores/clinical-records.store';
import { ClinicalRecordsApiService } from '@services/api/clinical-records-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import type { ClinicalRecord, ClinicalRecordField, ClinicalRecordType } from '@models';

function makeField(overrides: Partial<ClinicalRecordField> = {}): ClinicalRecordField {
  return { key: 'f1', label: 'Campo', type: 'text', required: false, ...overrides };
}

function makeType(fields: ClinicalRecordField[], overrides: Partial<ClinicalRecordType> = {}): ClinicalRecordType {
  return { id: 10, name: 'Ficha clínica', active: true, fields, ...overrides };
}

function makeServerRecord(overrides: Partial<ClinicalRecord> = {}): ClinicalRecord {
  return {
    id: 123,
    client_id: 7,
    booking_id: 900,
    record_type_id: 10,
    title: 'Ficha clínica',
    values: {},
    created_at: '2026-11-12T10:30:00-03:00',
    author_name: null,
    created_by: null,
    ...overrides,
  };
}

describe('RecordFormDialogComponent', () => {
  let fixture: ComponentFixture<RecordFormDialogComponent>;
  let component: RecordFormDialogComponent;
  let recordsStore: InstanceType<typeof ClinicalRecordsStore>;
  let recordsApi: { createRecord: ReturnType<typeof vi.fn> };
  let httpError: { handle: ReturnType<typeof vi.fn> };

  async function setup(type: ClinicalRecordType): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [RecordFormDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClinicalRecordsApiService, useValue: recordsApi },
        { provide: HttpErrorService, useValue: httpError },
        { provide: LanguageService, useValue: { t: (k: string) => k } },
      ],
    }).compileComponents();

    recordsStore = TestBed.inject(ClinicalRecordsStore);
    patchState(unprotected(recordsStore), { records: [] });

    fixture = TestBed.createComponent(RecordFormDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('type', type);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('bookingId', 900);
    fixture.componentRef.setInput('clientId', 7);
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
    recordsApi = { createRecord: vi.fn() };
    httpError = { handle: vi.fn() };
  });

  it('renderiza el control correcto para cada tipo de campo', async () => {
    await setup(
      makeType([
        makeField({ key: 'f_text', label: 'Texto', type: 'text' }),
        makeField({ key: 'f_long', label: 'Largo', type: 'longtext' }),
        makeField({ key: 'f_num', label: 'Número', type: 'number' }),
        makeField({ key: 'f_sel', label: 'Selección', type: 'select', options: ['A', 'B'] }),
        makeField({ key: 'f_date', label: 'Fecha', type: 'date' }),
      ]),
    );

    const el = fixture.nativeElement as HTMLElement;
    expect((el.querySelector('#rfd-f_text') as HTMLInputElement)?.type).toBe('text');
    expect(el.querySelector('#rfd-f_long')?.tagName).toBe('TEXTAREA');
    expect((el.querySelector('#rfd-f_num') as HTMLInputElement)?.type).toBe('number');
    expect(el.querySelector('#rfd-f_date')?.tagName).toBe('INPUT');
    expect((el.querySelector('#rfd-f_date') as HTMLInputElement)?.type).toBe('date');
    expect(el.querySelector('p-select')).toBeTruthy();
  });

  it('muestra las options de un campo select', async () => {
    await setup(makeType([makeField({ key: 'f_sel', label: 'Color', type: 'select', options: ['Rojo', 'Azul'] })]));

    expect(component.selectOptions(makeField({ key: 'f_sel', type: 'select', options: ['Rojo', 'Azul'] }))).toEqual([
      { label: 'Rojo', value: 'Rojo' },
      { label: 'Azul', value: 'Azul' },
    ]);
    expect((fixture.nativeElement as HTMLElement).querySelector('p-select')).toBeTruthy();
  });

  it('un campo requerido vacío bloquea el submit y muestra el mensaje por campo', async () => {
    await setup(makeType([makeField({ key: 'f_name', label: 'Nombre', type: 'text', required: true })]));

    buttonByText('ficha.form.save')!.click();
    render();

    expect(recordsApi.createRecord).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('.rfd-error')?.textContent).toContain('ficha.form.required');
  });

  it('un select solo acepta valores de sus options', async () => {
    await setup(makeType([makeField({ key: 'f_sel', label: 'Color', type: 'select', options: ['Rojo', 'Azul'] })]));

    component.form().controls['f_sel'].setValue('Verde');
    buttonByText('ficha.form.save')!.click();
    render();

    expect(recordsApi.createRecord).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('.rfd-error')?.textContent).toContain('ficha.form.invalid_option');
  });

  it('al guardar hace el POST con los values correctos y emite `saved`', async () => {
    const serverRecord = makeServerRecord();
    recordsApi.createRecord.mockReturnValue(of(serverRecord));
    await setup(
      makeType([
        makeField({ key: 'f_name', label: 'Nombre', type: 'text', required: true }),
        makeField({ key: 'f_age', label: 'Edad', type: 'number' }),
        makeField({ key: 'f_color', label: 'Color', type: 'select', options: ['Rojo', 'Azul'] }),
        makeField({ key: 'f_date', label: 'Fecha', type: 'date' }),
      ]),
    );

    component.form().controls['f_name'].setValue('Ana');
    component.form().controls['f_age'].setValue('30');
    component.form().controls['f_color'].setValue('Rojo');
    component.form().controls['f_date'].setValue('2026-11-12');
    render();

    const savedEmitted: void[] = [];
    component.saved.subscribe(() => savedEmitted.push(undefined));

    buttonByText('ficha.form.save')!.click();
    render();

    expect(recordsApi.createRecord).toHaveBeenCalledTimes(1);
    expect(recordsApi.createRecord).toHaveBeenCalledWith({
      client_id: 7,
      booking_id: 900,
      record_type_id: 10,
      values: {
        f_name: 'Ana',
        f_age: '30',
        f_color: 'Rojo',
        f_date: '2026-11-12',
      },
    });
    expect(savedEmitted.length).toBe(1);
    expect(component.saving()).toBe(false);

    expect(recordsStore.records().length).toBe(1);
    const record = recordsStore.records()[0];
    expect(record.id).toBe(123);
    expect(record.record_type_id).toBe(10);
    expect(record.title).toBe('Ficha clínica');
    expect(record.booking_id).toBe(900);
    expect(record.client_id).toBe(7);
  });

  it('un error al guardar no emite `saved` y lo reporta vía HttpErrorService', async () => {
    recordsApi.createRecord.mockReturnValue(throwError(() => new Error('boom')));
    await setup(makeType([makeField({ key: 'f_name', label: 'Nombre', type: 'text', required: true })]));

    component.form().controls['f_name'].setValue('Ana');
    render();

    const savedEmitted: void[] = [];
    component.saved.subscribe(() => savedEmitted.push(undefined));

    buttonByText('ficha.form.save')!.click();
    render();

    expect(savedEmitted.length).toBe(0);
    expect(component.saving()).toBe(false);
    expect(recordsStore.records().length).toBe(0);
    expect(httpError.handle).toHaveBeenCalledTimes(1);
    expect(httpError.handle).toHaveBeenCalledWith(expect.any(Error), 'ficha.form.save');
  });
});
