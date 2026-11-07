import type { Service, ServicePack } from '@models';

/**
 * Exportador Bookwise → WooCommerce (formato del importador core de productos).
 *
 * Un solo CSV lleva el padre y sus variaciones, en ese orden, con las columnas
 * exactas del schema oficial. Las reglas salen de `odd/tasks/services-packs-variations.md`
 * §7 y §7.1:
 *
 * - El padre va siempre antes que sus variaciones.
 * - `Regular price` = precio de venta (o lista cuando no hay `compare_at_price`);
 *   `Sale price` queda SIEMPRE vacío (el modelo no tiene `compare_at_price` y un
 *   `Sale price` igual al `Regular` crearía una oferta falsa, §7.2 regla 6).
 * - Las variaciones se materializan solo desde los términos activos, ordenados
 *   por `total_sessions` ascendente.
 */

/** Fila ya proyectada al formato del importador core de WooCommerce. */
export interface WooCsvRow {
  Type: string;
  SKU: string;
  Name: string;
  Published: string;
  Parent: string;
  'Attribute 1 name': string;
  'Attribute 1 value(s)': string;
  'Attribute 1 visible': string;
  'Attribute 1 global': string;
  'Regular price': string;
  'Sale price': string;
  Position: string;
}

/** Servicio con sus términos (packs) para armar las filas del exportador. */
export interface ServiceExportInput {
  service: Service;
  terms: ServicePack[];
}

/** Columnas en el orden exacto del importador core (ver §7.2). */
export const WOO_CSV_COLUMNS: readonly (keyof WooCsvRow)[] = [
  'Type',
  'SKU',
  'Name',
  'Published',
  'Parent',
  'Attribute 1 name',
  'Attribute 1 value(s)',
  'Attribute 1 visible',
  'Attribute 1 global',
  'Regular price',
  'Sale price',
  'Position',
];

/** Etiqueta canónica del término: `1 sesion` (sin tilde) y `{n} sesiones`. */
export function wooTermLabel(totalSessions: number): string {
  return totalSessions === 1 ? '1 sesion' : `${totalSessions} sesiones`;
}

function activeTermsSorted(terms: ServicePack[]): ServicePack[] {
  return terms.filter((t) => t.active).sort((a, b) => a.total_sessions - b.total_sessions);
}

function priceAsString(value: string | number): string {
  return String(value);
}

/**
 * Proyecta servicios + términos a filas del CSV. Un servicio con al menos un
 * término activo se exporta como padre `variable` + una fila `variation` por
 * término activo; sin términos activos se exporta como `simple`.
 */
export function buildWooRows(inputs: ServiceExportInput[]): WooCsvRow[] {
  const rows: WooCsvRow[] = [];
  let position = 1;

  for (const { service, terms } of inputs) {
    const activeTerms = activeTermsSorted(terms);
    const published = service.active ? '1' : '0';
    const parentSku = `svc-${service.id}`;
    const name = service.name;

    if (activeTerms.length === 0) {
      rows.push({
        Type: 'simple',
        SKU: parentSku,
        Name: name,
        Published: published,
        Parent: '',
        'Attribute 1 name': '',
        'Attribute 1 value(s)': '',
        'Attribute 1 visible': '',
        'Attribute 1 global': '',
        'Regular price': priceAsString(service.price),
        'Sale price': '',
        Position: String(position++),
      });
      continue;
    }

    // Padre `variable`: lista completa de etiquetas, sin precio.
    rows.push({
      Type: 'variable',
      SKU: parentSku,
      Name: name,
      Published: published,
      Parent: '',
      'Attribute 1 name': 'Sesiones',
      'Attribute 1 value(s)': activeTerms.map((t) => wooTermLabel(t.total_sessions)).join(', '),
      'Attribute 1 visible': '1',
      'Attribute 1 global': '1',
      'Regular price': '',
      'Sale price': '',
      Position: String(position++),
    });

    // Variaciones: un solo valor cada una, precio del término en `Regular price`.
    for (const term of activeTerms) {
      const label = wooTermLabel(term.total_sessions);
      rows.push({
        Type: 'variation',
        SKU: `${parentSku}-${term.total_sessions}`,
        // Cada variación lleva un nombre propio (§2.2 regla 2 del pedido y paso 5
        // del importador: «give each variation row its own unique SKU and Name»).
        Name: `${name} - ${label}`,
        Published: published,
        Parent: parentSku,
        'Attribute 1 name': 'Sesiones',
        'Attribute 1 value(s)': label,
        'Attribute 1 visible': '1',
        'Attribute 1 global': '1',
        'Regular price': priceAsString(term.price),
        'Sale price': '',
        Position: String(position++),
      });
    }
  }

  return rows;
}

/** Entrecomilla el valor si contiene coma, comilla o salto de línea; duplica comillas internas. */
function escapeCsvValue(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serializa las filas al CSV (con cabecera) y devuelve la cantidad de filas exportadas. */
export function buildWooCsv(rows: WooCsvRow[]): { csv: string; rowCount: number } {
  const header = WOO_CSV_COLUMNS.map((col) => escapeCsvValue(String(col))).join(',');
  const lines = [header];

  for (const row of rows) {
    lines.push(WOO_CSV_COLUMNS.map((col) => escapeCsvValue(row[col] ?? '')).join(','));
  }

  return { csv: lines.join('\n'), rowCount: rows.length };
}

/**
 * Proyección estable de un servicio + términos para detectar cambios entre
 * exportaciones. Incluye nombre, active, precio y duración del servicio y,
 * por término, id / total_sessions / price / active. Determinística: los
 * términos se ordenan para que el orden de llegada no altere la huella.
 */
export function serviceFingerprint(service: Service, terms: ServicePack[]): string {
  const servicePart = [
    service.name,
    service.active ? '1' : '0',
    service.price,
    service.duration_minutes,
  ].join('|');

  const termsPart = [...terms]
    .sort((a, b) => a.total_sessions - b.total_sessions || a.id - b.id)
    .map((t) => [t.id, t.total_sessions, t.price, t.active ? '1' : '0'].join(':'))
    .join(',');

  return `${servicePart};;${termsPart}`;
}
