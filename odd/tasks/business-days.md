# Días laborables + feriados nacionales

Feature del backend: días laborables por sucursal y feriados nacionales, que **bloquean la agenda y
las reservas**. Rama `feat/business-days` (stacked sobre `feat/location-hours`, **ambas sin mergear**).

## Contrato (backend, 2026-10-28)

### Dos campos nuevos por sucursal

Se mandan en el mismo `POST` / `PATCH /locations/{id}`:

```json
{ "working_days": [1, 2, 3, 4, 5, 6], "works_on_holidays": false }
```

- `working_days`: enteros ISO **1–7** (1=lunes … 7=domingo). **Default `[1,2,3,4,5,6]`** (lunes a sábado).
- `works_on_holidays`: boolean. **Default `false`** → los feriados nacionales **no** se trabajan.
- Validación: arreglo no vacío, valores 1–7, sin duplicados → **422** con error bajo `working_days`.

### Feriados

Calendario nacional en CORE, cargado con `php artisan holidays:sync {año}`. **2026 = 16 feriados**
(lista oficial verificada).

### Efecto en la UI

- `GET /available_slots` agrega **`meta.is_working_day`**:
  - `false` → día no laborable (o feriado no trabajado) y `total_slots: 0` → mostrar **"cerrado"**.
  - `true` → normal.
- **Reservas**: `POST /bookings` y `PATCH /bookings/{id}` con fecha no laborable → **422**:

```json
{ "error": "non_working_day",
  "detail": "La sucursal no atiende en la fecha indicada: día no laborable o feriado." }
```

### ⚠️ Ojo con el default

**Lunes–sábado** ⇒ **los domingos dejan de poder agendarse** salvo que la sucursal incluya el `7` en
`working_days`. Es decisión de seba, pero el **diálogo de sucursal** debe mostrar los **7 días** con
**lunes–sábado tildados**, para que sea evidente.

## Tasks (pendiente; sin mergear)

- ⬜ T1 `Location` model: agregar `working_days?: number[]` y `works_on_holidays?: boolean`.
- ⬜ T2 `location-dialog`: 7 checkboxes (lun–dom) con lun–sáb tildados por default + toggle
  `works_on_holidays`; enviarlos en POST/PATCH; validar no vacío; mapear 422 `errors.working_days`.
- ⬜ T3 Agenda: si `meta.is_working_day === false` → mostrar **"cerrado"** (día no laborable/feriado),
  sin slots.
- ⬜ T4 Reservas: mapear 422 `non_working_day` a un mensaje claro en el form de reserva.
- ⬜ T5 i18n es/en + specs + `ng build` + suite.

## Log

- L1 (backend, contrato, 2026-10-28): días laborables + feriados nacionales en `feat/business-days`
  (sin mergear, stacked sobre `feat/location-hours`). Contrato arriba. Se captura para implementar
  cuando se mergee.
