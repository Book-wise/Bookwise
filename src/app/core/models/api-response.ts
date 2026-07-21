/** Laravel JsonResource response envelopes used by the Bookwise API. */
export interface ResourceResponse<T> {
  data: T;
}

export interface ResourceCollectionResponse<T> {
  data: T[];
  meta?: Record<string, unknown>;
  links?: Record<string, unknown>;
}

/** A Resource collection that Laravel has paginated. */
export interface PaginatedResourceCollection<T, Meta extends Record<string, unknown> = Record<string, unknown>>
  extends ResourceCollectionResponse<T> {
  meta: Meta;
}

export function unwrapResource<T>(response: ResourceResponse<T>): T {
  return response.data;
}

export function unwrapCollection<T>(response: ResourceCollectionResponse<T>): T[] {
  return response.data;
}
