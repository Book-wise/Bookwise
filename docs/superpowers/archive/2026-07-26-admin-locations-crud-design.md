# Admin Locations — CRUD Management

**Date:** 2026-07-25
**Project:** Bookwise (Frontend Admin)
**Status:** Approved for implementation

---

## Problem

The admin `/locations` page currently renders a read-only table of locations fetched from the API. The edit and view buttons are placeholders with no functionality, and the API service lacks create/update endpoints. Admins cannot manage locations (sucursales) from the UI.

## Scope

Full CRUD minus hard delete — locations are activated/deactivated via a toggle instead:

- **Create** new locations via dialog form
- **Edit** existing locations via the same dialog in edit mode
- **View** location details via the same dialog in readonly mode
- **Toggle active/inactive** directly from the table row
- **Conflict handling** when deactivating a location with future bookings

## Current State

- `locations-list.component` — fetches via `ApiService.getLocations()`, renders PrimeNG table with skeleton loading, has placeholder buttons for edit/view
- `ApiService` — only `getLocations()` and `getLocation(id)` exist; no create/update methods
- `Location` model — flat fields (`id, name, address, city, timezone, active, timestamps`)
- `ReferenceStore` — loads locations globally at app init, exposes `invalidateLocations()`
- No dialog component exists for locations

## Solution Architecture

### Components

```
locations-list.component         ← existing, add toggle + wire buttons
  └── location-dialog.component  ← NEW, create/edit/view modes
```

### Component Tree

```
LocationsListComponent
  ├── p-table with locations data
  │   ├── Column: ID
  │   ├── Column: Nombre
  │   ├── Column: Dirección
  │   ├── Column: Ciudad
  │   ├── Column: Estado → p-tag + p-inputSwitch (inline toggle)
  │   └── Column: Acciones → view button + edit button
  │
  └── LocationDialogComponent (DynamicDialog)
        ├── mode = 'create' → empty form, "Crear sucursal"
        ├── mode = 'view'   → readonly form, "Editar" button
        └── mode = 'edit'   → pre-filled form, "Guardar cambios"
```

### Data Flow

```
User action → Component → ApiService → Backend → Response → ReferenceStore.invalidateLocations() → Table refresh
```

### Files to create/modify

| File | Action |
|---|---|
| `src/app/core/models/index.ts` | Update `Location` interface with new fields |
| `src/app/core/services/api.service.ts` | Add `createLocation()`, `updateLocation()`, `getRegions()`, `getComunas()` |
| `src/app/features/admin/locations/locations-list.component.ts` | Add toggle, wire dialog buttons |
| `src/app/features/admin/locations/locations-list.component.html` | Add toggle column, wire buttons |
| `src/app/features/admin/locations/locations-list.component.scss` | Minimal toggle styling |
| `src/app/features/admin/locations/location-dialog/location-dialog.component.ts` | NEW — dialog logic |
| `src/app/features/admin/locations/location-dialog/location-dialog.component.html` | NEW — dialog template |
| `src/app/features/admin/locations/location-dialog/location-dialog.component.scss` | NEW — dialog styles |
| `src/app/features/admin/locations/constants/location-constants.ts` | NEW — timezone/region constants if needed |

---

## Visual Design

### Updated Locations Table

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Sucursales                                                         [+ Nueva] │
├──────┬───────────────┬──────────────────────┬──────────┬───────────────────────┤
│  ID  │  Nombre       │  Dirección            │ Ciudad   │  Estado         Acc. │
├──────┼───────────────┼──────────────────────┼──────────┼───────────────────────┤
│  1   │ Sucursal      │ Av. Siempre Viva 742 │ Montevideo│ 🟢 Activo            │
│      │ Centro        │                       │          │ [=====●=====]  👁 ✏  │
├──────┼───────────────┼──────────────────────┼──────────┼───────────────────────┤
│  2   │ Sucursal      │ Rambla 123           │ Punta    │ 🔴 Inactivo          │
│      │ Punta         │                       │ del Este │ [○==========]  👁 ✏  │
└──────┴───────────────┴──────────────────────┴──────────┴───────────────────────┘
```

- `p-inputSwitch` next to `p-tag` for instant toggle
- View (👁) and Edit (✏) buttons open LocationDialog

### Location Dialog — Create Mode

```
┌──────────────────────────────────────────┐
│  Nueva sucursal                       ✕  │
├──────────────────────────────────────────┤
│  ┌ form-grid ──────────────────────────┐ │
│  │  ┌ field ─────────────────────────┐ │ │
│  │  │  Nombre *                      │ │ │
│  │  │  ┌────────────────────────────┐│ │ │
│  │  │  │ Sucursal Santiago Centro   ││ │ │
│  │  │  └────────────────────────────┘│ │ │
│  │  └────────────────────────────────┘ │ │
│  │  ┌ field ─────────────────────────┐ │ │
│  │  │  Dirección *                   │ │ │
│  │  │  ┌────────────────────────────┐│ │ │
│  │  │  │ Av. Providencia 1234       ││ │ │
│  │  │  └────────────────────────────┘│ │ │
│  │  └────────────────────────────────┘ │ │
│  │  ┌ field-row ────────────────────┐ │ │
│  │  │  ┌ field ──────┐ ┌ field ───┐│ │ │
│  │  │  │ Ciudad *    │ │ Región * ││ │ │
│  │  │  │ ┌─────────┐│ │ ┌───────┐││ │ │
│  │  │  │ │Santiago ││ │ │ Metro ▼│││ │ │
│  │  │  │ └─────────┘│ │ └───────┘││ │ │
│  │  │  └────────────┘ └──────────┘│ │ │
│  │  └──────────────────────────────┘ │ │
│  │  ┌ field-row ────────────────────┐ │ │
│  │  │  ┌ field ──────┐ ┌ field ───┐│ │ │
│  │  │  │ Comuna      │ │ C.Postal ││ │ │
│  │  │  │ ┌─────────┐│ │ ┌───────┐││ │ │
│  │  │  │ │ Santiago ▼││ │7500000│││ │ │
│  │  │  │ └─────────┘│ │ └───────┘││ │ │
│  │  │  └────────────┘ └──────────┘│ │ │
│  │  └──────────────────────────────┘ │ │
│  │  ┌ field-row ────────────────────┐ │ │
│  │  │  ┌ field ──────┐ ┌ field ───┐│ │ │
│  │  │  │ Apertura    │ │ Cierre   ││ │ │
│  │  │  │ ┌─────────┐│ │ ┌───────┐││ │ │
│  │  │  │ │ 09:00  ⏰││ │ │19:00⏰│││ │ │
│  │  │  │ └─────────┘│ │ └───────┘││ │ │
│  │  │  └────────────┘ └──────────┘│ │ │
│  │  └──────────────────────────────┘ │ │
│  │  ┌ field ─────────────────────────┐ │ │
│  │  │  Activa                        │ │ │
│  │  │  [=====●=====] Sí, está activa │ │ │
│  │  └────────────────────────────────┘ │ │
│  └──────────────────────────────────────┘ │
│  ┌ dialog-footer ───────────────────────┐ │
│  │ [Cancelar]             [Crear ✓]     │ │
│  └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Location Dialog — View Mode

Same layout with all inputs disabled/readonly. Footer shows:
- `[Cerrar] [Editar ✏️]`

### Location Dialog — Edit Mode

Same layout with pre-filled editable inputs. Footer shows:
- `[Cancelar] [Guardar ✓]`

### Deactivation Conflict Dialog

```
┌──────────────────────────────────────────┐
│  Desactivar sucursal                 ✕  │
├──────────────────────────────────────────┤
│  ┌ confirmation-content ───────────────┐ │
│  │  ⚠️ La ubicación tiene 3 reserva(s)  │ │
│  │  futura(s) activa(s):               │ │
│  │  ┌─────┬──────────┬────────┬───────┐ │ │
│  │  │  #  │  Fecha   │ Hora   │ Prof. │ │ │
│  │  ├─────┼──────────┼────────┼───────┤ │ │
│  │  │ 42  │01/08/2026│ 10:00  │ J.P.  │ │ │
│  │  │ 43  │03/08/2026│ 11:00  │ M.G.  │ │ │
│  │  │ 44  │05/08/2026│ 09:00  │ J.P.  │ │ │
│  │  └─────┴──────────┴────────┴───────┘ │ │
│  │  ¿Desea continuar?                   │ │
│  └──────────────────────────────────────┘ │
│  ┌ dialog-footer ───────────────────────┐ │
│  │ [Cancelar]       [Sí, desactivar 🚫] │ │
│  └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

---

## Dialog Pattern (Reference for future dialogs)

Follow the established pattern from `block-time-dialog`:

| Element | Pattern |
|---|---|
| Dialog | `p-dialog [modal]="true" [draggable]="false" [resizable]="false"` |
| Width | `540px` |
| Content | `[contentStyle]="{'overflow-y': 'auto', 'max-height': '70vh'}"` |
| Footer PT | `[pt]="{ footer: { style: { paddingTop: '1.25rem' } } }"` |
| Header | Custom `pTemplate="header"` with `.dialog-header` (flex, space-between) + `.dialog-title` (`var(--bw-font-title)`, 600) |
| Content | Wrapper div (no p-card) with `display: flex; flex-direction: column; gap: 1.5rem;` |
| Fields | `.field` with `display: flex; flex-direction: column; gap: 0.5rem;` |
| Field row | `.field-row` with `display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;` |
| Labels | `font-size: 0.875rem; font-weight: 500; color: var(--text-label);` |
| Footer | Custom `pTemplate="footer"` with `.dialog-footer` (flex, space-between) |
| Cancel btn | `severity="secondary" [outlined]="true"` |
| Primary btn | `icon="pi pi-check"` with `[loading]` and `[disabled]` |

---

## API Contract

### New endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/locations` | Create location |
| `PATCH` | `/locations/{id}` | Update location (partial) |
| `GET` | `/regions` | List regions for dropdown |
| `GET` | `/regions/{id}/comunas` | List comunas for dropdown |

### POST /locations

**Request:**
```json
{
  "name": "Sucursal Santiago Centro",
  "address": "Av. Providencia 1234",
  "city": "Santiago",
  "region_id": 16,
  "comuna_id": 101,
  "codigo_postal": "7500000",
  "opening_time": "09:00",
  "closing_time": "19:00",
  "active": true
}
```

**Success (201):**
```json
{
  "message": "Sucursal creada exitosamente",
  "data": {
    "id": 1, "name": "...", "address": "...", "city": "...",
    "region": { "id": 16, "name": "Metropolitana", "timezone": "America/Santiago" },
    "comuna": { "id": 101, "name": "Santiago" },
    "timezone": "America/Santiago",
    "active": true,
    "opening_time": "09:00", "closing_time": "19:00",
    "created_at": "...", "updated_at": "..."
  }
}
```

**Validation Error (422):**
```json
{
  "message": "Error de validación",
  "errors": { "name": ["El campo name ya ha sido registrado."] }
}
```

### PATCH /locations/{id}

Accepts partial fields. Same response format as POST with message `"Sucursal actualizada exitosamente"`.

### Activation Toggle

**Without conflicts (200):** `PATCH { "active": false }` → desactiva directo.
**With future bookings (409):**
```json
{
  "message": "La ubicación tiene 3 reserva(s) futura(s) activa(s)...",
  "requires_confirmation": true,
  "affects": {
    "bookings": [{ "id": 42, "date": "2026-08-01", "time": "10:00", "provider_name": "Juan Pérez", "status": "confirmed" }]
  }
}
```
**After force confirm:** `PATCH { "active": false, "force": true }` → desactiva.

### Messages for Toasts

| Action | Code | message |
|---|---|---|
| Crear | 201 | "Sucursal creada exitosamente" |
| Editar | 200 | "Sucursal actualizada exitosamente" |
| Activar | 200 | "Sucursal activada exitosamente" |
| Desactivar (sin conflictos) | 200 | "Sucursal desactivada exitosamente" |
| Desactivar (force confirmado) | 200 | "Sucursal desactivada exitosamente. N reserva(s)... se verán afectadas." |
| Desactivar (con bookings) | 409 | "La ubicación tiene N reserva(s) futura(s) activa(s)..." |

---

## Updated Location Model

```typescript
export interface LocationRegion {
  id: number;
  name: string;
  timezone: string;
}

export interface LocationComuna {
  id: number;
  name: string;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  region_id?: number;
  region?: LocationRegion;
  comuna_id?: number;
  comuna?: LocationComuna;
  timezone: string;
  codigo_postal?: string;
  opening_time?: string;   // H:i format
  closing_time?: string;   // H:i format
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Region {
  id: number;
  name: string;
  timezone: string;
}
```

---

## Error Handling

- **422 Validation**: Display field-level errors from `errors` object next to each field
- **409 Conflict on deactivation**: Show confirmation dialog with affected bookings list
- **Network errors**: Standard `HttpErrorService.handle()`
- **Success**: Show toast with `response.message` from backend

## Edge Cases

- **Comuna dropdown**: Only appear when a region is selected. Load via `GET /regions/{id}/comunas`
- **Opening/closing time validation**: Frontend validates H:i format before sending
- **Toggle while loading**: Disable switch during API call to prevent double-submit
- **Dialog open while another action in progress**: Prevent opening multiple dialogs
- **409 on force toggle**: If force-confirmed toggle still fails, show error toast
