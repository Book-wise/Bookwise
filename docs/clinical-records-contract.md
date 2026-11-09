# Contrato API — `clinical-records` (fichas médicas)

Fuente: mensaje de la sesión Bookwise-API (contrato FINAL). Código implementado y en
`origin/develop` de Bookwise-API (`79ef31d`). Tablas creadas y permisos `clinical.*`
backfilleados en local (2 tenants, 22 filas). **`dev.bookwise.cl` todavía no tiene el dominio**:
el deploy está frenado por un gate de seguridad PHP (el server corre 8.3.6 y se exige >= 8.3.36),
escalado a devops. Cablear contra local.

Base `/api/v1`, mismo contexto de tenant y Bearer Sanctum que el resto de la API.

## Rutas

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/clinical-record-types?status=active\|inactive&per_page=` | `clinical.view` |
| GET | `/clinical-record-types/{id}` | `clinical_types.manage` ⚠️ |
| POST | `/clinical-record-types` | `clinical_types.manage` |
| PATCH | `/clinical-record-types/{id}` | `clinical_types.manage` |
| DELETE | `/clinical-record-types/{id}?force=true` | `clinical_types.manage` |
| GET | `/clinical-records?client_id=&booking_id=&record_type_id=&per_page=` | `clinical.view` |
| GET | `/clinical-records/{id}` | `clinical.view` |
| POST | `/clinical-records` | `clinical.manage` |
| PATCH | `/clinical-records/{id}` | `clinical.manage` |
| DELETE | `/clinical-records/{id}` | `clinical.manage` |

⚠️ El detalle de un tipo exige `clinical_types.manage`: un profesional/staff **no** puede pedirlo.
Para el desplegable se usa el **listado**, que ya trae `fields` de cada tipo.

## Shapes

Tipo de ficha (`data`):

```json
{
  "id": 3,
  "name": "Evaluación kinésica inicial",
  "description": "Anamnesis y examen físico",
  "active": true,
  "sort_order": 10,
  "fields": [
    {"key": "motivo", "label": "Motivo de consulta", "type": "text", "required": true, "options": null},
    {"key": "eva", "label": "Dolor EVA (0-10)", "type": "number", "required": true},
    {"key": "lado", "label": "Lado", "type": "select", "required": false, "options": ["izq", "der", "bilateral"]},
    {"key": "inicio", "label": "Inicio de síntomas", "type": "date", "required": false},
    {"key": "obs", "label": "Observaciones", "type": "longtext", "required": false}
  ]
}
```

`type ∈ text | longtext | number | select | date`. `options` solo para `select` (obligatorio si es
`select`). `key` único dentro del tipo, máx 64; `label` máx 120; `name` máx 120.

Ficha (`data`):

```json
{
  "id": 12,
  "client_id": 88,
  "booking_id": 452,
  "record_type_id": 3,
  "values": {"motivo": "dolor lumbar", "eva": 7, "lado": "izq"},
  "created_by": 5,
  "author_name": "Carlos Rojas",
  "created_at": "...",
  "updated_at": "...",
  "record_type": { "...": "shape de tipo, ya cargado" }
}
```

## Requests

- `POST /clinical-records` → `{client_id (req), booking_id (nullable), record_type_id (req), values (req, objeto)}`.
- `PATCH /clinical-records/{id}` → `{booking_id?, record_type_id?, values?}`. `client_id` **no** se
  puede cambiar. ⚠️ `values`, si viene, **REEMPLAZA el mapa completo** (no es merge parcial): para
  guardar un formulario parcial mandá el mapa entero ya mergeado en el cliente.
- `POST/PATCH /clinical-record-types` → `{name?, description?, active?, sort_order?, fields?}`. En
  PATCH, `fields` también **reemplaza el set completo** (igual que `variations[]` en services).

### Filtros del listado de fichas — combinables con AND (confirmado con test, `129cbaa`)

`client_id`, `booking_id` y `record_type_id` son **independientes y combinables**:
`?client_id=88&booking_id=452` devuelve solo las fichas de ese paciente **en esa** reserva. Es lo que
usa la pestaña Ficha para «fichas asociadas a la reserva».

## Errores

| HTTP | `error` | Cuándo |
|---|---|---|
| 422 | `clinical_record_values_invalid` | `values` no cumple `fields`. Trae `fields: { "<key>": "mensaje" }` para pintar por campo («Campo requerido.», «Campo desconocido.», «Debe ser un número.», «Valor fuera de las opciones.», «Fecha inválida.») |
| 422 | `clinical_record_type_not_found` | `record_type_id` inexistente **o inactivo** (no se crean fichas con tipos inactivos) |
| 409 | `clinical_record_type_in_use` | DELETE de un tipo con fichas; `?force=true` lo fuerza |
| 403 | `forbidden` | Profesional creando/editando para un paciente o reserva que no es suyo |
| 403 | `missing_permissions` | El usuario no tiene la clave (mismo contrato que el resto) |

## Scoping y reglas

- Admin (sin provider en el tenant): ve y escribe todo el tenant.
- Profesional (staff con provider): **lee solo fichas de sus pacientes** (clientes con al menos una
  reserva suya) y **solo crea en sus propias reservas**; si `booking_id` viene, esa reserva debe ser
  suya y del mismo cliente.
- Listados: envelope `{data, links, meta}`; `per_page` default **15**, máximo **100** y el tope es
  **estricto** (`per_page=101` → 422). Fichas por `created_at desc`; tipos por `sort_order` asc
  desempatando por `name`.
- `GET /clinical-record-types` emite `fields` completos de cada tipo **siempre**: es una columna JSON
  de la misma fila, sin N+1 ni endpoints extra. Eso es lo que permite al staff poblar el formulario
  sin pegarle al detalle (que exige `clinical_types.manage`). Pineado por
  `test_s4_index_exposes_fields_and_orders_by_sort_order_then_name`.
- DELETE de ficha y de tipo: soft delete. El de tipo bloquea si tiene fichas.
- Tipos sin `status`/transiciones: solo `active` (boolean). El listado para un profesional (con
  provider en el tenant) devuelve **solo activos** e ignora `status`; el filtro `status` y los
  inactivos son de admin.

## Permisos por rol (baseline aplicada en local)

| Rol | Claves |
|---|---|
| `admin_general`, `admin_local`, `admin_location` | `clinical.view`, `clinical.manage`, `clinical_types.manage` |
| `staff` | `clinical.view`, `clinical.manage` (sin `clinical_types.manage`) |
| Recepción | ninguna por defecto (asignable a mano) |
