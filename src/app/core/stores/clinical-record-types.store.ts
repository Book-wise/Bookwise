import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import type {
  ClinicalRecordField,
  ClinicalRecordFieldType,
  ClinicalRecordType,
} from '@models';

/**
 * Store de dominio del catálogo de tipos de ficha (pestaña «Fichas médicas» de
 * Configuraciones y selector «Agregar tipo de ficha» de la reserva).
 *
 * El backend **aún no** expone `clinical_record_types` (contrato F4 en
 * `odd/tasks/ficha-medica.md`), así que este store edita una colección en
 * memoria que arranca **vacía**: el usuario crea tipos y campos en vivo, pero
 * nada se persiste entre visitas. Cuando el endpoint exista, `load()` cargará
 * la lista y `saveDraft()`/`removeField()` delegarán al API; la forma de los
 * datos ya respeta el contrato (`fields` con `key`, `label`, `type`,
 * `required`, `options`).
 */

interface ClinicalRecordTypesState {
  types: ClinicalRecordType[];
  selectedId: number | null;
  search: string;
  /** Copia de trabajo del tipo seleccionado (edición en vivo). */
  draft: ClinicalRecordType | null;
}

const initialState: ClinicalRecordTypesState = {
  types: [],
  selectedId: null,
  search: '',
  draft: null,
};

/** Ids/keys locales hasta que el backend los genere. */
let nextTypeId = 1;
let nextFieldKey = 1;

function cloneType(type: ClinicalRecordType): ClinicalRecordType {
  return JSON.parse(JSON.stringify(type)) as ClinicalRecordType;
}

function makeFieldKey(): string {
  return `field_${nextFieldKey++}`;
}

function isDirty(a: ClinicalRecordType | null, b: ClinicalRecordType | null): boolean {
  if (!a || !b) return false;
  return JSON.stringify(a) !== JSON.stringify(b);
}

export const ClinicalRecordTypesStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => ({
    selected: computed<ClinicalRecordType | null>(() => {
      const id = store.selectedId();
      return store.types().find((t) => t.id === id) ?? null;
    }),
    filteredTypes: computed<ClinicalRecordType[]>(() => {
      const q = store.search().trim().toLowerCase();
      if (!q) return store.types();
      return store.types().filter((t) => t.name.toLowerCase().includes(q));
    }),
    dirty: computed<boolean>(() => {
      const id = store.selectedId();
      const selected = store.types().find((t) => t.id === id) ?? null;
      return isDirty(store.draft(), selected);
    }),
  })),

  withMethods((store) => ({
    select(id: number): void {
      const type = store.types().find((t) => t.id === id) ?? null;
      patchState(store, { selectedId: id, draft: type ? cloneType(type) : null });
    },

    setSearch(search: string): void {
      patchState(store, { search });
    },

    createType(): void {
      const id = nextTypeId++;
      const type: ClinicalRecordType = {
        id,
        name: '',
        description: null,
        active: true,
        fields: [],
      };
      patchState(store, (state) => ({
        types: [...state.types, type],
        selectedId: id,
        draft: cloneType(type),
      }));
    },

    updateDraftName(name: string): void {
      patchState(store, (state) =>
        state.draft ? { draft: { ...state.draft, name } } : {},
      );
    },

    updateDraftDescription(description: string): void {
      patchState(store, (state) =>
        state.draft ? { draft: { ...state.draft, description } } : {},
      );
    },

    setDraftActive(active: boolean): void {
      patchState(store, (state) =>
        state.draft ? { draft: { ...state.draft, active } } : {},
      );
    },

    addField(): void {
      patchState(store, (state) => {
        if (!state.draft) return {};
        const field: ClinicalRecordField = {
          key: makeFieldKey(),
          label: '',
          type: 'text',
          required: false,
        };
        return { draft: { ...state.draft, fields: [...state.draft.fields, field] } };
      });
    },

    updateFieldLabel(key: string, label: string): void {
      patchState(store, (state) => {
        if (!state.draft) return {};
        return {
          draft: {
            ...state.draft,
            fields: state.draft.fields.map((f) => (f.key === key ? { ...f, label } : f)),
          },
        };
      });
    },

    updateFieldType(key: string, type: ClinicalRecordFieldType): void {
      patchState(store, (state) => {
        if (!state.draft) return {};
        return {
          draft: {
            ...state.draft,
            fields: state.draft.fields.map((f) => (f.key === key ? { ...f, type } : f)),
          },
        };
      });
    },

    updateFieldRequired(key: string, required: boolean): void {
      patchState(store, (state) => {
        if (!state.draft) return {};
        return {
          draft: {
            ...state.draft,
            fields: state.draft.fields.map((f) => (f.key === key ? { ...f, required } : f)),
          },
        };
      });
    },

    removeField(key: string): void {
      patchState(store, (state) => {
        if (!state.draft) return {};
        return {
          draft: { ...state.draft, fields: state.draft.fields.filter((f) => f.key !== key) },
        };
      });
    },

    saveDraft(): void {
      patchState(store, (state) => {
        if (!state.draft) return {};
        const committed = cloneType(state.draft);
        return {
          types: state.types.map((t) => (t.id === committed.id ? committed : t)),
          draft: cloneType(committed),
        };
      });
    },

    discardDraft(): void {
      patchState(store, (state) => {
        const selected = state.types.find((t) => t.id === state.selectedId) ?? null;
        return { draft: selected ? cloneType(selected) : null };
      });
    },
  })),
);
