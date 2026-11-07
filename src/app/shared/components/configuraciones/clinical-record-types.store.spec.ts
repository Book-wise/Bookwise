import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ClinicalRecordTypesStore } from '@core/stores/clinical-record-types.store';

describe('ClinicalRecordTypesStore', () => {
  let store: InstanceType<typeof ClinicalRecordTypesStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ClinicalRecordTypesStore],
    });
    store = TestBed.inject(ClinicalRecordTypesStore);
  });

  it('arranca vacío y sin selección', () => {
    expect(store.types()).toEqual([]);
    expect(store.selected()).toBeNull();
    expect(store.filteredTypes()).toEqual([]);
    expect(store.dirty()).toBe(false);
    expect(store.search()).toBe('');
  });

  it('createType agrega un tipo vacío y lo selecciona', () => {
    store.createType();

    expect(store.types().length).toBe(1);
    const type = store.types()[0];
    expect(type.name).toBe('');
    expect(type.description).toBeNull();
    expect(type.active).toBe(true);
    expect(type.fields).toEqual([]);

    expect(store.selectedId()).toBe(type.id);
    expect(store.selected()).toEqual(type);
    expect(store.draft()).toEqual(type);
    expect(store.dirty()).toBe(false);
  });

  it('select cambia la selección y carga el draft desde el tipo', () => {
    store.createType();
    store.updateDraftName('Láser');
    store.saveDraft();

    store.createType();
    store.updateDraftName('Kinesiología');
    store.saveDraft();

    const laser = store.types().find((t) => t.name === 'Láser');
    store.select(laser!.id);

    expect(store.selectedId()).toBe(laser!.id);
    expect(store.draft()?.name).toBe('Láser');
    expect(store.dirty()).toBe(false);
  });

  it('setSearch/filteredTypes filtran por nombre (case-insensitive)', () => {
    for (const name of ['Láser Tatuajes', 'Kinesiología', 'Láser Despigmentación']) {
      store.createType();
      store.updateDraftName(name);
      store.saveDraft();
    }

    expect(store.filteredTypes().length).toBe(3);

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

  it('addField agrega un campo vacío de tipo text', () => {
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
    store.createType();
    store.addField();
    store.addField();
    const [first, second] = store.draft()!.fields;

    store.removeField(first.key);

    expect(store.draft()?.fields).toEqual([
      { key: second.key, label: '', type: 'text', required: false },
    ]);
  });

  it('dirty es true tras editar y false tras saveDraft, que además commitea a la lista', () => {
    store.createType();

    expect(store.dirty()).toBe(false);

    store.updateDraftName('Láser');
    expect(store.dirty()).toBe(true);

    store.saveDraft();
    expect(store.dirty()).toBe(false);
    expect(store.types()[0].name).toBe('Láser');
    expect(store.selected()?.name).toBe('Láser');

    store.updateDraftDescription('Descripción');
    expect(store.dirty()).toBe(true);
  });

  it('discardDraft restaura el último commit', () => {
    store.createType();
    store.updateDraftName('Borrador');
    store.saveDraft();

    store.updateDraftName('Sin guardar');
    expect(store.draft()?.name).toBe('Sin guardar');
    expect(store.dirty()).toBe(true);

    store.discardDraft();
    expect(store.draft()?.name).toBe('Borrador');
    expect(store.dirty()).toBe(false);
    expect(store.types()[0].name).toBe('Borrador');
  });

  it('updateDraftName/Description/setDraftActive no tocan la lista hasta saveDraft', () => {
    store.createType();

    store.updateDraftName('Nombre');
    store.updateDraftDescription('Descripción');
    store.setDraftActive(false);

    expect(store.draft()).toEqual({
      id: store.selectedId()!,
      name: 'Nombre',
      description: 'Descripción',
      active: false,
      fields: [],
    });
    // La lista sigue con el tipo original (sin nombre, activo) hasta commitear.
    expect(store.types()[0]).toEqual({
      id: store.selectedId()!,
      name: '',
      description: null,
      active: true,
      fields: [],
    });

    store.saveDraft();
    expect(store.types()[0]).toEqual({
      id: store.selectedId()!,
      name: 'Nombre',
      description: 'Descripción',
      active: false,
      fields: [],
    });
  });
});
