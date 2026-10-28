# Horario de apertura/cierre por sucursal

Feature nueva del backend: horario configurable por sucursal, consumido por la agenda.
**No es una pantalla nueva**: son dos campos de hora en el **diálogo de edición de la sucursal**
(`admin/locations`).

## Contrato (backend, 2026-10-28)

Rama `feat/location-hours` — **no mergeada aún**. Review + merge los coordina seba; el backend avisa
con el hash cuando esté en `develop`.

### Endpoint y payload

- `PATCH /api/v1/locations/{id}` (y también `POST /locations`), **sin rutas nuevas**.
- Body: `{ "opening_time": "08:00", "closing_time": "20:00" }`.
- Acepta **`HH:MM`** (`<input type="time">`) **y** `HH:MM:SS`; ambos normalizan a `HH:MM:SS`.
- `null` explícito **limpia** el horario (vuelve a "sin configurar").

### Validaciones (422)

- Formato inválido → `errors.opening_time` / `errors.closing_time`.
- **Cierre debe ser posterior a apertura** → `errors.closing_time` con
  `"El horario de cierre debe ser posterior al de apertura."`
  - En un PATCH que manda **sólo uno**, se compara contra el valor **persistido** del otro.
- **No** se soporta horario que cruce medianoche (22:00→02:00): el cierre tiene que ser mayor.

### Resource (4 campos)

```json
{
  "opening_time": null,
  "closing_time": null,
  "effective_opening_time": "08:00:00",
  "effective_closing_time": "22:00:00"
}
```

- `opening_time` / `closing_time`: lo **configurado** (puede ser `null` = sin configurar).
- `effective_opening_time` / `effective_closing_time`: lo que hay que **usar**, nunca `null`.
- **Default sin configurar: 08:00 → 22:00**. Lo resuelve el backend — **NO hardcodear en el front**.

### Agenda

- Al elegir una sucursal, dibujar la grilla desde `effective_opening_time` → `effective_closing_time`.
- El backend ya lo aplica en `GET /available_slots` (los slots salen sólo dentro de ese rango, en la
  TZ de la location).

### Migración de datos

Las sucursales con el default viejo exacto (**09:00/19:00**) pasan a "sin configurar". Las que estaban
configuradas distinto se conservan.

## Tasks

- ⬜ T1 `Location` model: agregar `opening_time`, `closing_time`, `effective_opening_time`,
  `effective_closing_time` (los dos primeros `string | null`; los `effective_*` `string`).
- ⬜ T2 `location-dialog`: dos `<input type="time">` (apertura/cierre). Prellenar con `effective_*`
  cuando `opening_time`/`closing_time` son `null`; enviar `opening_time`/`closing_time` en el PATCH.
  Validar en el front "cierre > apertura" (además del 422 del backend) y mapear
  `errors.opening_time`/`errors.closing_time`.
- ⬜ T3 Agenda: dibujar la grilla desde `effective_opening_time` → `effective_closing_time` de la
  sucursal activa (no hardcodear 09:00/19:00 ni 08:00/22:00).
- ⬜ T4 i18n es/en (`locations.form.opening_time` / `closing_time` + mensaje de validación).
- ⬜ T5 Specs + `ng build` + suite.

## Log

- L1 (backend, contrato, 2026-10-28): feature de horario por sucursal en `feat/location-hours`
  (no mergeada). Contrato completo arriba. Se captura acá para implementar en cuanto se mergee.
