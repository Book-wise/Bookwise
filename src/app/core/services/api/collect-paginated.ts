import { HttpClient } from '@angular/common/http';
import { Observable, map, of, switchMap, timeout } from 'rxjs';
import { PaginatedResponse } from '@models';
import { buildHttpParams } from './build-http-params';

/**
 * Tamaño de página con el que se piden los listados paginados.
 *
 * El API **valida `per_page` como entero 1–100** (fuera de rango responde 422
 * `errors.per_page`), así que 100 es el máximo pedible y minimiza las requests
 * de la agregación. El default del servidor es 15.
 */
export const LIST_PAGE_SIZE = 100;

/**
 * Tope de seguridad de la agregación: nunca se siguen más de 40 páginas (4000
 * registros). Evita encadenar requests sin fin si el servidor mintiera sobre el
 * tamaño de página; si se alcanza, se devuelve lo reunido hasta ahí.
 */
export const LIST_MAX_PAGES = 40;

/**
 * Timeout por página de la agregación. Si una request cuelga más que esto, la
 * recolección falla con `TimeoutError` (el store lo traga y marca el error de
 * la entidad) en lugar de encadenar requests sin fin.
 */
export const LIST_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Lo que puede llegar en el body de un listado. El API hoy devuelve **array
 * plano en la raíz** (el controlador hace `response()->json(Resource::collection($paginator))`,
 * que salta el `PaginatedResourceResponse` y por eso no hay `{data, links, meta}`),
 * pero el envelope es la forma documentada a la que va a migrar el backend.
 * El cliente tiene que servir con las dos.
 */
type ListPage<T> = T[] | PaginatedResponse<T> | null | undefined;

/** Filas de la página, venga como array plano o como envelope. */
function extractRows<T>(res: ListPage<T>): T[] {
  if (Array.isArray(res)) return res;
  return res?.data ?? [];
}

/**
 * Recorre las páginas de un endpoint paginado y devuelve un único array plano.
 *
 * `ReferenceStore` publica arrays completos y los comparten agenda, reservas,
 * roles y el dashboard.
 *
 * Fin de la lista, en este orden:
 * - página vacía;
 * - si el body trae `meta`, se respeta `meta.last_page`;
 * - si **no** trae `meta` (caso actual del API), una página más corta que
 *   `per_page` es la última;
 * - y siempre el tope `LIST_MAX_PAGES`.
 */
export function collectPaginatedPages<T>(
  http: HttpClient,
  url: string,
  params?: Record<string, unknown> | null,
): Observable<T[]> {
  const load = (page: number): Observable<T[]> =>
    http
      .get<ListPage<T>>(url, {
        params: buildHttpParams({ ...(params ?? {}), per_page: LIST_PAGE_SIZE, page }),
      })
      .pipe(
        timeout(LIST_REQUEST_TIMEOUT_MS),
        switchMap((res) => {
          const rows = extractRows(res);
          const lastPage = Array.isArray(res) ? undefined : res?.meta?.last_page;
          const exhausted =
            rows.length === 0 ||
            (lastPage !== undefined ? page >= lastPage : rows.length < LIST_PAGE_SIZE) ||
            page >= LIST_MAX_PAGES;
          if (exhausted) return of(rows);
          return load(page + 1).pipe(map((rest) => [...rows, ...rest]));
        }),
      );

  return load(1);
}
