import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { ClinicalRecordTypesComponent } from './clinical-record-types.component';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';
import { ClinicalRecordTypesApiService } from '@services/api/clinical-record-types-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import type { ClinicalRecordType } from '@models';

const K = {
  empty: 'settings.clinical_types.list.empty',
  new: 'settings.clinical_types.new',
  saved: 'settings.clinical_types.saved',
  unsaved: 'settings.clinical_types.unsaved',
  save: 'settings.clinical_types.save',
  discard: 'settings.clinical_types.discard',
  loading: 'settings.clinical_types.loading',
  load_error: 'settings.clinical_types.load_error',
  retry: 'settings.clinical_types.retry',
};

function makeType(overrides: Partial<ClinicalRecordType> = {}): ClinicalRecordType {
  return { id: 1, name: 'Ficha clínica', active: true, fields: [], ...overrides };
}

describe('ClinicalRecordTypesComponent', () => {
  let fixture: ComponentFixture<ClinicalRecordTypesComponent>;
  let component: ClinicalRecordTypesComponent;
  let store: InstanceType<typeof ClinicalRecordTypesStore>;
  let typesApi: {
    getTypes: ReturnType<typeof vi.fn>;
    createType: ReturnType<typeof vi.fn>;
    updateType: ReturnType<typeof vi.fn>;
  };
  let httpError: { handle: ReturnType<typeof vi.fn> };

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ClinicalRecordTypesComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClinicalRecordTypesApiService, useValue: typesApi },
        { provide: HttpErrorService, useValue: httpError },
        { provide: LanguageService, useValue: { t: (k: string) => k } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClinicalRecordTypesComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(ClinicalRecordTypesStore);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function render(): void {
    fixture.detectChanges();
  }

  function buttonByLabel(label: string): HTMLButtonElement | null {
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    );
    return buttons.find((b) => (b.textContent ?? '').includes(label)) ?? null;
  }

  function nameInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('.ct-editor__name') as HTMLInputElement;
  }

  function createType(): void {
    const btn = fixture.nativeElement.querySelector('.ct-new') as HTMLButtonElement;
    btn.click();
    render();
  }

  beforeEach(() => {
    typesApi = {
      getTypes: vi.fn().mockReturnValue(of([])),
      createType: vi.fn(),
      updateType: vi.fn(),
    };
    httpError = { handle: vi.fn() };
  });

  it('dispara la carga inicial al montarse', async () => {
    await setup();

    expect(typesApi.getTypes).toHaveBeenCalledTimes(1);
  });

  it('muestra el estado vacío y el botón de crear', async () => {
    await setup();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(K.empty);
    expect(el.querySelector('.ct-list__empty')).toBeTruthy();
    expect(el.querySelector('.ct-new')).toBeTruthy();
    expect(buttonByLabel(K.new)).toBeTruthy();
  });

  it('al crear un tipo muestra el editor con nombre vacío y sin cambios pendientes', async () => {
    await setup();
    createType();

    expect(nameInput()).toBeTruthy();
    expect(nameInput().value).toBe('');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(K.saved);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(K.unsaved);

    const save = buttonByLabel(K.save)!;
    const discard = buttonByLabel(K.discard)!;
    expect(save.disabled).toBe(true);
    expect(discard.disabled).toBe(true);
  });

  it('tipear el nombre activa «Cambios sin guardar» y habilita Guardar', async () => {
    await setup();
    createType();

    const input = nameInput();
    input.value = 'Láser';
    input.dispatchEvent(new Event('input'));
    render();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(K.unsaved);
    expect(el.textContent).not.toContain(K.saved);
    expect(buttonByLabel(K.save)!.disabled).toBe(false);
    expect(buttonByLabel(K.discard)!.disabled).toBe(false);
  });

  it('«Agregar campo» suma una fila al constructor', async () => {
    await setup();
    createType();

    const add = fixture.nativeElement.querySelector('.ct-add') as HTMLButtonElement;
    add.click();
    render();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.ct-frow').length).toBe(1);
    expect(store.draft()?.fields.length).toBe(1);
  });

  it('«Guardar cambios» hace POST y limpia el estado dirty', async () => {
    typesApi.createType.mockReturnValue(of(makeType({ id: 100, name: 'Láser' })));
    await setup();
    createType();

    const input = nameInput();
    input.value = 'Láser';
    input.dispatchEvent(new Event('input'));
    render();

    buttonByLabel(K.save)!.click();
    render();

    expect(typesApi.createType).toHaveBeenCalledTimes(1);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(K.saved);
    expect(el.textContent).not.toContain(K.unsaved);
    expect(buttonByLabel(K.save)!.disabled).toBe(true);
    expect(buttonByLabel(K.discard)!.disabled).toBe(true);
    expect(store.types()[0].name).toBe('Láser');
    expect(store.types()[0].id).toBe(100);
  });

  it('un error al guardar se reporta vía HttpErrorService', async () => {
    typesApi.createType.mockReturnValue(throwError(() => new Error('boom')));
    await setup();
    createType();

    const input = nameInput();
    input.value = 'Láser';
    input.dispatchEvent(new Event('input'));
    render();

    buttonByLabel(K.save)!.click();
    render();

    expect(httpError.handle).toHaveBeenCalledTimes(1);
    expect(httpError.handle).toHaveBeenCalledWith(expect.any(Error), K.save);
  });

  it('«Descartar» revierte los cambios no guardados', async () => {
    await setup();
    createType();

    const input = nameInput();
    input.value = 'Borrador';
    input.dispatchEvent(new Event('input'));
    render();

    buttonByLabel(K.discard)!.click();
    render();

    expect(nameInput().value).toBe('');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(K.saved);
    expect(store.types()[0].name).toBe('');
  });

  it('muestra el estado de carga mientras la lista está en vuelo', async () => {
    const subject = new Subject<ClinicalRecordType[]>();
    typesApi.getTypes.mockReturnValue(subject);
    await setup();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="ct-loading"]')).toBeTruthy();
    expect(el.textContent).toContain(K.loading);

    subject.next([makeType({ id: 1, name: 'Láser' })]);
    subject.complete();
    render();
    await fixture.whenStable();

    expect(el.querySelector('[data-testid="ct-loading"]')).toBeNull();
    expect(el.textContent).toContain('Láser');
  });

  it('muestra el error de carga con un botón Reintentar que vuelve a pedir', async () => {
    typesApi.getTypes.mockReturnValue(throwError(() => new Error('boom')));
    await setup();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="ct-error"]')).toBeTruthy();
    expect(el.textContent).toContain(K.load_error);
    expect(el.textContent).toContain('boom');
    expect(typesApi.getTypes).toHaveBeenCalledTimes(1);

    typesApi.getTypes.mockReturnValue(of([makeType({ id: 1, name: 'Láser' })]));
    // p-button renderiza un <button> real; lo disparamos a través del DOM.
    (el.querySelector('[data-testid="ct-error"] button') as HTMLButtonElement)?.click();
    render();
    await fixture.whenStable();

    expect(typesApi.getTypes).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[data-testid="ct-error"]')).toBeNull();
    expect(el.textContent).toContain('Láser');
  });
});
