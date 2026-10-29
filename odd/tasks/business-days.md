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

## Tasks (✅ implementado en frontend)

- ✅ T1 `Location` model: `working_days?: number[]` (+ `effective_opening_time`/`effective_closing_time`;
  `opening_time`/`closing_time` nullable). `works_on_holidays` **retirado** por el contrato nuevo (L3).
- ✅ T2 `location-dialog`: 7 checkboxes lun–dom (lun–sáb default) + validación no-vacío + payload
  `working_days`; mapeo 422 `errors.working_days`. (El toggle de feriados migró al tenant, L3.)
- ✅ T3 Agenda: sombreado de días cerrados (weekday fuera de `working_days` o feriado con
  `block_bookings_on_holidays`) + nombre del feriado en el header. Admin y profesional.
- ✅ T4 Reservas: 422 `non_working_day` → toast "Sucursal cerrada" (claves `biz.non_working_day`).
- ✅ T5 i18n es/en + specs + `ng build` + suite.

## Log

- L1 (backend, contrato, 2026-10-28): días laborables + feriados nacionales en `feat/business-days`
  (sin mergear, stacked sobre `feat/location-hours`). Contrato arriba. Se captura para implementar
  cuando se mergee.
- L2 (cierre 2026-10-28): **mergeado y pusheado** en backend `develop` (`131c26c`). Falta deploy
  (`tenants:migrate` + migración `holidays`). Implementar T1–T5.
- L3 (2026-10-29, contrato NUEVO del backend): el bloqueo de feriados deja de ser por sucursal.
  Se **retira** `locations.works_on_holidays` (hecho en frontend, commit `b96d0b2`); la fuente pasa a
  un **toggle global del tenant** `block_bookings_on_holidays` (`GET`/`PATCH /tenant/settings`,
  default `true`, en `/admin/configuraciones`). Nuevo `GET /holidays?year=` → `{data:[{date,name}]}`.
  `available_slots.meta` suma `is_holiday` + `holiday_name`. Sombreado: header con nombre del
  feriado, blocked-slot style si el bloqueo está activo, chip informativo si no. **Aún NO en
  develop**: cablear contra el contrato, no verificar en dev hasta el hash. T1/T2 hechos salvo el
  toggle (migra a configuraciones); T3 pendiente; T4/T5 hechos.
- L4 (2026-10-29, cierre frontend): feature **completa y review aprobada** (lineage
  `review-984ef1f58c46b26b`, autoridad quemada). Contrato mergeado en backend `develop` `ed801fb`.
  Toggle global con su sección en `/admin/configuraciones`; sombreado admin + profesional (este último
  vía `auth.me().business.block_bookings_on_holidays`, porque `/tenant/settings` es admin-only).
  Commits: `2a1f667` base, `80fd3f1` R3-002, `3f591f9` services, `66028b7` toggle, `e82e56e` admin
  shading, `e6e347a` provider shading. **Deploy a dev BLOQUEADO por credenciales SSH del droplet**
  (infra, no código). Checklist: `odd/tasks/deploy-feriados.md`.
