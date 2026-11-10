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

function cloneType(type: ClinicalRecordType): ClinicalRecordType {
  return JSON.parse(JSON.stringify(type)) as ClinicalRecordType;
}

/**
 * Clave nueva para un campo: el mayor `field_N` presente + 1.
 *
 * Se deriva de los campos **actuales** del draft y no de un contador de módulo:
 * los tipos que vienen de la API ya traen `field_1`, `field_2`… y un contador
 * sin sembrar generaba una clave repetida (dos filas que se editaban juntas).
 */
function makeFieldKey(fields: readonly ClinicalRecordField[]): string {
  let max = 0;
  for (const field of fields) {
    const match = /^field_(\d+)$/.exec(field.key ?? '');
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `field_${max + 1}`;
}

/**
 * Copia del campo con `options` sólo cuando el tipo es `select`. Para el resto
 * de los tipos la clave se omite: el contrato sólo exige `options` en `select`
 * y el front no debe mandar opciones viejas de un campo que dejó de serlo.
 */
function fieldWithType(
  field: ClinicalRecordField,
  type: ClinicalRecordFieldType,
): ClinicalRecordField {
  const next: ClinicalRecordField = {
    key: field.key,
    label: field.label,
    type,
    required: field.required,
  };
  if (type === 'select') next.options = [...(field.options ?? [])];
  return next;
}

/**
 * Aplica `update` al campo en `index` y devuelve el draft nuevo.
 *
 * Todo el editor direcciona las filas **por posición**, no por `key`: un tipo
 * cargado desde la API puede traer claves repetidas (`field_1` dos veces) y
 * buscar por clave mutaba las dos filas a la vez.
 */
function updateFieldAt(
  draft: ClinicalRecordType | null,
  index: number,
  update: (field: ClinicalRecordField) => ClinicalRecordField,
): ClinicalRecordType | null {
  if (!draft || index < 0 || index >= draft.fields.length) return null;
  const fields = draft.fields.map((field, i) => (i === index ? update(field) : field));
  return { ...draft, fields };
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
    /**
     * Índices de los campos `select` sin opciones.
     *
     * Contrato confirmado por el backend: `options` es `string[]` y `options: []`
     * equivale a ausente → **422**. Por eso un `select` sin opciones hace que el
     * editor no deje guardar (se avisa en la propia fila, antes del request).
     */
    invalidOptionIndexes: computed<number[]>(() => {
      const draft = store.draft();
      if (!draft) return [];
      const invalid: number[] = [];
      draft.fields.forEach((field, index) => {
        if (field.type === 'select' && !(field.options ?? []).length) invalid.push(index);
      });
      return invalid;
    }),
    /** `false` mientras algún campo `select` no tenga opciones. */
    canSave: computed<boolean>(() => {
      const draft = store.draft();
      if (!draft) return false;
      return !draft.fields.some(
        (field) => field.type === 'select' && !(field.options ?? []).length,
      );
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
          key: makeFieldKey(state.draft.fields),
          label: '',
          type: 'text',
          required: false,
        };
        return { draft: { ...state.draft, fields: [...state.draft.fields, field] } };
      });
    },

    updateFieldLabel(index: number, label: string): void {
      patchState(store, (state) => {
        const draft = updateFieldAt(state.draft, index, (field) => ({ ...field, label }));
        return draft ? { draft } : {};
      });
    },

    updateFieldType(index: number, type: ClinicalRecordFieldType): void {
      patchState(store, (state) => {
        const draft = updateFieldAt(state.draft, index, (field) => fieldWithType(field, type));
        return draft ? { draft } : {};
      });
    },

    updateFieldRequired(index: number, required: boolean): void {
      patchState(store, (state) => {
        const draft = updateFieldAt(state.draft, index, (field) => ({ ...field, required }));
        return draft ? { draft } : {};
      });
    },

    /**
     * Agrega una opción al campo `index` (sólo tienen sentido en `select`).
     *
     * Recorta el valor e ignora vacíos y duplicados sin distinguir mayúsculas,
     * conservando el orden de ingreso. Devuelve `true` sólo si la agregó, para
     * que la UI pueda limpiar el input únicamente cuando hubo alta.
     */
    addFieldOption(index: number, option: string): boolean {
      const field = store.draft()?.fields[index];
      const value = option.trim();
      if (!field || field.type !== 'select' || !value) return false;
      const options = field.options ?? [];
      if (options.some((current) => current.toLowerCase() === value.toLowerCase())) return false;

      patchState(store, (state) => {
        const draft = updateFieldAt(state.draft, index, (current) => ({
          ...current,
          options: [...(current.options ?? []), value],
        }));
        return draft ? { draft } : {};
      });
      return true;
    },

    removeFieldOption(index: number, optionIndex: number): void {
      const options = store.draft()?.fields[index]?.options ?? [];
      if (optionIndex < 0 || optionIndex >= options.length) return;

      patchState(store, (state) => {
        const draft = updateFieldAt(state.draft, index, (field) => ({
          ...field,
          options: (field.options ?? []).filter((_, i) => i !== optionIndex),
        }));
        return draft ? { draft } : {};
      });
    },

    removeField(index: number): void {
      patchState(store, (state) => {
        if (!state.draft || index < 0 || index >= state.draft.fields.length) return {};
        return {
          draft: {
            ...state.draft,
            fields: state.draft.fields.filter((_, i) => i !== index),
          },
        };
      });
    },

    /** Persiste el draft (POST si es nuevo, PATCH si ya tiene id de servidor). */
    saveDraft(): Observable<ClinicalRecordType> {
      const draft = store.draft();
      // Un `select` sin opciones es inválido para la API (`options: []` → 422):
      // no se dispara el request y la UI mantiene el aviso en la fila.
      if (!draft || !store.canSave()) return EMPTY;

      const payload: ClinicalRecordTypePayload = {
        name: draft.name,
        description: draft.description ?? null,
        active: draft.active,
        sort_order: draft.sort_order,
        fields: draft.fields.map((field) => fieldWithType(field, field.type)),
      };
      // `undefined < 0` es `false` en JS, así que un id no entero se iba por la
      // rama de PATCH y armaba `PATCH /clinical-record-types/undefined` (500 del
      // backend, hoy 404). Con esto, cualquier id que no sea un entero positivo
      // cuenta como «tipo nuevo» y va por POST.
      const isNew = !Number.isInteger(draft.id) || draft.id < 0;
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
