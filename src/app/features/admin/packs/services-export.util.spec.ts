import {
  buildWooCsv,
  buildWooRows,
  serviceFingerprint,
  WOO_CSV_COLUMNS,
  wooTermLabel,
} from './services-export.util';
import type { Service, ServicePack } from '@models';

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    name: 'Kinesiología general',
    duration_minutes: 60,
    price: '25000',
    active: true,
    ...overrides,
  } as Service;
}

function makePack(overrides: Partial<ServicePack> = {}): ServicePack {
  return {
    id: 11,
    service_id: 1,
    name: 'Pack',
    total_sessions: 3,
    price: '67500',
    active: true,
    ...overrides,
  };
}

describe('buildWooRows', () => {
  it('emite el padre variable antes que sus variaciones, ordenadas por sesiones', () => {
    const service = makeService();
    const terms = [
      makePack({ id: 12, total_sessions: 6, price: '120000' }),
      makePack({ id: 11, total_sessions: 3, price: '67500' }),
      makePack({ id: 10, total_sessions: 1, price: '25000' }),
    ];

    const rows = buildWooRows([{ service, terms }]);

    expect(rows.map((r) => r.Type)).toEqual(['variable', 'variation', 'variation', 'variation']);
    expect(rows[0].SKU).toBe('svc-1');
    expect(rows[0].Parent).toBe('');
    expect(rows[0]['Attribute 1 name']).toBe('Sesiones');
    expect(rows[0]['Attribute 1 value(s)']).toBe('1 sesion, 3 sesiones, 6 sesiones');

    // Variaciones en orden ascendente por total_sessions.
    expect(rows[1].SKU).toBe('svc-1-1');
    expect(rows[1].Parent).toBe('svc-1');
    expect(rows[1]['Attribute 1 value(s)']).toBe('1 sesion');
    expect(rows[2].SKU).toBe('svc-1-3');
    expect(rows[3].SKU).toBe('svc-1-6');
  });

  it('da a cada variación un nombre propio con el término (único por fila)', () => {
    const service = makeService({ name: 'Kinesiología general' });
    const terms = [
      makePack({ id: 10, total_sessions: 1, price: '25000' }),
      makePack({ id: 11, total_sessions: 3, price: '67500' }),
    ];

    const rows = buildWooRows([{ service, terms }]);

    expect(rows[0].Name).toBe('Kinesiología general');
    expect(rows[1].Name).toBe('Kinesiología general - 1 sesion');
    expect(rows[2].Name).toBe('Kinesiología general - 3 sesiones');
    // El nombre de cada variación es distinto del padre y entre sí.
    const names = rows.map((r) => r.Name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('emite una fila simple con el precio en Regular price cuando no hay términos', () => {
    const rows = buildWooRows([{ service: makeService(), terms: [] }]);

    expect(rows).toHaveLength(1);
    expect(rows[0].Type).toBe('simple');
    expect(rows[0].SKU).toBe('svc-1');
    expect(rows[0]['Regular price']).toBe('25000');
    expect(rows[0].Parent).toBe('');
    expect(rows[0]['Attribute 1 name']).toBe('');
  });

  it('ignora los términos inactivos y trata como simple un servicio solo con términos inactivos', () => {
    const rows = buildWooRows([
      { service: makeService(), terms: [makePack({ total_sessions: 1, active: false })] },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].Type).toBe('simple');
  });

  it('deja Sale price SIEMPRE vacío y pone el precio en Regular price', () => {
    const rows = buildWooRows([
      {
        service: makeService(),
        terms: [makePack({ id: 10, total_sessions: 1, price: '25000' })],
      },
    ]);

    expect(rows.every((r) => r['Sale price'] === '')).toBe(true);
    expect(rows[0]['Regular price']).toBe(''); // padre variable sin precio
    expect(rows[1]['Regular price']).toBe('25000'); // variación con precio
  });

  it('mapea Published a 1 o 0 según active', () => {
    const active = buildWooRows([{ service: makeService({ active: true }), terms: [] }]);
    const inactive = buildWooRows([{ service: makeService({ active: false }), terms: [] }]);

    expect(active[0].Published).toBe('1');
    expect(inactive[0].Published).toBe('0');
  });

  it('asigna Position incremental a cada fila', () => {
    const rows = buildWooRows([
      { service: makeService({ id: 1 }), terms: [] },
      { service: makeService({ id: 2, name: 'Otro' }), terms: [makePack({ id: 20, service_id: 2 })] },
    ]);

    expect(rows.map((r) => r.Position)).toEqual(['1', '2', '3']);
  });
});

describe('wooTermLabel', () => {
  it('usa 1 sesion sin tilde y pluraliza el resto', () => {
    expect(wooTermLabel(1)).toBe('1 sesion');
    expect(wooTermLabel(3)).toBe('3 sesiones');
  });
});

describe('buildWooCsv', () => {
  it('serializa la cabecera exacta y cuenta solo las filas de datos', () => {
    const rows = buildWooRows([{ service: makeService(), terms: [] }]);
    const { csv, rowCount } = buildWooCsv(rows);

    expect(csv.split('\n')[0]).toBe(WOO_CSV_COLUMNS.join(','));
    expect(rowCount).toBe(1);
  });

  it('entrecomilla valores con coma y duplica las comillas internas', () => {
    const service = makeService({ name: 'Masaje, "relax"' });
    const { csv } = buildWooCsv(buildWooRows([{ service, terms: [] }]));

    expect(csv).toContain('"Masaje, ""relax"""');
  });

  it('entrecomilla la lista de valores del padre (contiene comas)', () => {
    const service = makeService();
    const terms = [
      makePack({ id: 10, total_sessions: 1, price: '25000' }),
      makePack({ id: 11, total_sessions: 3, price: '67500' }),
    ];
    const { csv } = buildWooCsv(buildWooRows([{ service, terms }]));

    expect(csv).toContain('"1 sesion, 3 sesiones"');
  });
});

describe('serviceFingerprint', () => {
  it('es estable para el mismo servicio y términos', () => {
    const service = makeService();
    const terms = [makePack({ id: 11 }), makePack({ id: 10, total_sessions: 1 })];

    expect(serviceFingerprint(service, terms)).toBe(serviceFingerprint(service, terms));
    // El orden de llegada de los términos no altera la huella.
    expect(serviceFingerprint(service, terms)).toBe(
      serviceFingerprint(service, [...terms].reverse()),
    );
  });

  it('cambia si cambia el precio del servicio', () => {
    const terms = [makePack()];
    const a = serviceFingerprint(makeService({ price: '25000' }), terms);
    const b = serviceFingerprint(makeService({ price: '30000' }), terms);

    expect(a).not.toBe(b);
  });

  it('cambia si cambia un término', () => {
    const service = makeService();
    const a = serviceFingerprint(service, [makePack({ id: 11, price: '67500' })]);
    const b = serviceFingerprint(service, [makePack({ id: 11, price: '70000' })]);

    expect(a).not.toBe(b);
  });
});
