/**
 * Paleta canónica de colores por sucursal (location).
 *
 * Fuente de verdad única para el color de una sucursal. Antes la lista de
 * profesionales y el dashboard usaban paletas y ordenamientos distintos:
 *   • lista de profesionales → índice sobre sucursales activas ordenadas por nombre
 *   • dashboard              → índice sobre sucursales ordenadas por cantidad de citas
 * Eso producía colores diferentes para la MISMA sucursal entre pantallas.
 *
 * Este resolver asigna el color de forma determinista por `location.id`, así una
 * sucursal conserva SIEMPRE el mismo color sin importar el contexto (tabla de
 * profesionales, gráfico del dashboard, chips de filtro, etc.).
 *
 * La paleta se hereda de la que ya identificaba a las sucursales en la lista de
 * profesionales (no cambiamos el look, solo lo unificamos y lo hacemos estable).
 */
export const LOCATION_PALETTE = [
  '#3b82f6', // blue
  '#f97316', // orange
  '#22c55e', // green
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#84cc16', // lime
  '#ef4444', // red
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f43f5e', // rose
] as const;

/** Color neutro para items sin sucursal / id inválida (fallback). */
export const LOCATION_FALLBACK_COLOR = '#94a3b8';

/**
 * Color estable de una sucursal según su `id`.
 * Determinista: misma id → mismo color en cualquier pantalla.
 * `null`/`undefined`/`<= 0` devuelve el neutro de "sin ubicación".
 */
export function locationColor(id: number | null | undefined): string {
  if (id == null || id <= 0) return LOCATION_FALLBACK_COLOR;
  return LOCATION_PALETTE[(id - 1) % LOCATION_PALETTE.length];
}
