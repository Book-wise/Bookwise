import {
  ResourceCollectionResponse,
  ResourceResponse,
  unwrapCollection,
  unwrapResource,
} from './api-response';

describe('Laravel Resource response helpers', () => {
  it('unwraps an individual Resource response', () => {
    const response: ResourceResponse<{ id: number; name: string }> = {
      data: { id: 7, name: 'Evaluación' },
    };

    expect(unwrapResource(response)).toEqual({ id: 7, name: 'Evaluación' });
  });

  it('unwraps a Resource collection without losing pagination metadata on the response', () => {
    const response: ResourceCollectionResponse<{ id: number }> = {
      data: [{ id: 1 }, { id: 2 }],
      meta: { current_page: 2, last_page: 3, total: 32 },
      links: { next: 'https://example.test/v1/clients?page=3' },
    };

    expect(unwrapCollection(response)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(response.meta).toEqual({ current_page: 2, last_page: 3, total: 32 });
    expect(response.links?.['next']).toContain('page=3');
  });
});
