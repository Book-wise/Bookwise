import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';
import { ClinicalRecordTypesApiService } from '@services/api/clinical-record-types-api.service';
import type { ClinicalRecordField, ClinicalRecordType } from '@models';

function makeType(overrides: Partial<ClinicalRecordType> = {}): ClinicalRecordType {
  return { id: 1, name: 'Ficha clínica', active: true, fields: [], ...overrides };
}

describe('ClinicalRecordTypesStore', () => {
  let store: InstanceType<typeof ClinicalRecordTypesStore>;
  let typesApi: {
    getTypes: ReturnType<typeof vi.fn>;
    createType: ReturnType<typeof vi.fn>;
    updateType: ReturnType<typeof vi.fn>;
  };

  function createStore() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClinicalRecordTypesApiService, useValue: typesApi },
      ],
    });
    store = TestBed.inject(ClinicalRecordTypesStore);
  }

  beforeEach(() => {
    typesApi = {
      getTypes: vi.fn().mockReturnValue(of([])),
      createType: vi.fn(),
      updateType: vi.fn(),
    };
  });

  describe('estado inicial', () => {
    it('arranca vacío, sin selección, sin carga y sin error', () => {
      createStore();

      expect(store.types()).toEqual([]);
      expect(store.selected()).toBeNull();
      expect(store.selectedId()).toBeNull();
      expect(store.filteredTypes()).toEqual([]);
      expect(store.dirty()).toBe(false);
      expect(store.search()).toBe('');
      expect(store.loading()).toBe(false);
      expect(store.loaded()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.saving()).toBe(false);
    });
  });

  describe('load', () => {
    it('llama a la API una sola vez y puebla `types`', () => {
      typesApi.getTypes.mockReturnValue(of([makeType({ id: 1 }), makeType({ id: 2, name: 'Láser' })]));
      createStore();

      store.load();
      store.load(); // idempotente: no re-dispara la API

      expect(typesApi.getTypes).toHaveBeenCalledTimes(1);
      expect(store.types()).toHaveLength(2);
      expect(store.types().map((t) => t.id)).toEqual([1, 2]);
      expect(store.loaded()).toBe(true);
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
    });

    it('en error guarda `error` y deja `loaded` en false', () => {
      typesApi.getTypes.mockReturnValue(throwError(() => new Error('boom')));
      createStore();

      store.load();

      expect(store.error()).toBe('boom');
      expect(store.loaded()).toBe(false);
      expect(store.loading()).toBe(false);
      expect(store.types()).toEqual([]);
    });
  });

  describe('createType', () => {
    it('agrega un tipo vacío con id local negativo y lo selecciona', () => {
      createStore();

      store.createType();

      expect(store.types().length).toBe(1);
      const type = store.types()[0];
      expect(type.id).toBeLessThan(0);
      expect(type.name).toBe('');
      expect(type.description).toBeNull();
      expect(type.active).toBe(true);
      expect(type.fields).toEqual([]);
      expect(type.sort_order).toBe(10);

      expect(store.selectedId()).toBe(type.id);
      expect(store.selected()).toEqual(type);
      expect(store.draft()).toEqual(type);
      expect(store.dirty()).toBe(false);
    });
  });

  describe('select / search', () => {
    it('select carga el draft desde el tipo seleccionado', () => {
      typesApi.getTypes.mockReturnValue(of([
        makeType({ id: 5, name: 'Láser' }),
        makeType({ id: 6, name: 'Kinesiología' }),
      ]));
      createStore();
      store.load();

      store.select(6);

      expect(store.selectedId()).toBe(6);
      expect(store.draft()?.name).toBe('Kinesiología');
      expect(store.dirty()).toBe(false);
    });

    it('filteredTypes filtra por nombre (case-insensitive) respetando el orden', () => {
      typesApi.getTypes.mockReturnValue(of([
        makeType({ id: 1, name: 'Láser Tatuajes' }),
        makeType({ id: 2, name: 'Kinesiología' }),
        makeType({ id: 3, name: 'Láser Despigmentación' }),
      ]));
      createStore();
      store.load();

      store.setSearch('láser');
      expect(store.filteredTypes().map((t) => t.name)).toEqual([
        'Láser Tatuajes',
        'Láser Despigmentación',
      ]);

      store.setSearch('  KINE  ');
      expect(store.filteredTypes().map((t) => t.name)).toEqual(['Kinesiología']);

      store.setSearch('');
      expect(store.filteredTypes().length).toBe(3);
    });
  });

  describe('campos', () => {
    it('addField agrega un campo vacío de tipo text', () => {
      createStore();
      store.createType();

      store.addField();

      expect(store.draft()?.fields.length).toBe(1);
      const field = store.draft()!.fields[0];
      expect(field.key).toMatch(/^field_\d+$/);
      expect(field.label).toBe('');
      expect(field.type).toBe('text');
      expect(field.required).toBe(false);
      expect(store.dirty()).toBe(true);
    });

    it('updateFieldLabel/Type/Required mutan solo el campo del índice', () => {
      createStore();
      store.createType();
      store.addField();
      store.addField();
      const [first, second] = store.draft()!.fields;

      store.updateFieldLabel(0, 'Peso');
      store.updateFieldType(0, 'number');
      store.updateFieldRequired(0, true);
      store.updateFieldLabel(1, 'Nota');

      const fields = store.draft()!.fields;
      expect(fields[0]).toEqual({
        key: first.key,
        label: 'Peso',
        type: 'number',
        required: true,
      });
      expect(fields[1]).toEqual({
        key: second.key,
        label: 'Nota',
        type: 'text',
        required: false,
      });
    });

    it('removeField quita solo el campo del índice', () => {
      createStore();
      store.createType();
      store.addField();
      store.addField();
      const [first, second] = store.draft()!.fields;

      store.removeField(0);

      expect(store.draft()?.fields).toEqual([
        { key: second.key, label: '', type: 'text', required: false },
      ]);
      expect(store.draft()?.fields[0].key).toBe(second.key);
      expect(store.draft()?.fields[0].key).not.toBe(first.key);
    });

    it('addField genera una clave que no colisiona con las que ya trae el tipo', () => {
      typesApi.getTypes.mockReturnValue(of([
        makeType({
          id: 5,
          fields: [
            { key: 'field_1', label: 'Fecha', type: 'date', required: false },
            { key: 'field_2', label: 'Peso', type: 'number', required: false },
          ],
        }),
      ]));
      createStore();
      store.load();
      store.select(5);

      store.addField();

      const keys = store.draft()!.fields.map((f) => f.key);
      expect(keys).toEqual(['field_1', 'field_2', 'field_3']);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('con dos campos de la misma clave (tipo cargado de la API) editar un índice no toca el otro', () => {
      typesApi.getTypes.mockReturnValue(of([
        makeType({
          id: 5,
          fields: [
            { key: 'field_1', label: 'Fecha', type: 'date', required: false },
            { key: 'field_1', label: 'Nota', type: 'text', required: false },
          ],
        }),
      ]));
      createStore();
      store.load();
      store.select(5);

      store.updateFieldLabel(0, 'Fecha de hoy');
      store.updateFieldType(0, 'number');
      store.updateFieldRequired(0, true);

      const fields = store.draft()!.fields;
      expect(fields[0]).toEqual({
        key: 'field_1',
        label: 'Fecha de hoy',
        type: 'number',
        required: true,
      });
      expect(fields[1]).toEqual({
        key: 'field_1',
        label: 'Nota',
        type: 'text',
        required: false,
      });
    });

    it('con dos campos de la misma clave borrar un índice borra solo esa fila', () => {
      typesApi.getTypes.mockReturnValue(of([
        makeType({
          id: 5,
          fields: [
            { key: 'field_1', label: 'Fecha', type: 'date', required: false },
            { key: 'field_1', label: 'Nota', type: 'text', required: false },
          ],
        }),
      ]));
      createStore();
      store.load();
      store.select(5);

      store.removeField(0);

      expect(store.draft()!.fields).toEqual([
        { key: 'field_1', label: 'Nota', type: 'text', required: false },
      ]);
    });
  });

  describe('opciones de un campo select (F11)', () => {
    /** Crea un tipo nuevo con un único campo (`índice 0`) ya cambiado a `select`. */
    function selectField(): void {
      createStore();
      store.createType();
      store.addField();
      store.updateFieldType(0, 'select');
    }

    function options(index = 0): string[] | null | undefined {
      return store.draft()!.fields[index].options;
    }

    it('addFieldOption agrega en el orden en que se ingresan y recorta el valor', () => {
      selectField();

      store.addFieldOption(0, '  Lumbar  ');
      store.addFieldOption(0, 'Cervical');
      store.addFieldOption(0, 'Hombro');

      expect(options()).toEqual(['Lumbar', 'Cervical', 'Hombro']);
      expect(store.dirty()).toBe(true);
    });

    it('addFieldOption ignora duplicados sin distinguir mayúsculas y espacios', () => {
      selectField();
      store.addFieldOption(0, 'Lumbar');

      store.addFieldOption(0, 'lumbar');
      store.addFieldOption(0, '  LUMBAR ');

      expect(options()).toEqual(['Lumbar']);
    });

    it('addFieldOption ignora opciones vacías o de solo espacios', () => {
      selectField();

      store.addFieldOption(0, '');
      store.addFieldOption(0, '   ');

      expect(options() ?? []).toEqual([]);
    });

    it('addFieldOption no toca un campo que no es select', () => {
      createStore();
      store.createType();
      store.addField();

      expect(store.addFieldOption(0, 'Lumbar')).toBe(false);
      expect(store.draft()!.fields[0].options).toBeUndefined();
    });

    it('removeFieldOption quita la opción del índice indicado', () => {
      selectField();
      store.addFieldOption(0, 'Lumbar');
      store.addFieldOption(0, 'Cervical');
      store.addFieldOption(0, 'Hombro');

      store.removeFieldOption(0, 1);

      expect(options()).toEqual(['Lumbar', 'Hombro']);
    });

    it('removeFieldOption con un índice fuera de rango no cambia el campo', () => {
      selectField();
      store.addFieldOption(0, 'Lumbar');

      store.removeFieldOption(0, 5);

      expect(options()).toEqual(['Lumbar']);
    });

    it('cambiar el tipo de select a otro limpia las opciones', () => {
      selectField();
      store.addFieldOption(0, 'Lumbar');

      store.updateFieldType(0, 'text');

      const field = store.draft()!.fields[0];
      expect(field.type).toBe('text');
      expect(field.options).toBeUndefined();
    });

    it('saveDraft manda las opciones ordenadas del select y ninguna para los demás tipos', () => {
      typesApi.createType.mockReturnValue(of(makeType({ id: 100, name: 'Láser' })));
      createStore();
      store.createType();
      store.addField();
      store.addField();
      const [selectKey, textKey] = store.draft()!.fields.map((f) => f.key);
      store.updateFieldType(0, 'select');
      store.addFieldOption(0, 'Cervical');
      store.addFieldOption(0, 'Lumbar');

      store.saveDraft().subscribe();

      const fields = typesApi.createType.mock.calls[0][0].fields as ClinicalRecordField[];
      expect(fields.find((f) => f.key === selectKey)).toEqual({
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

  describe('validación de opciones (un select sin opciones no se guarda)', () => {
    it('un select sin opciones marca el draft como no guardable', () => {
      createStore();
      store.createType();
      store.addField();
      store.updateFieldType(0, 'select');

      expect(store.invalidOptionIndexes()).toEqual([0]);
      expect(store.canSave()).toBe(false);
    });

    it('con al menos una opción el draft vuelve a ser guardable', () => {
      createStore();
      store.createType();
      store.addField();
      store.updateFieldType(0, 'select');
      store.addFieldOption(0, 'Lumbar');

      expect(store.invalidOptionIndexes()).toEqual([]);
      expect(store.canSave()).toBe(true);
    });

    it('borrar el último chip vuelve a invalidar el draft', () => {
      createStore();
      store.createType();
      store.addField();
      store.updateFieldType(0, 'select');
      store.addFieldOption(0, 'Lumbar');

      store.removeFieldOption(0, 0);

      expect(store.invalidOptionIndexes()).toEqual([0]);
      expect(store.canSave()).toBe(false);
    });

    it('un tipo sin campos select es guardable', () => {
      createStore();
      store.createType();
      store.addField();
      store.updateFieldType(0, 'text');

      expect(store.invalidOptionIndexes()).toEqual([]);
      expect(store.canSave()).toBe(true);
    });

    it('saveDraft no llama a la API si un select quedó sin opciones', () => {
      createStore();
      store.createType();
      store.addField();
      store.updateFieldType(0, 'select');
      store.updateDraftName('Preparación física');

      store.saveDraft().subscribe();

      expect(typesApi.createType).not.toHaveBeenCalled();
      expect(typesApi.updateType).not.toHaveBeenCalled();
      expect(store.saving()).toBe(false);
      expect(store.dirty()).toBe(true);
    });
  });

  describe('saveDraft', () => {
    it('no manda opciones viejas de un campo que ya no es select (deuda de F10)', () => {
      typesApi.getTypes.mockReturnValue(
        of([
          makeType({
            id: 5,
            fields: [
              { key: 'field_1', label: 'Nota', type: 'text', required: false, options: ['vieja'] },
            ],
          }),
        ]),
      );
      typesApi.updateType.mockReturnValue(of(makeType({ id: 5 })));
      createStore();
      store.load();
      store.select(5);
      store.updateDraftName('Preparación física');

      store.saveDraft().subscribe();

      const fields = typesApi.updateType.mock.calls[0][1].fields as ClinicalRecordField[];
      expect(fields[0]).toEqual({ key: 'field_1', label: 'Nota', type: 'text', required: false });
      expect('options' in fields[0]).toBe(false);
    });

    it('tipo nuevo hace POST y adopta el id del servidor', () => {
      const serverType = makeType({ id: 100, name: 'Láser' });
      typesApi.createType.mockReturnValue(of(serverType));
      createStore();
      store.createType();
      store.updateDraftName('Láser');

      store.saveDraft().subscribe();

      expect(typesApi.createType).toHaveBeenCalledTimes(1);
      expect(typesApi.createType).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Láser', active: true, sort_order: 10, fields: [] }),
      );
      expect(typesApi.updateType).not.toHaveBeenCalled();

      expect(store.types()).toHaveLength(1);
      expect(store.types()[0].id).toBe(100);
      expect(store.selectedId()).toBe(100);
      expect(store.draft()?.id).toBe(100);
      expect(store.dirty()).toBe(false);
      expect(store.saving()).toBe(false);
    });

    it('un draft sin id numérico hace POST, nunca PATCH a .../undefined', () => {
      // El catálogo llegó sin `id` (shape inesperado): antes `undefined < 0` daba
      // false y se armaba PATCH /clinical-record-types/undefined (500 en la API).
      typesApi.getTypes.mockReturnValue(
        of([makeType({ id: undefined as unknown as number, name: 'Sin id' })]),
      );
      typesApi.createType.mockReturnValue(of(makeType({ id: 200, name: 'Sin id' })));
      createStore();
      store.load();
      store.select(undefined as unknown as number);
      store.updateDraftName('Sin id');

      store.saveDraft().subscribe();

      expect(typesApi.updateType).not.toHaveBeenCalled();
      expect(typesApi.createType).toHaveBeenCalledTimes(1);
    });

    it('tipo existente hace PATCH con su id', () => {
      typesApi.getTypes.mockReturnValue(of([makeType({ id: 5, name: 'Kinesiología' })]));
      typesApi.updateType.mockReturnValue(of(makeType({ id: 5, name: 'Kinesiología v2' })));
      createStore();
      store.load();
      store.select(5);
      store.updateDraftName('Kinesiología v2');

      store.saveDraft().subscribe();

      expect(typesApi.updateType).toHaveBeenCalledTimes(1);
      expect(typesApi.updateType).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ name: 'Kinesiología v2' }),
      );
      expect(typesApi.createType).not.toHaveBeenCalled();

      expect(store.types()).toHaveLength(1);
      expect(store.types()[0].name).toBe('Kinesiología v2');
      expect(store.selectedId()).toBe(5);
      expect(store.dirty()).toBe(false);
      expect(store.saving()).toBe(false);
    });

    it('sin draft no llama a la API', () => {
      createStore();

      store.saveDraft().subscribe();

      expect(typesApi.createType).not.toHaveBeenCalled();
      expect(typesApi.updateType).not.toHaveBeenCalled();
    });
  });

  describe('discardDraft', () => {
    it('restaura el último commit', () => {
      typesApi.getTypes.mockReturnValue(of([makeType({ id: 5, name: 'Borrador' })]));
      createStore();
      store.load();
      store.select(5);

      store.updateDraftName('Sin guardar');
      expect(store.draft()?.name).toBe('Sin guardar');
      expect(store.dirty()).toBe(true);

      store.discardDraft();
      expect(store.draft()?.name).toBe('Borrador');
      expect(store.dirty()).toBe(false);
      expect(store.types()[0].name).toBe('Borrador');
    });
  });
});
