import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { of, throwError } from 'rxjs';
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
  let recordsApi: {
    updateRecord: ReturnType<typeof vi.fn>;
    uploadImage: ReturnType<typeof vi.fn>;
    getImageBlob: ReturnType<typeof vi.fn>;
    getPdf: ReturnType<typeof vi.fn>;
  };
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
    patchState(unprotected(recordsStore), {
      byClient: { [record.client_id]: [record] },
      loadedClients: { [record.client_id]: true },
    });

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
    recordsApi = {
      updateRecord: vi.fn(),
      uploadImage: vi.fn(),
      getImageBlob: vi.fn().mockReturnValue(of(new Blob(['png'], { type: 'image/png' }))),
      getPdf: vi.fn(),
    };
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

  it('«Imprimir ficha» abre el PDF como blob en una pestaña nueva', async () => {
    await setup(makeRecord(), makeType(FIELDS));

    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    recordsApi.getPdf.mockReturnValue(of(pdf));
    const urls = mockObjectUrls();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    try {
      buttonByText('Imprimir ficha')!.click();
      render();

      expect(recordsApi.getPdf).toHaveBeenCalledTimes(1);
      expect(recordsApi.getPdf).toHaveBeenCalledWith(123);
      expect(urls.create).toHaveBeenCalledWith(pdf);
      expect(openSpy).toHaveBeenCalledWith('blob:fake', '_blank');
      expect(printSpy).not.toHaveBeenCalled();
    } finally {
      urls.restore();
      printSpy.mockRestore();
      openSpy.mockRestore();
    }
  });

  it('si el PDF falla, «Imprimir ficha» cae a window.print', async () => {
    await setup(makeRecord(), makeType(FIELDS));

    recordsApi.getPdf.mockReturnValue(throwError(() => new Error('boom')));
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    try {
      buttonByText('Imprimir ficha')!.click();
      render();

      expect(recordsApi.getPdf).toHaveBeenCalledTimes(1);
      expect(printSpy).toHaveBeenCalledTimes(1);
    } finally {
      printSpy.mockRestore();
    }
  });

  // ── Campo image (F10) ────────────────────────────────────────────────

  const IMAGE_FIELDS: ClinicalRecordField[] = [
    makeField({ key: 'diagnostico', label: 'Diagnóstico' }),
    makeField({ key: 'lesion', label: 'Lesión', type: 'image' }),
  ];

  const withImage = (): ClinicalRecord =>
    makeRecord({ images: { lesion: '/clinical-records/123/image/lesion' } });

  function mockObjectUrls(): {
    create: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
    restore: () => void;
  } {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const create = vi.fn().mockReturnValue('blob:fake');
    const revoke = vi.fn();
    URL.createObjectURL = create as typeof URL.createObjectURL;
    URL.revokeObjectURL = revoke as typeof URL.revokeObjectURL;
    return {
      create,
      revoke,
      restore: () => {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
      },
    };
  }

  function selectFile(file: File): void {
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="image-upload"]',
    ) as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    render();
  }

  it('en lectura muestra la imagen del campo image con «Ver imagen» y «Descargar»', async () => {
    const urls = mockObjectUrls();
    try {
      await setup(withImage(), makeType(IMAGE_FIELDS));

      expect(recordsApi.getImageBlob).toHaveBeenCalledWith(123, 'lesion');

      const el = fixture.nativeElement as HTMLElement;
      const img = el.querySelector('[data-testid="image-thumb"]') as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toBe('blob:fake');
      expect(el.querySelector('[data-testid="image-empty"]')).toBeNull();

      const view = buttonByText('Ver imagen');
      expect(view).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain('Descargar');

      // La imagen vive dentro del detalle y el campo image no se pinta como texto.
      expect(el.querySelectorAll('.detail__field').length).toBe(1);
    } finally {
      urls.restore();
    }
  });

  it('el valor que la API escribe en `values` para un campo image no se pinta como texto', async () => {
    const urls = mockObjectUrls();
    try {
      // Guarda defensiva: hasta el PR #97 del backend, la API devolvía
      // `values[key] = { full, thumb }` (rutas internas del disco) cuando la
      // imagen ya estaba subida, y pintarlo daba "[object Object]". Desde #97 la
      // clave ya no viene en `values`, pero el detalle sigue sin depender de eso:
      // los campos `image` se excluyen por tipo y un objeto nunca se pinta.
      const record = makeRecord({
        images: { lesion: '/clinical-records/123/image/lesion' },
        values: {
          diagnostico: 'Lumbalgia mecánica',
          lesion: { full: 'clinical/x.webp', thumb: 'clinical/x_thumb.webp' },
        },
      });
      await setup(record, makeType(IMAGE_FIELDS));

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).not.toContain('[object Object]');
      // Solo el campo de texto se pinta como campo; la imagen va en su bloque.
      expect(el.querySelectorAll('.detail__field').length).toBe(1);
    } finally {
      urls.restore();
    }
  });

  it('«Ver imagen» abre el blob en una pestaña nueva y «Descargar» lo descarga', async () => {
    const urls = mockObjectUrls();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    try {
      await setup(withImage(), makeType(IMAGE_FIELDS));

      buttonByText('Ver imagen')!.click();
      expect(openSpy).toHaveBeenCalledWith('blob:fake', '_blank');

      // La descarga se hace con un <a download> sintético.
      const clickSpy = vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => {});
      try {
        buttonByText('Descargar')!.click();
      } finally {
        clickSpy.mockRestore();
      }

      expect(recordsApi.getImageBlob).toHaveBeenCalledTimes(1);
    } finally {
      urls.restore();
      openSpy.mockRestore();
    }
  });

  it('un campo image con `images[key] = null` muestra el estado vacío sin llamar a la API', async () => {
    await setup(makeRecord({ images: { lesion: null } }), makeType(IMAGE_FIELDS));

    const el = fixture.nativeElement as HTMLElement;
    expect(recordsApi.getImageBlob).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="image-thumb"]')).toBeNull();
    expect(el.querySelector('[data-testid="image-empty"]')?.textContent).toContain('Sin imagen');
  });

  it('un 404 al leer la imagen es «no hay imagen», no un error', async () => {
    recordsApi.getImageBlob.mockReturnValue(throwError(() => ({ status: 404 })));
    await setup(withImage(), makeType(IMAGE_FIELDS));

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="image-empty"]')?.textContent).toContain('Sin imagen');
    expect(el.querySelector('[data-testid="image-thumb"]')).toBeNull();
    expect(httpError.handle).not.toHaveBeenCalled();
  });

  it('al destruir el componente revoca los object URL creados', async () => {
    const urls = mockObjectUrls();
    try {
      await setup(withImage(), makeType(IMAGE_FIELDS));
      expect(urls.create).toHaveBeenCalledTimes(1);

      fixture.destroy();

      expect(urls.revoke).toHaveBeenCalledWith('blob:fake');
    } finally {
      urls.restore();
    }
  });

  it('en edición sube la imagen al elegir el archivo, sin pasar por «Guardar cambios»', async () => {
    const updated = withImage();
    recordsApi.uploadImage.mockReturnValue(of(updated));
    await setup(makeRecord({ images: null }), makeType(IMAGE_FIELDS));

    buttonByText('Editar ficha')!.click();
    render();

    const input = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="image-upload"]',
    ) as HTMLInputElement;
    expect(input.accept).toBe('image/jpeg,image/png,image/webp');

    selectFile(new File(['binario'], 'lesion.png', { type: 'image/png' }));

    expect(recordsApi.uploadImage).toHaveBeenCalledTimes(1);
    expect(recordsApi.uploadImage.mock.calls[0][0]).toBe(123);
    expect(recordsApi.uploadImage.mock.calls[0][1]).toBe('lesion');
    expect((recordsApi.uploadImage.mock.calls[0][2] as File).name).toBe('lesion.png');
    // La imagen no viaja en `values`: no hay PATCH del formulario.
    expect(recordsApi.updateRecord).not.toHaveBeenCalled();
  });

  it('en edición rechaza un archivo de más de 10 MB con error inline y no llama a la API', async () => {
    await setup(makeRecord({ images: null }), makeType(IMAGE_FIELDS));

    buttonByText('Editar ficha')!.click();
    render();

    const big = new File(['x'], 'grande.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 });
    selectFile(big);

    expect(recordsApi.uploadImage).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('.detail__error')?.textContent).toContain(
      '10 MB',
    );
  });

  it('un 403 al subir se muestra como aviso neutro, no como error técnico', async () => {
    recordsApi.uploadImage.mockReturnValue(throwError(() => ({ status: 403 })));
    await setup(makeRecord({ images: null }), makeType(IMAGE_FIELDS));

    buttonByText('Editar ficha')!.click();
    render();
    selectFile(new File(['binario'], 'lesion.png', { type: 'image/png' }));

    const error = (fixture.nativeElement as HTMLElement).querySelector('.detail__error');
    expect(error?.textContent).toContain('No puedes subir la imagen de esta ficha');
    expect(httpError.handle).not.toHaveBeenCalled();
  });
});
