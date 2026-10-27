import { HttpClient } from '@angular/common/http';
import { Observable, map, of, switchMap } from 'rxjs';
import { PaginatedResponse } from '@models';
import { buildHttpParams } from './build-http-params';

/**
 * Tamaño de página con el que se piden los listados paginados.
 *
 * El backend pagina (`{data, links, meta}`, default 15) y **no valida ni acota
 * `per_page`**, así que pedimos un valor explícito y acotado.
 */
export const LIST_PAGE_SIZE = 25;

/**
 * Tope de seguridad de la agregación: nunca se siguen más de 40 páginas (1000
 * registros con `LIST_PAGE_SIZE`). Evita que un `meta.last_page` absurdo
 * encadene requests sin fin; si se alcanza, se devuelve lo reunido hasta ahí.
 */
export const LIST_MAX_PAGES = 40;

/**
 * Recorre **todas** las páginas de un endpoint paginado y devuelve un único
 * array plano.
 *
 * `ReferenceStore` publica arrays completos y los comparten agenda, reservas,
 * roles y el dashboard: quedarse con la primera página truncaba esas pantallas
 * a 25 registros. Las páginas se piden en serie (una depende del `last_page` de
 * la anterior) y se cortan en `LIST_MAX_PAGES`.
 */
export function collectPaginatedPages<T>(
  http: HttpClient,
  url: string,
  params?: Record<string, unknown> | null,
): Observable<T[]> {
  const load = (page: number): Observable<T[]> =>
    http
      .get<PaginatedResponse<T>>(url, {
        params: buildHttpParams({ ...(params ?? {}), per_page: LIST_PAGE_SIZE, page }),
      })
      .pipe(
        switchMap((res) => {
          const batch = res.data ?? [];
          const lastPage = res.meta?.last_page ?? page;
          const exhausted = batch.length === 0 || page >= lastPage || page >= LIST_MAX_PAGES;
          if (exhausted) return of(batch);
          return load(page + 1).pipe(map((rest) => [...batch, ...rest]));
        }),
      );

  return load(1);
}
