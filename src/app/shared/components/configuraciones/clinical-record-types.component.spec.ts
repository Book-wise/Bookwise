import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { ClinicalRecordTypesComponent } from './clinical-record-types.component';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';
import { ClinicalRecordTypesApiService } from '@services/api/clinical-record-types-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import type { ClinicalRecordField, ClinicalRecordType } from '@models';

/** Copy de las claves nuevas de F11 (el resto de claves se devuelven crudas). */
const F11_COPY: Record<string, string> = {
  'settings.clinical_types.fields.options.count': '{{count}} opciones',
  'settings.clinical_types.fields.options.required':
    'Agrega al menos una opción para poder guardar.',
};

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
        { provide: LanguageService, useValue: { t: (key: string, params?: Record<string, string>) => {
          const raw = F11_COPY[key] ?? key;
          return params
            ? raw.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => params[name] ?? '')
            : raw;
        } } },
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

  describe('campo image (F10)', () => {
    it('el desplegable de tipo de campo ofrece `image`', async () => {
      await setup();

      const values = component.fieldTypeOptions().map((option) => option.value);
      expect(values).toEqual(['text', 'longtext', 'number', 'select', 'date', 'image']);
      expect(component.fieldTypeOptions()).toContainEqual({
        label: 'settings.clinical_types.field.type.image',
        value: 'image',
      });
    });

    it('un campo image no ofrece «Obligatorio»: lo muestra como no aplicable', async () => {
      await setup();
      createType();

      (fixture.nativeElement.querySelector('.ct-add') as HTMLButtonElement).click();
      render();
      await fixture.whenStable();

      component.onFieldType(0, 'image');
      render();
      await fixture.whenStable();

      const row = fixture.nativeElement.querySelector('.ct-frow') as HTMLElement;
      expect(row.querySelector('.ct-frow__req')?.textContent).toContain(
        'settings.clinical_types.required.not_applicable',
      );
      expect(row.querySelector('.ct-frow__req')?.textContent).not.toMatch(/required\.(yes|no)\b/);
      expect(row.querySelector('p-toggleswitch')).toBeNull();
    });
  });

  describe('opciones del campo select (F11)', () => {
    const OPT = {
      label: 'settings.clinical_types.fields.options.label',
      placeholder: 'settings.clinical_types.fields.options.placeholder',
      add: 'settings.clinical_types.fields.options.add',
      remove: 'settings.clinical_types.fields.options.remove',
      count: 'settings.clinical_types.fields.options.count',
      required: 'settings.clinical_types.fields.options.required',
    };

    /** Agrega una fila al constructor y devuelve el campo recién creado. */
    function addFieldRow(): ClinicalRecordField {
      (fixture.nativeElement.querySelector('.ct-add') as HTMLButtonElement).click();
      render();
      return store.draft()!.fields[store.draft()!.fields.length - 1];
    }

    /** Crea un tipo con un único campo de tipo `select`. */
    function selectField(): ClinicalRecordField {
      createType();
      addFieldRow();
      component.onFieldType(0, 'select');
      render();
      return store.draft()!.fields[0];
    }

    function optionsBlock(): HTMLElement | null {
      return (fixture.nativeElement as HTMLElement).querySelector('.ct-fopts');
    }

    function optionInput(): HTMLInputElement {
      return (fixture.nativeElement as HTMLElement).querySelector(
        '.ct-fopts input',
      ) as HTMLInputElement;
    }

    function chips(): HTMLElement[] {
      return Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.ct-chip'),
      );
    }

    function chipTexts(): string[] {
      return chips().map((chip) => (chip.querySelector('.ct-chip__label')?.textContent ?? '').trim());
    }

    function counter(): HTMLElement {
      return (fixture.nativeElement as HTMLElement).querySelector('.ct-fopts__count') as HTMLElement;
    }

    function typeInto(value: string): void {
      const input = optionInput();
      input.value = value;
      input.dispatchEvent(new Event('input'));
      render();
    }

    function press(key: string): void {
      optionInput().dispatchEvent(new KeyboardEvent('keydown', { key }));
      render();
    }

    function currentOptions(): string[] | null | undefined {
      return store.draft()!.fields[0].options;
    }

    it('muestra el bloque de opciones solo cuando el tipo del campo es select', async () => {
      await setup();
      createType();
      const field = addFieldRow();

      expect(optionsBlock()).toBeNull();

      component.onFieldType(0, 'select');
      render();

      expect(optionsBlock()).toBeTruthy();
      expect(optionInput().getAttribute('aria-label')).toBe(OPT.placeholder);
      expect(counter().textContent).toContain('0 opciones');

      component.onFieldType(0, 'image');
      render();

      expect(optionsBlock()).toBeNull();
    });

    it('Enter agrega la opción escrita como chip y limpia el input', async () => {
      await setup();
      selectField();

      typeInto('Lumbar');
      press('Enter');
      typeInto('Cervical');
      press('Enter');

      expect(currentOptions()).toEqual(['Lumbar', 'Cervical']);
      expect(chipTexts()).toEqual(['Lumbar', 'Cervical']);
      expect(optionInput().value).toBe('');
    });

    it('el botón «Agregar» agrega igual que Enter', async () => {
      await setup();
      selectField();

      typeInto('Hombro');
      buttonByLabel(OPT.add)!.click();
      render();

      expect(currentOptions()).toEqual(['Hombro']);
      expect(chipTexts()).toEqual(['Hombro']);
      expect(optionInput().value).toBe('');
    });

    it('no agrega una opción duplicada al agregarla de nuevo', async () => {
      await setup();
      selectField();

      typeInto('Lumbar');
      press('Enter');
      typeInto(' lumbar ');
      press('Enter');

      expect(currentOptions()).toEqual(['Lumbar']);
      expect(chipTexts()).toEqual(['Lumbar']);
    });

    it('el ✕ de cada chip quita esa opción', async () => {
      await setup();
      selectField();
      typeInto('Lumbar');
      press('Enter');
      typeInto('Cervical');
      press('Enter');

      const remove = chips()[0].querySelector('button')!;
      expect(remove.getAttribute('aria-label')).toBe(OPT.remove);
      remove.click();
      render();

      expect(currentOptions()).toEqual(['Cervical']);
      expect(chipTexts()).toEqual(['Cervical']);
    });

    it('Backspace en el input vacío quita la última opción; con texto no quita nada', async () => {
      await setup();
      selectField();
      typeInto('Lumbar');
      press('Enter');
      typeInto('Cervical');
      press('Enter');

      typeInto('Rod');
      press('Backspace');
      expect(currentOptions()).toEqual(['Lumbar', 'Cervical']);

      typeInto('');
      press('Backspace');

      expect(currentOptions()).toEqual(['Lumbar']);
      expect(chipTexts()).toEqual(['Lumbar']);
    });

    it('el contador refleja la cantidad de opciones y se anuncia con aria-live', async () => {
      await setup();
      selectField();

      expect(counter().getAttribute('aria-live')).toBe('polite');
      expect(counter().textContent).toContain('0 opciones');

      typeInto('Lumbar');
      press('Enter');
      typeInto('Cervical');
      press('Enter');

      expect(counter().textContent).toContain('2 opciones');
    });

    it('un select sin opciones avisa en la fila y bloquea «Guardar cambios»', async () => {
      await setup();
      createType();

      const name = nameInput();
      name.value = 'Preparación física';
      name.dispatchEvent(new Event('input'));
      render();
      addFieldRow();
      component.onFieldType(0, 'select');
      render();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.ct-fopts__error')?.textContent).toContain(
        F11_COPY[OPT.required],
      );
      expect(counter().classList).toContain('is-invalid');
      expect(counter().textContent).toContain('0 opciones');
      expect(optionInput().getAttribute('aria-invalid')).toBe('true');
      expect(optionInput().getAttribute('aria-describedby')).toBe('ct-opt-error-0');
      expect(store.canSave()).toBe(false);
      expect(buttonByLabel(K.save)!.disabled).toBe(true);

      buttonByLabel(K.save)!.click();
      render();
      expect(typesApi.createType).not.toHaveBeenCalled();
    });

    it('agregar una opción quita el aviso y habilita «Guardar cambios»', async () => {
      await setup();
      createType();

      const name = nameInput();
      name.value = 'Preparación física';
      name.dispatchEvent(new Event('input'));
      render();
      addFieldRow();
      component.onFieldType(0, 'select');
      render();
      expect(buttonByLabel(K.save)!.disabled).toBe(true);

      typeInto('Lumbar');
      press('Enter');

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.ct-fopts__error')).toBeNull();
      expect(counter().classList).not.toContain('is-invalid');
      expect(counter().textContent).toContain('1 opciones');
      expect(optionInput().getAttribute('aria-invalid')).not.toBe('true');
      expect(optionInput().getAttribute('aria-describedby')).toBeNull();
      expect(buttonByLabel(K.save)!.disabled).toBe(false);
    });

    it('«Guardar cambios» manda las opciones ordenadas del select y ninguna para otros tipos', async () => {
      typesApi.createType.mockReturnValue(of(makeType({ id: 100, name: 'Láser' })));
      await setup();
      createType();

      const name = nameInput();
      name.value = 'Láser';
      name.dispatchEvent(new Event('input'));
      render();

      const selectKey = addFieldRow().key;
      component.onFieldType(0, 'select');
      render();
      typeInto('Cervical');
      press('Enter');
      typeInto('Lumbar');
      press('Enter');

      const textKey = addFieldRow().key;

      buttonByLabel(K.save)!.click();
      render();

      expect(typesApi.createType).toHaveBeenCalledTimes(1);
      const fields = typesApi.createType.mock.calls[0][0].fields as ClinicalRecordField[];
      expect(fields[0]).toEqual({
        key: selectKey,
        label: '',
        type: 'select',
        required: false,
        options: ['Cervical', 'Lumbar'],
      });
      const text = fields.find((f) => f.key === textKey)!;
      expect(text).toEqual({ key: textKey, label: '', type: 'text', required: false });
      expect('options' in text).toBe(false);
    });
  });

  describe('campos con la misma clave (bug: se editaban dos filas a la vez)', () => {
    /** Selecciona un tipo cargado de la API cuyos dos campos comparten `field_1`. */
    async function selectTypeWithDuplicateKeys(): Promise<void> {
      typesApi.getTypes.mockReturnValue(
        of([
          makeType({
            id: 5,
            name: 'Preparación física',
            fields: [
              { key: 'field_1', label: 'Fecha', type: 'date', required: false },
              { key: 'field_1', label: 'Nota', type: 'text', required: false },
            ],
          }),
        ]),
      );
      await setup();
      (fixture.nativeElement.querySelector('.ct-item') as HTMLButtonElement).click();
      render();
    }

    function labelInputs(): HTMLInputElement[] {
      return Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
          '.ct-frow > input',
        ),
      );
    }

    it('tipear en el primer campo no cambia el segundo', async () => {
      await selectTypeWithDuplicateKeys();

      const inputs = labelInputs();
      expect(inputs.length).toBe(2);
      expect(inputs.map((input) => input.value)).toEqual(['Fecha', 'Nota']);

      inputs[0].value = 'Fecha de hoy';
      inputs[0].dispatchEvent(new Event('input'));
      render();

      const fields = store.draft()!.fields;
      expect(fields[0].label).toBe('Fecha de hoy');
      expect(fields[1].label).toBe('Nota');
      expect(labelInputs()[1].value).toBe('Nota');
    });

    it('«Agregar campo» no repite una clave que ya existe', async () => {
      await selectTypeWithDuplicateKeys();

      (fixture.nativeElement.querySelector('.ct-add') as HTMLButtonElement).click();
      render();

      expect(store.draft()!.fields.map((f) => f.key)).toEqual(['field_1', 'field_1', 'field_2']);
    });
  });
});
