import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';
import { ClinicalRecordTypesApiService } from '@services/api/clinical-record-types-api.service';
import type { ClinicalRecordType } from '@models';

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

    it('updateFieldLabel/Type/Required mutan el campo correcto por key', () => {
      createStore();
      store.createType();
      store.addField();
      store.addField();
      const [first, second] = store.draft()!.fields;

      store.updateFieldLabel(first.key, 'Peso');
      store.updateFieldType(first.key, 'number');
      store.updateFieldRequired(first.key, true);
      store.updateFieldLabel(second.key, 'Nota');

      const fields = store.draft()!.fields;
      expect(fields.find((f) => f.key === first.key)).toEqual({
        key: first.key,
        label: 'Peso',
        type: 'number',
        required: true,
      });
      expect(fields.find((f) => f.key === second.key)).toEqual({
        key: second.key,
        label: 'Nota',
        type: 'text',
        required: false,
      });
    });

    it('removeField quita solo el campo indicado', () => {
      createStore();
      store.createType();
      store.addField();
      store.addField();
      const [first, second] = store.draft()!.fields;

      store.removeField(first.key);

      expect(store.draft()?.fields).toEqual([
        { key: second.key, label: '', type: 'text', required: false },
      ]);
    });
  });

  describe('saveDraft', () => {
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
