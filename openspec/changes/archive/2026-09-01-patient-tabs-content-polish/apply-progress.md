# Apply Progress: patient-tabs-content-polish

**Mode**: Standard (strict_tdd: false)
**Date**: 2026-09-01
**Branch**: develop (54e431d)
**Tasks**: 3/3 complete ([tasks.md](tasks.md))

## Work Unit Evidence

| Evidence | Required value | Result |
|---|---|---|
| Focused test command and exact result | Smallest command proving each unit | `npx ng test --no-watch --include="**/historial-paciente.component.spec.ts"` → 1 file, 3 tests passed. `--include="**/booking-detail-dialog.component.spec.ts"` → 1 file, 11 tests passed. `--include="**/payment-tab.component.spec.ts"` → 1 file, 3 tests passed. |
| Runtime harness command/scenario and exact result | Real integration path | `npx ng build` → `Application bundle generation complete` (9.8s). Warnings pre-existentes ajenos al change (budget 820 kB, luxon no-ESM). N/A e2e (no runner configurado en el proyecto). |
| Rollback boundary | Exact files/behavior revertibles sin tocar trabajo ajeno | Revertir: `historial-paciente.component.{ts,html}`, `historial-paciente.component.spec.ts`, `booking-detail-dialog.component.scss`, `reserva-tab.component.scss`, `payment-tab.component.scss`. Los 5 archivos son exclusivos del booking-detail-dialog; revertir no afecta otros flujos. |

## Cambios aplicados

### 1. Renombrar label
- `historial-paciente.component.html` L13: "Últimas creaciones" → "Últimas creaciones de reserva".

### 2. Columnas de fecha
- `historial-paciente.component.html` L39-50: `<th>Fecha</th>` → `<th>Fecha de atención</th>` + `<th>Fecha de creación</th>`; fila: celda `formatCardDate(item.start_time)` + celda `formatCreatedAt(item.created_at)` (misma clase `hp-cell--date`). Una sola tabla compartida por ambas sub-tabs.
- `historial-paciente.component.ts`: nuevo `formatCreatedAt(iso: string | undefined): string` → `iso ? tzService.formatCardDate(iso) : '—'` (mismo patrón que `historial-reserva.component.ts`). `created_at` es `string | undefined` en el modelo `Booking` (barrel) — `formatCardDate` local no aceptaba undefined, por eso el helper con guard.

### 3. Márgenes uniformes
- Enfoque elegido (Opción A, la más limpia y la primera sugerida): `.tab-content { padding: 0.75rem; }` como única fuente de verdad y se eliminó el padding interno de `.reserva-form` y `.sale-body` para evitar doble padding. Resultado: los 6 tabs (Reserva, Pago, Recordatorios, Paciente, Ficha, Historial) con exactamente 0.75rem. Verificado que `.reserva-form`, `.sale-body`, `bw-reserva-tab`, `bw-payment-tab` y `.tab-content` son exclusivos del booking-detail-dialog (grep): sin blast radius fuera.
- Nota: hoy Reserva/Pago tenían 1.25rem verticales (0.5 tab-content + 0.75 interno); con el cambio pasan a 0.75rem uniformes — es el cambio visual intencional que unifica los 6 tabs.

### 4. Spec nuevo
- `historial-paciente.component.spec.ts`: 3 tests (label renombrado, dos columnas con fechas por fila, fallback "—"). Mock completo de `HistorialStore` (paginatedBookings, loadingBookingsPage, bookingsPagination, bookingsShowingCount), `TimezoneService`, e `IntersectionObserver`/`ResizeObserver`/`matchMedia` globales (PrimeNG TabList exige ResizeObserver; sin mocks globales falla en jsdom).

## Evidencia de tests

| Suite | Comando | Resultado |
|---|---|---|
| historial-paciente (nuevo) | `--include="**/historial-paciente.component.spec.ts"` | 3/3 passed |
| booking-detail-dialog | `--include="**/booking-detail-dialog.component.spec.ts"` | 11/11 passed |
| payment-tab | `--include="**/payment-tab.component.spec.ts"` | 3/3 passed |
| Build | `npx ng build` | Compila OK (warnings pre-existentes) |

## Notas

- No existe `design.md` para este change (orquestador entregó alcance inline); la implementación sigue el spec y el proposal sin desvíos.
- Los tests pre-existentes que fallan (full-calendar, booking-form-dialog, historial-reserva, clients-api) NO son de este change y no fueron tocados.
- Sin TDD estricto (strict_tdd: false) — modo Standard.
