import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { collectPaginatedPages, LIST_MAX_PAGES, LIST_PAGE_SIZE } from './collect-paginated';

interface Row {
  id: number;
}

const url = 'http://api.test/api/v1/things';

/** Página de `n` filas. */
const rows = (n: number, from = 1): Row[] => Array.from({ length: n }, (_, i) => ({ id: from + i }));

/** Envelope de Laravel (lo que el API todavía NO manda, pero va a mandar). */
const envelope = (data: Row[], current: number, last: number) => ({
  data,
  links: {},
  meta: { current_page: current, from: 1, last_page: last, per_page: 100, to: data.length, total: last * 100 },
});

describe('collectPaginatedPages', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Lanza la recolección y devuelve una caja que se llena al emitir. */
  const collect = (): { rows: Row[] | undefined } => {
    const box: { rows: Row[] | undefined } = { rows: undefined };
    collectPaginatedPages<Row>(http, url).subscribe((r) => (box.rows = r));
    return box;
  };

  it('reads a flat array root instead of returning an empty list', () => {
    // Forma real de `GET /providers` y `GET /locations`: array plano en la raíz,
    // sin `{data, links, meta}`. Leerlo como envelope daba listas vacías.
    const box = collect();

    httpMock.expectOne((r) => r.url === url && r.params.get('page') === '1').flush(rows(3));

    expect(box.rows).toEqual(rows(3));
  });

  it('asks for a page size inside the API cap (1..100)', () => {
    const box = collect();

    const req = httpMock.expectOne((r) => r.url === url);
    const asked = Number(req.request.params.get('per_page'));
    expect(asked).toBe(LIST_PAGE_SIZE);
    expect(asked).toBeGreaterThanOrEqual(1);
    expect(asked).toBeLessThanOrEqual(100);

    req.flush(rows(1));
    expect(box.rows?.length).toBe(1);
  });

  it('keeps collecting while a flat page comes back full', () => {
    const box = collect();

    httpMock.expectOne((r) => r.params.get('page') === '1').flush(rows(LIST_PAGE_SIZE, 1));
    httpMock
      .expectOne((r) => r.params.get('page') === '2')
      .flush(rows(2, LIST_PAGE_SIZE + 1));

    expect(box.rows?.length).toBe(LIST_PAGE_SIZE + 2);
  });

  it('stops on a short page when the response carries no meta', () => {
    const box = collect();

    httpMock.expectOne((r) => r.params.get('page') === '1').flush(rows(3));

    // Una página incompleta es la última: no se pide la siguiente.
    httpMock.expectNone((r) => r.params.get('page') === '2');
    expect(box.rows?.length).toBe(3);
  });

  it('uses meta.last_page when the API sends the envelope', () => {
    const box = collect();

    httpMock.expectOne((r) => r.params.get('page') === '1').flush(envelope(rows(2, 1), 1, 2));
    httpMock.expectOne((r) => r.params.get('page') === '2').flush(envelope(rows(2, 3), 2, 2));

    expect(box.rows).toEqual([...rows(2, 1), ...rows(2, 3)]);
  });

  it('stops an empty page without asking for more', () => {
    const box = collect();

    httpMock.expectOne((r) => r.params.get('page') === '1').flush([]);

    httpMock.expectNone((r) => r.params.get('page') === '2');
    expect(box.rows).toEqual([]);
  });

  it('never follows more than the safety cap', () => {
    const box = collect();

    for (let page = 1; page <= LIST_MAX_PAGES; page++) {
      httpMock.expectOne((r) => r.params.get('page') === String(page)).flush(rows(LIST_PAGE_SIZE, 1));
    }

    expect(box.rows?.length).toBe(LIST_PAGE_SIZE * LIST_MAX_PAGES);
    httpMock.expectNone((r) => r.params.get('page') === String(LIST_MAX_PAGES + 1));
  });
});
