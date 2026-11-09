import { computed, inject } from '@angular/core';
import { EMPTY, finalize, Observable, tap } from 'rxjs';
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
import {
  ClinicalRecordTypesApiService,
  type ClinicalRecordTypePayload,
} from '@services/api/clinical-record-types-api.service';

/**
 * Store de dominio del catálogo de tipos de ficha (pestaña «Fichas médicas» de
 * Configuraciones y selector «Agregar tipo de ficha» de la reserva).
 *
 * `load()` pide el listado (`GET /clinical-record-types`, que ya trae `fields`
 * completo por tipo); `saveDraft()` persiste por `POST` (tipo nuevo, id local
 * negativo) o `PATCH` (tipo existente). El editor muta un `draft` en vivo y
 * `saveDraft()` devuelve un observable para que el componente pinte el toast de
 * error; en éxito el store reemplaza el tipo y adopta el id del servidor.
 */

interface ClinicalRecordTypesState {
  types: ClinicalRecordType[];
  selectedId: number | null;
  search: string;
  /** Copia de trabajo del tipo seleccionado (edición en vivo). */
  draft: ClinicalRecordType | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  saving: boolean;
}

const initialState: ClinicalRecordTypesState = {
  types: [],
  selectedId: null,
  search: '',
  draft: null,
  loading: false,
  loaded: false,
  error: null,
  saving: false,
};

/** Ids negativos para borradores locales (aún sin POST); el servidor asigna el real. */
let nextLocalTypeId = -1;
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

  withMethods((store, typesApi = inject(ClinicalRecordTypesApiService)) => ({
    /** Carga el catálogo una sola vez por sesión (root store compartido). */
    load(): void {
      if (store.loaded() || store.loading()) return;
      patchState(store, { loading: true, error: null });
      typesApi.getTypes().subscribe({
        next: (types) => patchState(store, { types, loading: false, loaded: true }),
        error: (err: Error) =>
          patchState(store, {
            loading: false,
            error: err.message ?? 'Error al cargar los tipos de ficha',
          }),
      });
    },

    select(id: number): void {
      const type = store.types().find((t) => t.id === id) ?? null;
      patchState(store, { selectedId: id, draft: type ? cloneType(type) : null });
    },

    setSearch(search: string): void {
      patchState(store, { search });
    },

    createType(): void {
      const id = nextLocalTypeId--;
      const maxSort = store.types().reduce((max, t) => Math.max(max, t.sort_order ?? 0), 0);
      const type: ClinicalRecordType = {
        id,
        name: '',
        description: null,
        active: true,
        sort_order: maxSort + 10,
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

    /** Persiste el draft (POST si es nuevo, PATCH si ya tiene id de servidor). */
    saveDraft(): Observable<ClinicalRecordType> {
      const draft = store.draft();
      if (!draft) return EMPTY;

      const payload: ClinicalRecordTypePayload = {
        name: draft.name,
        description: draft.description ?? null,
        active: draft.active,
        sort_order: draft.sort_order,
        fields: draft.fields,
      };
      const isNew = draft.id < 0;
      patchState(store, { saving: true });

      const request = isNew
        ? typesApi.createType(payload)
        : typesApi.updateType(draft.id, payload);

      return request.pipe(
        tap((created) =>
          patchState(store, (state) => ({
            types: state.types.map((t) =>
              t.id === draft.id || t.id === created.id ? created : t,
            ),
            selectedId: created.id,
            draft: cloneType(created),
          })),
        ),
        finalize(() => patchState(store, { saving: false })),
      );
    },

    discardDraft(): void {
      patchState(store, (state) => {
        const selected = state.types.find((t) => t.id === state.selectedId) ?? null;
        return { draft: selected ? cloneType(selected) : null };
      });
    },
  })),
);
